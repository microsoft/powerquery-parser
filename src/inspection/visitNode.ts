// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Node } from ".";
import { CommonError, isNever, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { Position, State } from "./inspection";
import { PositionIdentifierKind } from "./positionIdentifier";

export function visitNode(state: State, xorNode: NodeIdMap.TXorNode): void {
    state.visitedNodes.push(xorNode);
    state.result.nodes.push(Node.basicInspectedNodeFrom(xorNode));

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

        case Ast.NodeKind.IdentifierPairedExpression:
            inspectIdentifierPairedExpression(state, xorNode);
            break;

        case Ast.NodeKind.InvokeExpression:
            inspectInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode);
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
}

function inspectFunctionExpression(state: State, fnExpressionXorNode: NodeIdMap.TXorNode): void {
    if (fnExpressionXorNode.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExpressionXorNode, Ast.NodeKind.FunctionExpression);
    }

    const drilldownToCsvArrayRequest: NodeIdMap.RepeatedAttributeIndexRequest = {
        nodeIdMapCollection: state.nodeIdMapCollection,
        firstDrilldown: {
            rootNodeId: fnExpressionXorNode.node.id,
            attributeIndex: 0,
            maybeAllowedNodeKinds: [Ast.NodeKind.ParameterList],
        },
        drilldowns: [
            {
                attributeIndex: 1,
                maybeAllowedNodeKinds: [Ast.NodeKind.ArrayWrapper],
            },
        ],
    };
    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByRepeatedAttributeIndex(
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
            const maybeInclusiveConstant: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExprXorNode.node.id,
                0,
                [Ast.NodeKind.Constant],
            );
            if (maybeInclusiveConstant !== undefined) {
                const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
                key += inclusiveConstant.literal;
            }

            const maybeIdentifier: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
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

function inspectIdentifierPairedExpression(state: State, identifierPairedExpressionNode: NodeIdMap.TXorNode): void {
    if (identifierPairedExpressionNode.node.kind !== Ast.NodeKind.IdentifierPairedExpression) {
        throw expectedNodeKindError(identifierPairedExpressionNode, Ast.NodeKind.IdentifierPairedExpression);
    }

    // We want to exclude keys for assignment expressions from result.scope.
    // TODO: special handling for recursion (@).
    if (identifierPairedExpressionNode.kind === NodeIdMap.XorNodeKind.Ast) {
        const identifierPairedExpr: Ast.IdentifierPairedExpression = identifierPairedExpressionNode.node as Ast.IdentifierPairedExpression;
        state.assignmentKeyNodeIdMap.set(identifierPairedExpr.key.id, identifierPairedExpr.key);
    }
}

function inspectInvokeExpression(state: State, invokeExprXorNode: NodeIdMap.TXorNode): void {
    if (invokeExprXorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        throw expectedNodeKindError(invokeExprXorNode, Ast.NodeKind.InvokeExpression);
    }
    // No need to further an invoke inspection if one was already created lower down in the AST.
    else if (state.result.maybeInvokeExpression !== undefined) {
        return;
    }

    // Check if position is on closeWrapperConstant (')').
    // The check isn't needed for a context node as the final attribute is the closeWrapperConstant,
    // and as it's a context node it hasn't parsed all attributes.
    if (invokeExprXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        const invokeExpr: Ast.InvokeExpression = invokeExprXorNode.node as Ast.InvokeExpression;
        if (isTokenPositionOnPosition(invokeExpr.closeWrapperConstant.tokenRange.positionEnd, state.position)) {
            return;
        }
    }

    const maybeName: Option<string> = NodeIdMap.maybeInvokeExpressionName(
        state.nodeIdMapCollection,
        invokeExprXorNode.node.id,
    );
    let maybePositionStart: Option<TokenPosition>;
    let maybePositionEnd: Option<TokenPosition>;
    switch (invokeExprXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const tokenRange: Ast.TokenRange = invokeExprXorNode.node.tokenRange;
            maybePositionStart = tokenRange.positionStart;
            maybePositionEnd = tokenRange.positionEnd;
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const invokeExpr: ParserContext.Node = invokeExprXorNode.node;
            maybePositionStart =
                invokeExpr.maybeTokenStart !== undefined ? invokeExpr.maybeTokenStart.positionStart : undefined;
            maybePositionEnd = undefined;
            break;
        }

        default:
            throw isNever(invokeExprXorNode);
    }

    state.result.maybeInvokeExpression = {
        kind: Ast.NodeKind.InvokeExpression,
        id: invokeExprXorNode.node.id,
        maybePositionEnd,
        maybePositionStart,
        maybeName,
        maybeArguments: inspectInvokeExpressionArguments(state, invokeExprXorNode),
    };
}

