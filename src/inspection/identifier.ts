// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InspectionUtils } from ".";
import { CommonError, isNever, Result, ResultKind } from "../common";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext, TXorNode, XorNodeKind } from "../parser";
import { InspectionSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { Position, PositionUtils } from "./position";
import { PositionIdentifierKind, TPositionIdentifier } from "./positionIdentifier";

// The inspection travels across ActiveNode.ancestry to build up a scope.
export interface IdentifierInspected {
    // The scope of a given position.
    //  '[x = 1, y = 2|, z = 3]'-> returns a scope of [['x', XorNode for 1], ['z', XorNode for 3]]
    scope: ReadonlyMap<string, TXorNode>;
    // Metadata on the deepest InvokeExpression encountered.
    //  'foo(bar(1, 2|), 3)' -> returns metadata for the 'bar' InvokeExpression
    //  'createLambda(x)(y, z|) -> returns metadata for the anonymous lambda returned by 'createLambda'.
    maybeInvokeExpression: InspectedInvokeExpression | undefined;
    // If the activeNode started on an identifier and we encounter the assignment of that identifier,
    // then we store the assignment here.
    maybeIdentifierUnderPosition: TPositionIdentifier | undefined;
}

export interface InspectedInvokeExpression {
    readonly xorNode: TXorNode;
    readonly maybeName: string | undefined;
    readonly maybeArguments: InvokeExpressionArgs | undefined;
}

export interface InvokeExpressionArgs {
    readonly numArguments: number;
    readonly positionArgumentIndex: number;
}

export function tryFrom(
    settings: InspectionSettings,
    maybeActiveNode: ActiveNode | undefined,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Result<IdentifierInspected, CommonError.CommonError> {
    if (maybeActiveNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultIdentifierInspection,
        };
    }
    const activeNode: ActiveNode = maybeActiveNode;

    // I know it looks weird that there are two maybeIdentifierUnderPosition fields.
    // The top level attribute is a map of ActiveNode.root to an identifier,
    // and the inner attribute is a map of (identifier, identifier assignment) if the identifier assignment is reached.
    const state: IdentifierState = {
        nodeIndex: 0,
        result: {
            scope: new Map(),
            maybeInvokeExpression: undefined,
            maybeIdentifierUnderPosition: undefined,
        },
        activeNode,
        nodeIdMapCollection,
        leafNodeIds,
    };

    try {
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        const numNodes: number = ancestry.length;
        for (let index: number = 0; index < numNodes; index += 1) {
            state.nodeIndex = index;
            const xorNode: TXorNode = ancestry[index];
            inspectNode(state, xorNode);
        }

        if (activeNode.maybeIdentifierUnderPosition && state.result.maybeIdentifierUnderPosition === undefined) {
            state.result.maybeIdentifierUnderPosition = {
                kind: PositionIdentifierKind.Undefined,
                identifier: activeNode.maybeIdentifierUnderPosition,
            };
        }

        return {
            kind: ResultKind.Ok,
            value: state.result,
        };
    } catch (err) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(settings.localizationTemplates, err),
        };
    }
}

interface IdentifierState {
    nodeIndex: number;
    readonly result: IdentifierInspected;
    readonly activeNode: ActiveNode;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

function inspectNode(state: IdentifierState, xorNode: TXorNode): void {
    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            inspectIdentifier(state, xorNode, true);
            break;

        case Ast.NodeKind.IdentifierExpression:
            inspectIdentifierExpression(state, xorNode, true);
            break;

        case Ast.NodeKind.IdentifierPairedExpression:
            break;

        case Ast.NodeKind.InvokeExpression:
            inspectInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode);
            break;

        case Ast.NodeKind.SectionMember:
            inspectSectionMember(state, xorNode);
            break;

        default:
            break;
    }
}

const DefaultIdentifierInspection: IdentifierInspected = {
    scope: new Map(),
    maybeInvokeExpression: undefined,
    maybeIdentifierUnderPosition: undefined,
};

