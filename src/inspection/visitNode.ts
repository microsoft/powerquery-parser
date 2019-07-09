// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { Position, State } from "./inspection";
import { NodeKind, TNode } from "./node";

export function visitNode(xorNode: NodeIdMap.TXorNode, state: State): void {
    // tslint:disable-next-line: switch-default
    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            inspectIdentifier(state, xorNode);
            break;

        case Ast.NodeKind.IdentifierExpression:
            inspectIdentifierExpression(state, xorNode);
            break;

        case Ast.NodeKind.InvokeExpression:
            inspectInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListType:
            inspectListExpressionOrLiteral(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrLiteral(state, xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            inspectRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.Section:
            inspectSection(state, xorNode);
            break;
    }
}
function inspectEachExpression(state: State, eachExprXorNode: NodeIdMap.TXorNode): void {
    addToScopeIfNew(state, "_", eachExprXorNode);

    let maybePositionStart: Option<TokenPosition>;
    let maybePositionEnd: Option<TokenPosition>;
    switch (eachExprXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const tokenRange: Ast.TokenRange = eachExprXorNode.node.tokenRange;
            maybePositionStart = tokenRange.positionStart;
            maybePositionEnd = tokenRange.positionEnd;
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const eachExpr: ParserContext.Node = eachExprXorNode.node;
            maybePositionStart =
                eachExpr.maybeTokenStart !== undefined ? eachExpr.maybeTokenStart.positionStart : undefined;
            maybePositionEnd = undefined;
            break;
        }

        default:
            throw isNever(eachExprXorNode);
    }

    const node: TNode = {
        kind: NodeKind.EachExpression,
        maybePositionStart,
        maybePositionEnd,
    };
    state.result.nodes.push(node);
}

function inspectFunctionExpression(state: State, fnExpressionXorNode: NodeIdMap.TXorNode): void {
    if (fnExpressionXorNode.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExpressionXorNode, Ast.NodeKind.FunctionExpression);
    }

    const drilldownToCsvArrayRequest: NodeIdMap.MultipleChildByAttributeIndexRequest = {
        nodeIdMapCollection: state.nodeIdMapCollection,
        firstDrilldown: {
            rootNodeId: fnExpressionXorNode.node.id,
            attributeIndex: 0,
            maybeAllowedNodeKinds: [Ast.NodeKind.ParameterList],
        },
        drilldowns: [
            {
                attributeIndex: 1,
                maybeAllowedNodeKinds: [Ast.NodeKind.CsvArray],
            },
        ],
    };
    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeMultipleChildByAttributeRequest(
        drilldownToCsvArrayRequest,
    );

    if (maybeCsvArrayXorNode === undefined) {
        return undefined;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    for (const parameterXorNode of nodesOnCsvFromCsvArray(state.nodeIdMapCollection, csvArrayXorNode)) {
        inspectParameter(state, parameterXorNode);
    }
}

function inspectGeneralizedIdentifier(state: State, genIdentifierXorNode: NodeIdMap.TXorNode): void {
    // A context for Ast.GeneralizedIdentifier is a context with no values,
    // meaning we can only operate when the arg's XorNodeKind is Ast.
    if (genIdentifierXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        if (genIdentifierXorNode.node.kind !== Ast.NodeKind.GeneralizedIdentifier) {
            throw expectedNodeKindError(genIdentifierXorNode, Ast.NodeKind.GeneralizedIdentifier);
        }

        const generalizedIdentifier: Ast.GeneralizedIdentifier = genIdentifierXorNode.node;
        if (isTokenPositionOnOrBeforeBeforePostion(generalizedIdentifier.tokenRange.positionEnd, state.position)) {
            addAstToScopeIfNew(state, generalizedIdentifier.literal, generalizedIdentifier);
        }
    }
}