function inspectInvokeExpressionArguments(
    state: State,
    invokeExprXorNode: NodeIdMap.TXorNode,
): Option<Node.InvokeExpressionArguments> {
    // Grab arguments if they exist.
    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        invokeExprXorNode.node.id,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return undefined;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const position: Position = state.position;
    const csvXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMap.expectXorChildren(
        state.nodeIdMapCollection,
        csvArrayXorNode.node.id,
    );
    const numArguments: number = csvXorNodes.length;

    let maybePositionArgumentIndex: Option<number>;
    for (let index: number = 0; index < numArguments; index += 1) {
        const csvXorNode: NodeIdMap.TXorNode = csvXorNodes[index];

        // Conditionally add argument name to scope.
        // Has to be this awkward as `foo(@|` is possible.
        const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            csvXorNode.node.id,
            0,
            undefined,
        );
        if (maybeNameXorNode !== undefined && maybeNameXorNode.node.kind === Ast.NodeKind.IdentifierExpression) {
            const nameXorNode: NodeIdMap.TXorNode = maybeNameXorNode;
            inspectIdentifierExpression(state, nameXorNode);
        }

        // Conditionally set maybePositionArgumentIndex.
        // If position is on a comma then count it as belonging to the next index.
        // Eg. `foo(a,|)` is in the second index.
        if (isPositionOnXorNode(position, csvXorNode)) {
            if (csvXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
                const maybeCommaConstant: Option<Ast.Constant> = NodeIdMap.maybeAstChildByAttributeIndex(
                    nodeIdMapCollection,
                    csvXorNode.node.id,
                    1,
                    [Ast.NodeKind.Constant],
                ) as Option<Ast.Constant>;
                if (
                    maybeCommaConstant &&
                    isTokenPositionOnPosition(maybeCommaConstant.tokenRange.positionEnd, position)
                ) {
                    maybePositionArgumentIndex = index + 1;
                } else {
                    maybePositionArgumentIndex = index;
                }
            } else {
                maybePositionArgumentIndex = index;
            }
        }
    }

    return {
        numArguments,
        positionArgumentIndex: maybePositionArgumentIndex !== undefined ? maybePositionArgumentIndex : 0,
    };
}

function inspectLetExpression(state: State, letExprXorNode: NodeIdMap.TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        letExprXorNode.node.id,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    for (const keyValuePairXorNode of nodesOnCsvFromCsvArray(nodeIdMapCollection, csvArrayXorNode)) {
        const keyValuePairId: number = keyValuePairXorNode.node.id;

        const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeKeyXorNode === undefined) {
            continue;
        }
        const keyXorNode: NodeIdMap.TXorNode = maybeKeyXorNode;

        if (keyXorNode.kind === NodeIdMap.XorNodeKind.Ast && keyXorNode.node.kind === Ast.NodeKind.Identifier) {
            // Add identifiers to current scope, excluding the current paired expression
            if (!state.assignmentKeyNodeIdMap.has(keyXorNode.node.id)) {
                addToScopeIfNew(state, keyXorNode.node.literal, keyValuePairXorNode);
            }
        }

        const maybeValueXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            2,
            undefined,
        );
        if (maybeValueXorNode) {
            const valueXorNode: NodeIdMap.TXorNode = maybeValueXorNode;
            maybeSetPositionIdentifier(state, keyXorNode, valueXorNode);
        }
    }
}