// If you came from the TExpression in the EachExpression,
// then add '_' to the scope.
function inspectEachExpression(state: IdentifierState, eachExpr: TXorNode): void {
    const previous: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex);
    if (previous.node.maybeAttributeIndex !== 1) {
        return;
    }

    addToScopeIfNew(state, "_", eachExpr);
}

// If position is to the right of '=>',
// then add all parameter names to the scope.
function inspectFunctionExpression(state: IdentifierState, fnExpr: TXorNode): void {
    if (fnExpr.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExpr, Ast.NodeKind.FunctionExpression);
    }

    const previous: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex);
    if (previous.node.maybeAttributeIndex !== 3) {
        return;
    }

    // It's safe to expect an Ast.
    // All attributes would've had to been fully parsed before the expression body context was created,
    // and the previous check ensures that a TXorNode (either context or Ast) exists for the expression body.
    const parameters: Ast.IParameterList<
        Ast.AsNullablePrimitiveType | undefined
    > = NodeIdMapUtils.expectAstChildByAttributeIndex(state.nodeIdMapCollection, fnExpr.node.id, 0, [
        Ast.NodeKind.ParameterList,
    ]) as Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;

    for (const parameterCsv of parameters.content.elements) {
        const parameterName: Ast.Identifier = parameterCsv.node.name;
        addAstToScopeIfNew(state, parameterName.literal, parameterName);
    }
}

// Assumes the parent has already determined if the identifier should be added to the scope or not.
function inspectGeneralizedIdentifier(state: IdentifierState, genIdentifier: TXorNode): void {
    // Ignore the context case as the node has two possible states:
    // An empty context (no children), or an Ast.TNode instance.
    if (genIdentifier.kind === XorNodeKind.Ast) {
        if (genIdentifier.node.kind !== Ast.NodeKind.GeneralizedIdentifier) {
            throw expectedNodeKindError(genIdentifier, Ast.NodeKind.GeneralizedIdentifier);
        }

        const generalizedIdentifier: Ast.GeneralizedIdentifier = genIdentifier.node;
        addAstToScopeIfNew(state, generalizedIdentifier.literal, generalizedIdentifier);
    }
}

function inspectIdentifier(state: IdentifierState, identifier: TXorNode, isRoot: boolean): void {
    // Ignore the case of a Context node as there are two possible states:
    // An empty context (no children), or an Ast.TNode instance.
    // Both have no identifier attached to it.
    //
    // Ignore the case of where the parent is an IdentifierExpression as the parent handle adding to the scope.
    if (identifier.kind !== XorNodeKind.Ast || isParentOfNodeKind(state, Ast.NodeKind.IdentifierExpression)) {
        return;
    }

    if (identifier.node.kind !== Ast.NodeKind.Identifier) {
        throw expectedNodeKindError(identifier, Ast.NodeKind.Identifier);
    }
    const identifierAstNode: Ast.Identifier = identifier.node;

    // Don't add the identifier to scope if it's the root and position is before the identifier starts.
    // 'a +| b'
    // '|foo'
    const position: Position = state.activeNode.position;
    if (isRoot && PositionUtils.isBeforeAstNode(position, identifierAstNode, true)) {
        return;
    }
    addAstToScopeIfNew(state, identifierAstNode.literal, identifierAstNode);
}