function inspectIdentifier(state: State, identifierXorNode: NodeIdMap.TXorNode): void {
    // A context for Ast.Identifier is a context with no values,
    // meaning we can only operate when the arg's XorNodeKind is Ast.
    if (identifierXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        if (identifierXorNode.node.kind !== Ast.NodeKind.Identifier) {
            throw expectedNodeKindError(identifierXorNode, Ast.NodeKind.Identifier);
        }

        const identifier: Ast.Identifier = identifierXorNode.node;
        if (isParentOfNodeKind(state.nodeIdMapCollection, identifier.id, Ast.NodeKind.IdentifierExpression)) {
            return;
        } else if (isTokenPositionOnOrBeforeBeforePostion(identifier.tokenRange.positionEnd, state.position)) {
            addAstToScopeIfNew(state, identifier.literal, identifier);
        }
    }
}

function inspectIdentifierExpression(state: State, identifierExprXorNode: NodeIdMap.TXorNode): void {
    switch (identifierExprXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            if (identifierExprXorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
                throw expectedNodeKindError(identifierExprXorNode, Ast.NodeKind.IdentifierExpression);
            }

            const identifierExpression: Ast.IdentifierExpression = identifierExprXorNode.node;
            let key: string = identifierExpression.identifier.literal;
            if (identifierExpression.maybeInclusiveConstant) {
                const inclusiveConstant: Ast.Constant = identifierExpression.maybeInclusiveConstant;
                key = inclusiveConstant.literal + key;
            }

            addAstToScopeIfNew(state, key, identifierExpression);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            let key: string = "";
            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

            // Add the optional inclusive constant `@` if it was parsed.
            const maybeInclusiveConstant: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExprXorNode.node.id,
                0,
                [Ast.NodeKind.Constant],
            );
            if (maybeInclusiveConstant !== undefined) {
                const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
                key += inclusiveConstant.literal;
            }

            const maybeIdentifier: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExprXorNode.node.id,
                1,
                [Ast.NodeKind.Identifier],
            );
            if (maybeIdentifier !== undefined) {
                const identifier: Ast.Identifier = maybeIdentifier.node as Ast.Identifier;
                key += identifier.literal;
            }

            if (key.length) {
                addContextToScopeIfNew(state, key, identifierExprXorNode.node);
            }

            break;
        }

        default:
            throw isNever(identifierExprXorNode);
    }
}

function inspectInvokeExpression(state: State, invokeExprXorNode: NodeIdMap.TXorNode): void {
    if (invokeExprXorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        throw expectedNodeKindError(invokeExprXorNode, Ast.NodeKind.InvokeExpression);
    }

    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        invokeExprXorNode.node.id,
        1,
        [Ast.NodeKind.CsvArray],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    const argXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = nodesOnCsvFromCsvArray(
        state.nodeIdMapCollection,
        csvArrayXorNode,
    );
    for (const argXorNode of argXorNodes) {
        if (argXorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
            continue;
        }

        inspectIdentifierExpression(state, argXorNode);
    }
}

function inspectListExpressionOrLiteral(state: State, listXorNode: NodeIdMap.TXorNode): void {
    switch (listXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const list: Ast.ListExpression | Ast.ListLiteral = listXorNode.node as Ast.ListExpression | Ast.ListLiteral;
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = list.tokenRange;
            // Check if position is on closeWrapperConstant ('}').
            // The check isn't needed for a context node as the final attribute is the closeWrapperConstant,
            // and as it's a context node it hasn't parsed all attributes.
            if (isTokenPositionOnPosition(list.closeWrapperConstant.tokenRange.positionEnd, position)) {
                return;
            }
            if (isInTokenRange(position, tokenRange)) {
                const node: TNode = {
                    kind: NodeKind.List,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                };
                state.result.nodes.push(node);
            }
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const list: ParserContext.Node = listXorNode.node;
            const node: TNode = {
                kind: NodeKind.List,
                maybePositionStart: list.maybeTokenStart !== undefined ? list.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            };
            state.result.nodes.push(node);
            break;
        }

        default:
            throw isNever(listXorNode);
    }
}