function inspectParameter(state: State, parameterXorNode: NodeIdMap.TXorNode): void {
    const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
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

    if (recordXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        const record: Ast.RecordExpression | Ast.RecordLiteral = recordXorNode.node as
            | Ast.RecordExpression
            | Ast.RecordLiteral;
        const position: Position = state.position;
        // Don't inspect the contents for scope if the cursor is on the right hand side of the close record constant.
        if (
            isTokenPositionOnPosition(record.closeWrapperConstant.tokenRange.positionEnd, position) ||
            isRootNode(state, record.closeWrapperConstant)
        ) {
            return;
        }
    }

    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        recordXorNode.node.id,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    for (const keyValuePairXorNode of nodesOnCsvFromCsvArray(nodeIdMapCollection, csvArrayXorNode)) {
        const keyValuePairId: number = keyValuePairXorNode.node.id;

        const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            0,
            [Ast.NodeKind.GeneralizedIdentifier],
        );
        if (maybeKeyXorNode === undefined) {
            continue;
        }
        const keyXorNode: NodeIdMap.TXorNode = maybeKeyXorNode;
        inspectGeneralizedIdentifier(state, keyXorNode);

        const maybeValueXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            2,
            undefined,
        );
        if (maybeValueXorNode) {
            const valueXorNode: NodeIdMap.TXorNode = maybeValueXorNode;
            maybeSetPositionIdentifier(state, keyXorNode, valueXorNode);
        }
    }
}

function inspectRecursivePrimaryExpression(state: State, recursivePrimaryExprXorNode: NodeIdMap.TXorNode): void {
    const maybeHeadXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
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

    const maybeSectionMemberArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        sectionXorNode.node.id,
        4,
        [Ast.NodeKind.ArrayWrapper],
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
        const maybeIdentifierPairedExprXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            sectionMember.node.id,
            2,
            [Ast.NodeKind.IdentifierPairedExpression],
        );
        if (maybeIdentifierPairedExprXorNode === undefined) {
            continue;
        }
        const identifierPairedExprXorNode: NodeIdMap.TXorNode = maybeIdentifierPairedExprXorNode;
        const identifierPairedExprId: number = identifierPairedExprXorNode.node.id;

        const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            identifierPairedExprId,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeNameXorNode === undefined) {
            continue;
        }
        const nameXorNode: NodeIdMap.TXorNode = maybeNameXorNode;
        if (nameXorNode.kind === NodeIdMap.XorNodeKind.Ast && nameXorNode.node.kind === Ast.NodeKind.Identifier) {
            // Add identifiers to current scope, excluding the current paired expression
            if (!state.assignmentKeyNodeIdMap.has(nameXorNode.node.id)) {
                addToScopeIfNew(state, nameXorNode.node.literal, identifierPairedExprXorNode);
            }
        }

        const maybeValueXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            identifierPairedExprId,
            2,
            undefined,
        );

        if (maybeValueXorNode) {
            const valueXorNode: NodeIdMap.TXorNode = maybeValueXorNode;
            maybeSetPositionIdentifier(state, nameXorNode, valueXorNode);
        }
    }
}