function inspectIdentifierExpression(state: IdentifierState, identifierExpr: TXorNode, isLeaf: boolean): void {
    // Don't add the identifier to scope if it's the leaf,
    // and if the position is before the start of the identifier.
    // 'a +| b'
    // '|foo'
    if (isLeaf && PositionUtils.isBeforeXorNode(state.activeNode.position, identifierExpr, false)) {
        return;
    }

    switch (identifierExpr.kind) {
        case XorNodeKind.Ast: {
            if (identifierExpr.node.kind !== Ast.NodeKind.IdentifierExpression) {
                throw expectedNodeKindError(identifierExpr, Ast.NodeKind.IdentifierExpression);
            }

            const identifierExprAstNode: Ast.IdentifierExpression = identifierExpr.node;
            const identifier: Ast.Identifier = identifierExprAstNode.identifier;
            const maybeInclusiveConstant: Ast.Constant | undefined = identifierExprAstNode.maybeInclusiveConstant;

            const key: string =
                maybeInclusiveConstant !== undefined
                    ? maybeInclusiveConstant.constantKind + identifier.literal
                    : identifier.literal;
            addAstToScopeIfNew(state, key, identifierExprAstNode);
            break;
        }

        case XorNodeKind.Context: {
            let key: string = "";
            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

            // Add the optional inclusive constant `@` if it was parsed.
            const maybeInclusiveConstant: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExpr.node.id,
                0,
                [Ast.NodeKind.Constant],
            );
            if (maybeInclusiveConstant !== undefined) {
                const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
                // Adds the '@' prefix.
                key = inclusiveConstant.constantKind;
            }

            const maybeIdentifier: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExpr.node.id,
                1,
                [Ast.NodeKind.Identifier],
            );
            if (maybeIdentifier !== undefined) {
                const identifier: Ast.Identifier = maybeIdentifier.node as Ast.Identifier;
                key += identifier.literal;
            }

            if (key.length) {
                addContextToScopeIfNew(state, key, identifierExpr.node);
            }

            break;
        }

        default:
            throw isNever(identifierExpr);
    }
}

function inspectInvokeExpression(state: IdentifierState, invokeExpr: TXorNode): void {
    if (invokeExpr.node.kind !== Ast.NodeKind.InvokeExpression) {
        throw expectedNodeKindError(invokeExpr, Ast.NodeKind.InvokeExpression);
    }
    // maybeInvokeExpression should be assigned using the deepest (first) InvokeExpression.
    // Since an InvokeExpression inspection doesn't add anything else, such as to scope, we can return early.
    // Eg.
    // `foo(a, bar(b, c|))` -> first inspectInvokeExpression, sets maybeInvokeExpression
    // `foo(a|, bar(b, c))` -> second inspectInvokeExpression, early exit
    else if (state.result.maybeInvokeExpression !== undefined) {
        return;
    }

    // Check if position is in the wrapped contents (InvokeExpression arguments).
    if (invokeExpr.kind === XorNodeKind.Ast) {
        const invokeExprAstNode: Ast.InvokeExpression = invokeExpr.node as Ast.InvokeExpression;
        if (!PositionUtils.isInAstNode(state.activeNode.position, invokeExprAstNode.content, true, true)) {
            return;
        }
    }

    const maybeName: string | undefined = NodeIdMapUtils.maybeInvokeExpressionName(
        state.nodeIdMapCollection,
        invokeExpr.node.id,
    );
    state.result.maybeInvokeExpression = {
        xorNode: invokeExpr,
        maybeName,
        maybeArguments: inspectInvokeExpressionArguments(state, invokeExpr),
    };
}

function inspectInvokeExpressionArguments(state: IdentifierState, _: TXorNode): InvokeExpressionArgs | undefined {
    // Grab arguments if they exist, else return early.
    const maybeCsvArray: TXorNode | undefined = ActiveNodeUtils.maybePreviousXorNode(
        state.activeNode,
        state.nodeIndex,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeCsvArray === undefined) {
        return undefined;
    }
    // const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    // const position: Position = state.activeNode.position;
    const csvArray: TXorNode = maybeCsvArray;
    const csvNodes: ReadonlyArray<TXorNode> = NodeIdMapUtils.expectXorChildren(
        state.nodeIdMapCollection,
        csvArray.node.id,
    );
    const numArguments: number = csvNodes.length;

    const maybeAncestorCsv: TXorNode | undefined = ActiveNodeUtils.maybePreviousXorNode(
        state.activeNode,
        state.nodeIndex,
        2,
        [Ast.NodeKind.Csv],
    );
    const maybePositionArgumentIndex: number | undefined =
        maybeAncestorCsv !== undefined ? maybeAncestorCsv.node.maybeAttributeIndex : undefined;

    return {
        numArguments,
        positionArgumentIndex: maybePositionArgumentIndex !== undefined ? maybePositionArgumentIndex : 0,
    };
}