function inspectParameter(state: State, parameterXorNode: NodeIdMap.TXorNode): void {
    const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        parameterXorNode.node.id,
        1,
        [Ast.NodeKind.Identifier],
    );
    if (maybeNameXorNode === undefined) {
        return;
    }
    const nameXorNode: NodeIdMap.TXorNode = maybeNameXorNode;
    inspectIdentifier(state, nameXorNode);
}

function inspectRecordExpressionOrLiteral(state: State, recordXorNode: NodeIdMap.TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    switch (recordXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const record: Ast.RecordExpression | Ast.RecordLiteral = recordXorNode.node as
                | Ast.RecordExpression
                | Ast.RecordLiteral;
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = record.tokenRange;
            // Check if position is on closeWrapperConstant (']').
            // The check isn't needed for a context node as the final attribute is the closeWrapperConstant,
            // and as it's a context node it hasn't parsed all attributes.
            if (isTokenPositionOnPosition(record.closeWrapperConstant.tokenRange.positionEnd, position)) {
                return;
            }
            if (isInTokenRange(position, tokenRange)) {
                const node: TNode = {
                    kind: NodeKind.Record,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                };
                state.result.nodes.push(node);
            }
            break;
        }

        case NodeIdMap.XorNodeKind.Context:
            {
                const record: ParserContext.Node = recordXorNode.node;
                const node: TNode = {
                    kind: NodeKind.Record,
                    maybePositionStart:
                        record.maybeTokenStart !== undefined ? record.maybeTokenStart.positionStart : undefined,
                    maybePositionEnd: undefined,
                };
                state.result.nodes.push(node);
            }
            break;

        default:
            throw isNever(recordXorNode);
    }

    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        recordXorNode.node.id,
        1,
        [Ast.NodeKind.CsvArray],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    for (const keyValuePairXorNode of nodesOnCsvFromCsvArray(nodeIdMapCollection, csvArrayXorNode)) {
        const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairXorNode.node.id,
            0,
            [Ast.NodeKind.GeneralizedIdentifier],
        );
        if (maybeKeyXorNode === undefined) {
            continue;
        }
        const keyXorNode: NodeIdMap.TXorNode = maybeKeyXorNode;
        inspectGeneralizedIdentifier(state, keyXorNode);
    }
}

function inspectRecursivePrimaryExpression(state: State, recursivePrimaryExprXorNode: NodeIdMap.TXorNode): void {
    const maybeHeadXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        recursivePrimaryExprXorNode.node.id,
        0,
        undefined,
    );
    if (maybeHeadXorNode === undefined || maybeHeadXorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
        return;
    }
    const headXorNode: NodeIdMap.TXorNode = maybeHeadXorNode;
    inspectIdentifierExpression(state, headXorNode);
}

function inspectSection(state: State, sectionXorNode: NodeIdMap.TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const maybeSectionMemberArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        sectionXorNode.node.id,
        4,
        [Ast.NodeKind.SectionMemberArray],
    );
    if (maybeSectionMemberArrayXorNode === undefined) {
        return;
    }
    const sectionMemberArrayXorNode: NodeIdMap.TXorNode = maybeSectionMemberArrayXorNode;

    const sectionMemberXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMap.expectXorChildren(
        nodeIdMapCollection,
        sectionMemberArrayXorNode.node.id,
    );

    for (const sectionMember of sectionMemberXorNodes) {
        const request: NodeIdMap.MultipleChildByAttributeIndexRequest = {
            nodeIdMapCollection,
            firstDrilldown: {
                rootNodeId: sectionMember.node.id,
                attributeIndex: 2,
                maybeAllowedNodeKinds: [Ast.NodeKind.IdentifierPairedExpression],
            },
            drilldowns: [
                {
                    attributeIndex: 0,
                    maybeAllowedNodeKinds: [Ast.NodeKind.Identifier],
                },
            ],
        };

        const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeMultipleChildByAttributeRequest(request);
        if (maybeNameXorNode === undefined) {
            break;
        }
        const nameXorNode: NodeIdMap.TXorNode = maybeNameXorNode;
        inspectIdentifier(state, nameXorNode);
    }
}