function expectedNodeKindError(xorNode: NodeIdMap.TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
    const details: {} = {
        xorNodeId: xorNode.node.id,
        expectedNodeKind: expected,
        actualNodeKind: xorNode.node.kind,
    };
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

function isTokenPositionOnPosition(tokenPosition: TokenPosition, position: Position): boolean {
    return tokenPosition.lineNumber === position.lineNumber && tokenPosition.lineCodeUnit === position.lineCodeUnit;
}

function isTokenPositionBeforePosition(tokenPosition: TokenPosition, position: Position): boolean {
    return (
        tokenPosition.lineNumber < position.lineNumber ||
        (tokenPosition.lineNumber === position.lineNumber && tokenPosition.lineCodeUnit < position.lineCodeUnit)
    );
}

function isPositionOnXorNode(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionInTokenRange(position, xorNode.node.tokenRange);

        case NodeIdMap.XorNodeKind.Context:
            return true;

        default:
            throw isNever(xorNode);
    }
}

function isPositionInTokenRange(position: Position, tokenRange: Ast.TokenRange): boolean {
    const tokenRangeStart: TokenPosition = tokenRange.positionStart;
    if (
        tokenRangeStart.lineNumber < position.lineNumber ||
        (tokenRangeStart.lineNumber === position.lineNumber && tokenRangeStart.lineCodeUnit > position.lineCodeUnit)
    ) {
        return false;
    }

    const tokenRangeEnd: TokenPosition = tokenRange.positionEnd;
    if (
        tokenRangeEnd.lineNumber > position.lineNumber ||
        (tokenRangeEnd.lineNumber === position.lineNumber && tokenRangeEnd.lineCodeUnit < position.lineCodeUnit)
    ) {
        return false;
    }

    return true;
}

function isTokenPositionOnOrBeforeBeforePostion(tokenPosition: TokenPosition, position: Position): boolean {
    return isTokenPositionOnPosition(tokenPosition, position) || isTokenPositionBeforePosition(tokenPosition, position);
}

function addToScopeIfNew(state: State, key: string, xorNode: NodeIdMap.TXorNode): void {
    if (!state.assignmentKeyNodeIdMap.has(xorNode.node.id)) {
        const scopeMap: Map<string, NodeIdMap.TXorNode> = state.result.scope;
        if (!scopeMap.has(key)) {
            scopeMap.set(key, xorNode);
        }
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

// Takes an XorNode TCsvArray and returns collection.elements.map(csv => csv.node),
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
        const maybeCsvNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorChildByAttributeIndex(
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

function maybeSetPositionIdentifier(
    state: State,
    keyXorNode: NodeIdMap.TXorNode,
    valueXorNode: NodeIdMap.TXorNode,
): void {
    if (
        // Nothing to assign as position wasn't on an identifier
        state.maybePositionIdentifier === undefined ||
        // Already assigned the result
        state.result.maybePositionIdentifier !== undefined
    ) {
        return;
    }
    if (keyXorNode.kind !== NodeIdMap.XorNodeKind.Ast) {
        const details: {} = { keyXorNode };
        throw new CommonError.InvariantError(`keyXorNode should be an Ast node`, details);
    }

    const keyAstNode: Ast.TNode = keyXorNode.node;
    if (keyAstNode.kind !== Ast.NodeKind.GeneralizedIdentifier && keyAstNode.kind !== Ast.NodeKind.Identifier) {
        const details: {} = { keyAstNodeKind: keyAstNode.kind };
        throw new CommonError.InvariantError(
            `keyAstNode is neither ${Ast.NodeKind.GeneralizedIdentifier} nor ${Ast.NodeKind.Identifier}`,
            details,
        );
    }
    const key: Ast.GeneralizedIdentifier | Ast.Identifier = keyAstNode;

    if (key.literal === state.maybePositionIdentifier.literal) {
        state.result.maybePositionIdentifier = {
            kind: PositionIdentifierKind.Local,
            identifier: key,
            definition: valueXorNode,
        };
    }
}

function isRootXorNode(state: State, xorNode: NodeIdMap.TXorNode): boolean {
    return xorNode.node.id === state.visitedNodes[0].node.id;
}

function isRootNode(state: State, node: Ast.TNode): boolean {
    return node.id === state.visitedNodes[0].node.id;
}