// If position is to the right of an equals sign,
// then add all keys to the scope EXCEPT for the key that the position is under.
function inspectLetExpression(state: IdentifierState, letExpr: TXorNode): void {
    const maybePreviousAttributeIndex: number | undefined = ActiveNodeUtils.expectPreviousXorNode(
        state.activeNode,
        state.nodeIndex,
    ).node.maybeAttributeIndex;
    if (maybePreviousAttributeIndex !== 3 && !InspectionUtils.isInKeyValuePairAssignment(state)) {
        return;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    let csvArray: TXorNode;
    let maybeAncestorKeyValuePair: TXorNode | undefined;
    // If ancestor is an expression
    if (maybePreviousAttributeIndex === 3) {
        csvArray = NodeIdMapUtils.expectXorChildByAttributeIndex(nodeIdMapCollection, letExpr.node.id, 1, [
            Ast.NodeKind.ArrayWrapper,
        ]);
        maybeAncestorKeyValuePair = undefined;
    } else {
        csvArray = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex, 1, [
            Ast.NodeKind.ArrayWrapper,
        ]);
        maybeAncestorKeyValuePair = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex, 3, [
            Ast.NodeKind.IdentifierPairedExpression,
        ]);
    }

    for (const keyValuePair of xorNodesOnCsvFromCsvArray(nodeIdMapCollection, csvArray)) {
        if (maybeAncestorKeyValuePair && maybeAncestorKeyValuePair.node.id === keyValuePair.node.id) {
            continue;
        }

        const keyValuePairId: number = keyValuePair.node.id;
        const maybeKey: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeKey === undefined) {
            continue;
        }
        const key: TXorNode = maybeKey;
        inspectIdentifier(state, key, false);

        const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            2,
            undefined,
        );
        if (maybeValue) {
            const value: TXorNode = maybeValue;
            maybeSetIdentifierUnderPositionResult(state, key, value);
        }
    }
}

// If position is to the right of an equals sign,
// then add all keys to scope EXCEPT for the one the that position is under.
function inspectRecordExpressionOrRecordLiteral(state: IdentifierState, _: TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    // Only add to scope if you're in the right hand of an assignment.
    if (!InspectionUtils.isInKeyValuePairAssignment(state)) {
        return;
    }

    const csvArray: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex, 1, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    const keyValuePair: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex, 3, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
    ]);

    for (const csv of xorNodesOnCsvFromCsvArray(nodeIdMapCollection, csvArray)) {
        const nodeId: number = csv.node.id;

        // If position is under this node then don't add it's key to the scope.
        if (csv.node.id === keyValuePair.node.id) {
            continue;
        }

        const maybeKey: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            nodeId,
            0,
            [Ast.NodeKind.GeneralizedIdentifier],
        );
        if (maybeKey === undefined) {
            continue;
        }
        const key: TXorNode = maybeKey;
        inspectGeneralizedIdentifier(state, key);

        const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            nodeId,
            2,
            undefined,
        );
        if (maybeValue) {
            const value: TXorNode = maybeValue;
            maybeSetIdentifierUnderPositionResult(state, key, value);
        }
    }
}

function inspectSectionMember(state: IdentifierState, sectionMember: TXorNode): void {
    if (!InspectionUtils.isInKeyValuePairAssignment(state)) {
        return;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const sectionMemberArray: TXorNode = ActiveNodeUtils.expectNextXorNode(state.activeNode, state.nodeIndex, 1, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    const sectionMembers: ReadonlyArray<TXorNode> = NodeIdMapUtils.expectXorChildren(
        nodeIdMapCollection,
        sectionMemberArray.node.id,
    );
    for (const iterSectionMember of sectionMembers) {
        // Ignore if it's the current SectionMember.
        if (iterSectionMember.node.id === sectionMember.node.id) {
            continue;
        }

        const maybeKeyValuePair: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            iterSectionMember.node.id,
            2,
            [Ast.NodeKind.IdentifierPairedExpression],
        );
        if (maybeKeyValuePair === undefined) {
            continue;
        }
        const keyValuePair: TXorNode = maybeKeyValuePair;

        // Add name to scope.
        const maybeName: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeName === undefined) {
            continue;
        }
        const name: TXorNode = maybeName;
        if (name.kind === XorNodeKind.Ast && name.node.kind === Ast.NodeKind.Identifier) {
            addToScopeIfNew(state, name.node.literal, keyValuePair);
        }

        const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            2,
            undefined,
        );
        if (maybeValue !== undefined) {
            const value: TXorNode = maybeValue;
            maybeSetIdentifierUnderPositionResult(state, name, value);
        }
    }
}