function expectedNodeKindError(xorNode: NodeIdMap.TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
    const details: {} = { xorNodeId: xorNode.node.id };
    return new CommonError.InvariantError(`expected xorNode to be of kind ${expected}`, details);
}

function isParentOfNodeKind(
    nodeIdMapCollection: NodeIdMap.Collection,
    childId: number,
    parentNodeKind: Ast.NodeKind,
): boolean {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentNodeId === undefined) {
        return false;
    }
    const parentNodeId: number = maybeParentNodeId;

    const maybeParentNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNode(nodeIdMapCollection, parentNodeId);
    if (maybeParentNode === undefined) {
        return false;
    }
    const parent: NodeIdMap.TXorNode = maybeParentNode;

    switch (parent.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return parent.node.kind === parentNodeKind;

        case NodeIdMap.XorNodeKind.Context:
            return parent.node.kind === parentNodeKind;

        default:
            throw isNever(parent);
    }
}

function isInTokenRange(position: Position, tokenRange: Ast.TokenRange): boolean {
    const tokenRangePositionStart: TokenPosition = tokenRange.positionStart;
    const tokenRangePositionEnd: TokenPosition = tokenRange.positionEnd;

    if (
        position.lineNumber < tokenRangePositionStart.lineNumber ||
        position.lineNumber > tokenRangePositionEnd.lineNumber
    ) {
        return false;
    } else if (
        position.lineNumber === tokenRangePositionStart.lineNumber &&
        position.lineCodeUnit < tokenRangePositionStart.lineCodeUnit
    ) {
        return false;
    } else if (
        position.lineNumber === tokenRangePositionEnd.lineNumber &&
        position.lineCodeUnit >= tokenRangePositionEnd.lineCodeUnit
    ) {
        return false;
    } else {
        return true;
    }
}

function isTokenPositionOnPosition(tokenPosition: TokenPosition, position: Position): boolean {
    return tokenPosition.lineNumber === position.lineNumber && tokenPosition.lineCodeUnit === position.lineCodeUnit;
}

function isTokenPositionBeforePostion(tokenPosition: TokenPosition, position: Position): boolean {
    return (
        tokenPosition.lineNumber < position.lineNumber ||
        (tokenPosition.lineNumber === position.lineNumber && tokenPosition.lineCodeUnit < position.lineCodeUnit)
    );
}

function isTokenPositionOnOrBeforeBeforePostion(tokenPosition: TokenPosition, position: Position): boolean {
    return isTokenPositionOnPosition(tokenPosition, position) || isTokenPositionBeforePostion(tokenPosition, position);
}

function addToScopeIfNew(state: State, key: string, xorNode: NodeIdMap.TXorNode): void {
    const scopeMap: Map<string, NodeIdMap.TXorNode> = state.result.scope;
    if (!scopeMap.has(key)) {
        scopeMap.set(key, xorNode);
    }
}

function addAstToScopeIfNew(state: State, key: string, astNode: Ast.TNode): void {
    addToScopeIfNew(state, key, {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: astNode,
    });
}

function addContextToScopeIfNew(state: State, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: NodeIdMap.XorNodeKind.Context,
        node: contextNode,
    });
}

// Takes an XorNode of Ast.NodeKind.CsvArray and returns CsvArray.elements.map(csv => csv.node),
// plus extra for TXorNode handling.
function nodesOnCsvFromCsvArray(
    nodeIdMapCollection: NodeIdMap.Collection,
    csvArrayXorNode: NodeIdMap.TXorNode,
): ReadonlyArray<NodeIdMap.TXorNode> {
    const csvXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMap.expectXorChildren(
        nodeIdMapCollection,
        csvArrayXorNode.node.id,
    );

    const result: NodeIdMap.TXorNode[] = [];
    for (const csvXorNode of csvXorNodes) {
        const maybeCsvNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
            nodeIdMapCollection,
            csvXorNode.node.id,
            0,
            undefined,
        );
        if (maybeCsvNode === undefined) {
            break;
        }

        const csvNode: NodeIdMap.TXorNode = maybeCsvNode;
        result.push(csvNode);
    }

    return result;
}