function expectedNodeKindError(xorNode: TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
    const details: {} = {
        xorNodeId: xorNode.node.id,
        expectedNodeKind: expected,
        actualNodeKind: xorNode.node.kind,
    };
    return new CommonError.InvariantError(`expected xorNode to be of kind ${expected}`, details);
}

function isParentOfNodeKind(state: IdentifierState, parentNodeKind: Ast.NodeKind): boolean {
    const maybeParent: TXorNode | undefined = ActiveNodeUtils.maybeNextXorNode(state.activeNode, state.nodeIndex);
    return maybeParent !== undefined ? maybeParent.node.kind === parentNodeKind : false;
}

function addToScopeIfNew(state: IdentifierState, key: string, xorNode: TXorNode): void {
    const scopeMap: Map<string, TXorNode> = state.result.scope as Map<string, TXorNode>;
    if (!scopeMap.has(key)) {
        scopeMap.set(key, xorNode);
    }
}

function addAstToScopeIfNew(state: IdentifierState, key: string, astNode: Ast.TNode): void {
    addToScopeIfNew(state, key, {
        kind: XorNodeKind.Ast,
        node: astNode,
    });
}

function addContextToScopeIfNew(state: IdentifierState, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: XorNodeKind.Context,
        node: contextNode,
    });
}

function maybeSetIdentifierUnderPositionResult(state: IdentifierState, key: TXorNode, value: TXorNode): void {
    if (
        // Nothing to assign as position wasn't on an identifier
        state.activeNode.maybeIdentifierUnderPosition === undefined ||
        // Already assigned the result
        state.result.maybeIdentifierUnderPosition !== undefined
    ) {
        return;
    }
    if (key.kind !== XorNodeKind.Ast) {
        const details: {} = { keyXorNode: key };
        throw new CommonError.InvariantError(`keyXorNode should be an Ast node`, details);
    }

    const keyAstNode: Ast.TNode = key.node;
    if (keyAstNode.kind !== Ast.NodeKind.GeneralizedIdentifier && keyAstNode.kind !== Ast.NodeKind.Identifier) {
        const details: {} = { keyAstNodeKind: keyAstNode.kind };
        throw new CommonError.InvariantError(
            `keyAstNode is neither ${Ast.NodeKind.GeneralizedIdentifier} nor ${Ast.NodeKind.Identifier}`,
            details,
        );
    }
    const keyIdentifier: Ast.GeneralizedIdentifier | Ast.Identifier = keyAstNode;

    if (keyIdentifier.literal === state.activeNode.maybeIdentifierUnderPosition.literal) {
        state.result.maybeIdentifierUnderPosition = {
            kind: PositionIdentifierKind.Local,
            identifier: keyIdentifier,
            definition: value,
        };
    }
}

// Takes an XorNode TCsvArray and returns collection.elements.map(csv => csv.node),
// plus extra boilerplate to handle TXorNode.
function xorNodesOnCsvFromCsvArray(
    nodeIdMapCollection: NodeIdMap.Collection,
    csvArray: TXorNode,
): ReadonlyArray<TXorNode> {
    const csvNodes: ReadonlyArray<TXorNode> = NodeIdMapUtils.expectXorChildren(nodeIdMapCollection, csvArray.node.id);

    const result: TXorNode[] = [];
    for (const csv of csvNodes) {
        const maybeCsvNode: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            csv.node.id,
            0,
            undefined,
        );
        if (maybeCsvNode === undefined) {
            break;
        }

        const csvNode: TXorNode = maybeCsvNode;
        result.push(csvNode);
    }

    return result;
}
