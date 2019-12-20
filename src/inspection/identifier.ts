// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, CommonError, isNever, Option, ResultKind, Traverse, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";
import { IInspectedNode, InvokeExpressionArgs } from "./node";
import {
    isPositionAfterTokenPosition,
    isPositionAfterXorNode,
    isPositionOnAstNode,
    isPositionOnXorNode,
    Position,
} from "./position";
import { PositionIdentifierKind } from "./positionIdentifier";
import { IdentifierInspected, IdentifierState } from "./state";

import * as InspectionUtils from "./inspectionUtils";

// This inspection selects the closest leaf node, then recursively traveling up the node's parents.
// It tracks what identifiers are within scope, and what value was used in their assignment (if available).

// TODO: maybeInvokeExpression should be split into its own inspection.

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedTraverse<TypeUtils.StripReadonly<IdentifierInspected>> {
    const maybeClosestLeaf: Option<Ast.TNode> = InspectionUtils.maybeClosestAstNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (maybeClosestLeaf === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultIdentifierInspection,
        };
    }

    const closestLeaf: Ast.TNode = maybeClosestLeaf;
    const root: NodeIdMap.TXorNode = {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: closestLeaf,
    };

    const state: IdentifierState = {
        result: {
            identifierVisitedNodes: [],
            scope: new Map(),
            maybeInvokeExpression: undefined,
            maybeIdentifierUnderPosition: undefined,
        },
        // COMMON
        position,
        nodeIdMapCollection,
        leafNodeIds,

        // IDENTIFIER INSPECTION
        // Storage for if position is on an (Identifier | GeneralizedIdentifier).
        maybeIdentifierUnderPosition: InspectionUtils.maybeIdentifierOnPostion(
            position,
            nodeIdMapCollection,
            closestLeaf,
        ),
    };

    const triedTraverse: TriedTraverse<TypeUtils.StripReadonly<IdentifierInspected>> = Traverse.tryTraverseXor<
        IdentifierState,
        TypeUtils.StripReadonly<IdentifierInspected>
    >(
        state,
        nodeIdMapCollection,
        root,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        Traverse.maybeExpandXorParent,
        undefined,
    );
    // If position is on an identifier but the identifier's definition wasn't found during the inspection,
    // then create an UndefinedIdentifier for maybeIdentifierUnderPosition.
    if (
        triedTraverse.kind === ResultKind.Ok &&
        state.maybeIdentifierUnderPosition &&
        state.result.maybeIdentifierUnderPosition === undefined
    ) {
        return {
            kind: ResultKind.Ok,
            value: {
                ...triedTraverse.value,
                maybeIdentifierUnderPosition: {
                    kind: PositionIdentifierKind.Undefined,
                    identifier: state.maybeIdentifierUnderPosition,
                },
            },
        };
    } else {
        return triedTraverse;
    }
}

function visitNode(state: IdentifierState, xorNode: NodeIdMap.TXorNode): void {
    const visitedNodes: IInspectedNode[] = state.result.identifierVisitedNodes as IInspectedNode[];
    visitedNodes.push(InspectionUtils.inspectedVisitedNodeFrom(xorNode));

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

        case Ast.NodeKind.Section:
            inspectSection(state, xorNode);
            break;

        default:
            break;
    }
}

const DefaultIdentifierInspection: IdentifierInspected = {
    identifierVisitedNodes: [],
    scope: new Map(),
    maybeInvokeExpression: undefined,
    maybeIdentifierUnderPosition: undefined,
};

function inspectEachExpression(state: IdentifierState, eachExprXorNode: NodeIdMap.TXorNode): void {
    const maybeEachConstantXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        eachExprXorNode.node.id,
        0,
        undefined,
    );
    if (maybeEachConstantXorNode === undefined) {
        return;
    }
    const eachConstantXorNode: NodeIdMap.TXorNode = maybeEachConstantXorNode;

    if (isPositionAfterXorNode(state.position, state.nodeIdMapCollection, eachConstantXorNode)) {
        addToScopeIfNew(state, "_", eachExprXorNode);
    }
}

// If position is to the right of a fat arrow,
// then add all parameter names to the scope.
function inspectFunctionExpression(state: IdentifierState, fnExprXorNode: NodeIdMap.TXorNode): void {
    if (fnExprXorNode.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExprXorNode, Ast.NodeKind.FunctionExpression);
    }

    // Parameter names are added to scope only if position is in the expression body.
    // Eg. of positions that would NOT add to the scope.
    // `(x|, y) => x + y`
    // `(x, y)| => x + y`
    const maybeExprXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        fnExprXorNode.node.id,
        3,
        undefined,
    );
    if (maybeExprXorNode === undefined) {
        return;
    }

    // It's safe to expect an Ast.
    // All attributes would've had to been fully parsed before the expression body context was created,
    // and the previous check ensures that a TXorNode (either context or Ast) exists for the expression body.
    const parameters: Ast.IParameterList<
        Option<Ast.AsNullablePrimitiveType>
    > = NodeIdMapUtils.expectAstChildByAttributeIndex(state.nodeIdMapCollection, fnExprXorNode.node.id, 0, [
        Ast.NodeKind.ParameterList,
    ]) as Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>>;

    if (isPositionOnAstNode(state.position, parameters)) {
        return;
    }

    for (const parameterCsv of parameters.content.elements) {
        const parameterName: Ast.Identifier = parameterCsv.node.name;
        addAstToScopeIfNew(state, parameterName.literal, parameterName);
    }
}

// Assumes the parent has already determined if the identifier should be added to the scope or not.
function inspectGeneralizedIdentifier(state: IdentifierState, genIdentifierXorNode: NodeIdMap.TXorNode): void {
    // Ignore the context case as the node has two possible states:
    // An empty context (no children), or an Ast.TNode instance.
    if (genIdentifierXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        if (genIdentifierXorNode.node.kind !== Ast.NodeKind.GeneralizedIdentifier) {
            throw expectedNodeKindError(genIdentifierXorNode, Ast.NodeKind.GeneralizedIdentifier);
        }

        const generalizedIdentifier: Ast.GeneralizedIdentifier = genIdentifierXorNode.node;
        addAstToScopeIfNew(state, generalizedIdentifier.literal, generalizedIdentifier);
    }
}

function inspectIdentifier(state: IdentifierState, identifierXorNode: NodeIdMap.TXorNode): void {
    // Ignore the context case as the node has two possible states:
    // An empty context (no children), or an Ast.TNode instance.
    if (identifierXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        if (identifierXorNode.node.kind !== Ast.NodeKind.Identifier) {
            throw expectedNodeKindError(identifierXorNode, Ast.NodeKind.Identifier);
        }

        const identifier: Ast.Identifier = identifierXorNode.node;
        if (isParentOfNodeKind(state.nodeIdMapCollection, identifier.id, Ast.NodeKind.IdentifierExpression)) {
            return;
        }
        addAstToScopeIfNew(state, identifier.literal, identifier);
    }
}

function inspectIdentifierExpression(state: IdentifierState, identifierExprXorNode: NodeIdMap.TXorNode): void {
    switch (identifierExprXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            if (identifierExprXorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
                throw expectedNodeKindError(identifierExprXorNode, Ast.NodeKind.IdentifierExpression);
            }

            const identifierExpr: Ast.IdentifierExpression = identifierExprXorNode.node;
            const identifier: Ast.Identifier = identifierExpr.identifier;
            const maybeInclusiveConstant: Option<Ast.Constant> = identifierExpr.maybeInclusiveConstant;

            const key: string =
                maybeInclusiveConstant !== undefined
                    ? maybeInclusiveConstant.literal + identifier.literal
                    : identifier.literal;
            addAstToScopeIfNew(state, key, identifierExpr);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            let key: string = "";
            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

            // Add the optional inclusive constant `@` if it was parsed.
            const maybeInclusiveConstant: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExprXorNode.node.id,
                0,
                [Ast.NodeKind.Constant],
            );
            if (maybeInclusiveConstant !== undefined) {
                const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
                key += inclusiveConstant.literal;
            }

            const maybeIdentifier: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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

function inspectInvokeExpression(state: IdentifierState, invokeExprXorNode: NodeIdMap.TXorNode): void {
    if (invokeExprXorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        throw expectedNodeKindError(invokeExprXorNode, Ast.NodeKind.InvokeExpression);
    }
    // maybeInvokeExpression should be assigned using the deepest (first) InvokeExpression.
    // Since an InvokeExpression inspection doesn't add anything else, such as to scope, we can return early.
    // Eg.
    // `foo(a, bar(b, c|))` -> first inspectInvokeExpression, sets maybeInvokeExpression
    // `foo(a|, bar(b, c))` -> second inspectInvokeExpression, early exit
    else if (state.result.maybeInvokeExpression !== undefined) {
        return;
    }

    // Check if position is on closeWrapperConstant (')').
    // The check isn't needed for a context node as the final attribute is the closeWrapperConstant,
    // and as it's a context node it hasn't parsed all attributes.
    if (invokeExprXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        const invokeExpr: Ast.InvokeExpression = invokeExprXorNode.node as Ast.InvokeExpression;
        if (isPositionOnAstNode(state.position, invokeExpr.closeWrapperConstant)) {
            return;
        }
    }

    const maybeName: Option<string> = NodeIdMapUtils.maybeInvokeExpressionName(
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

    const unsafeResult: TypeUtils.StripReadonly<IdentifierInspected> = state.result;
    unsafeResult.maybeInvokeExpression = {
        kind: Ast.NodeKind.InvokeExpression,
        id: invokeExprXorNode.node.id,
        maybeAttributeIndex: invokeExprXorNode.node.maybeAttributeIndex,
        maybePositionEnd,
        maybePositionStart,
        maybeName,
        maybeArguments: inspectInvokeExpressionArguments(state, invokeExprXorNode),
    };
}

function inspectInvokeExpressionArguments(
    state: IdentifierState,
    invokeExprXorNode: NodeIdMap.TXorNode,
): Option<InvokeExpressionArgs> {
    // Grab arguments if they exist, else return early.
    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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
    const csvXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMapUtils.expectXorChildren(
        state.nodeIdMapCollection,
        csvArrayXorNode.node.id,
    );
    const numArguments: number = csvXorNodes.length;

    let maybePositionArgumentIndex: Option<number>;
    for (let index: number = 0; index < numArguments; index += 1) {
        const csvXorNode: NodeIdMap.TXorNode = csvXorNodes[index];

        // Conditionally set maybePositionArgumentIndex.
        // If position is on a comma then count it as belonging to the next index.
        // Eg. `foo(a,|)` is in the second index.
        if (isPositionOnXorNode(position, nodeIdMapCollection, csvXorNode)) {
            if (csvXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
                const maybeCommaConstant: Option<Ast.Constant> = NodeIdMapUtils.maybeAstChildByAttributeIndex(
                    nodeIdMapCollection,
                    csvXorNode.node.id,
                    1,
                    [Ast.NodeKind.Constant],
                ) as Option<Ast.Constant>;
                if (maybeCommaConstant && isPositionOnAstNode(position, maybeCommaConstant)) {
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

// If position is to the right of an equals sign,
// then add all keys to the scope EXCEPT for the key that the position is under.
function inspectLetExpression(state: IdentifierState, letExprXorNode: NodeIdMap.TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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
        if (isInKeyValuePairAssignment(state, keyValuePairXorNode)) {
            continue;
        }

        const keyValuePairId: number = keyValuePairXorNode.node.id;
        const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeKeyXorNode === undefined) {
            continue;
        }
        const keyXorNode: NodeIdMap.TXorNode = maybeKeyXorNode;
        inspectIdentifier(state, keyXorNode);

        const maybeValueXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            2,
            undefined,
        );
        if (maybeValueXorNode) {
            const valueXorNode: NodeIdMap.TXorNode = maybeValueXorNode;
            maybeSetStartingIdentifierValue(state, keyXorNode, valueXorNode);
        }
    }
}

// If position is to the right of an equals sign,
// then add all keys to scope EXCEPT for the one the that position is under.
function inspectRecordExpressionOrLiteral(state: IdentifierState, recordXorNode: NodeIdMap.TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    // It's safe to filter out the two cases where the user is on a wrapper constant.
    // They are either on the `[`, which is to the left of the equals sign,
    // or they are on the `]` which is outside of the record.
    const previousXorNode: NodeIdMap.TXorNode = expectPreviousXorNode(state);
    if (previousXorNode.node.kind === Ast.NodeKind.Constant) {
        const previousConstantNode: Ast.Constant = previousXorNode.node as Ast.Constant;
        if (previousConstantNode.literal === "[" || previousConstantNode.literal === "]") {
            return;
        }
    }

    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        recordXorNode.node.id,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return;
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    // If we didn't come from a `Record -> ArrayWrapper -> Csv -> KeyValuePair` path then exit.
    // Eg. `[a=1,|`
    const maybePositionKeyValuePairXorNode: Option<NodeIdMap.TXorNode> = maybeNthLastVisitedXorNode(state, 3);

    if (maybePositionKeyValuePairXorNode === undefined) {
        return;
    }
    const positionKeyValuePairXorNode: NodeIdMap.TXorNode = maybePositionKeyValuePairXorNode;
    const positionNodeKind: Ast.NodeKind = positionKeyValuePairXorNode.node.kind;
    if (
        positionNodeKind !== Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral &&
        positionNodeKind !== Ast.NodeKind.GeneralizedIdentifierPairedExpression
    ) {
        return;
    }

    // Only add to scope if position is on the right hand of the assignment.
    if (!isInKeyValuePairAssignment(state, positionKeyValuePairXorNode)) {
        return;
    }

    for (const keyValuePairXorNode of nodesOnCsvFromCsvArray(nodeIdMapCollection, csvArrayXorNode)) {
        const keyValuePairId: number = keyValuePairXorNode.node.id;

        // If position is under this node then don't add it's key to the scope.
        if (keyValuePairXorNode.node.id === positionKeyValuePairXorNode.node.id) {
            continue;
        }

        const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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

        const maybeValueXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            2,
            undefined,
        );
        if (maybeValueXorNode) {
            const valueXorNode: NodeIdMap.TXorNode = maybeValueXorNode;
            maybeSetStartingIdentifierValue(state, keyXorNode, valueXorNode);
        }
    }
}

// If position is to the right of a SectionMember equals sign,
// then add all SectionMember names to scope EXCEPT for the SectionMember the that position is under.
function inspectSection(state: IdentifierState, sectionXorNode: NodeIdMap.TXorNode): void {
    const maybeInspectedSectionMember: Option<IInspectedNode> = ArrayUtils.findReverse(
        state.result.identifierVisitedNodes,
        (visitedNode: IInspectedNode) => visitedNode.kind === Ast.NodeKind.SectionMember,
    );
    const maybeSectionMemberXorNode: Option<NodeIdMap.TXorNode> =
        maybeInspectedSectionMember !== undefined
            ? NodeIdMapUtils.expectXorNode(state.nodeIdMapCollection, maybeInspectedSectionMember.id)
            : undefined;
    if (maybeSectionMemberXorNode === undefined) {
        return;
    }
    const sectionMemberXorNode: NodeIdMap.TXorNode = maybeSectionMemberXorNode;

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeSemicolonConstantXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        sectionMemberXorNode.node.id,
        3,
        [Ast.NodeKind.Constant],
    );
    // We don't want to add section members if we're on or after ';' constant.
    if (maybeSemicolonConstantXorNode !== undefined) {
        const semicolonConstantXorNode: NodeIdMap.TXorNode = maybeSemicolonConstantXorNode;
        if (semicolonConstantXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
            const semicolonConstant: Ast.Constant = semicolonConstantXorNode.node as Ast.Constant;
            if (isPositionAfterTokenPosition(state.position, semicolonConstant.tokenRange.positionStart, false)) {
                return;
            }
        }
    }

    const sectionMembersArrayXorNode: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
        nodeIdMapCollection,
        sectionXorNode.node.id,
        4,
        [Ast.NodeKind.ArrayWrapper],
    );
    const sectionMemberXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMapUtils.expectXorChildren(
        nodeIdMapCollection,
        sectionMembersArrayXorNode.node.id,
    );

    for (const sectionMember of sectionMemberXorNodes) {
        const maybeIdentifierPairedExprXorNode: Option<
            NodeIdMap.TXorNode
        > = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, sectionMember.node.id, 2, [
            Ast.NodeKind.IdentifierPairedExpression,
        ]);
        if (maybeIdentifierPairedExprXorNode === undefined) {
            continue;
        }
        const identifierPairedExprXorNode: NodeIdMap.TXorNode = maybeIdentifierPairedExprXorNode;
        if (isInKeyValuePairAssignment(state, identifierPairedExprXorNode)) {
            continue;
        }

        // Add name to scope.
        const identifierPairedExprId: number = identifierPairedExprXorNode.node.id;
        const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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
            addToScopeIfNew(state, nameXorNode.node.literal, identifierPairedExprXorNode);
        }

        // Add PositionIdentifier
        const maybeValueXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            identifierPairedExprId,
            2,
            undefined,
        );
        if (maybeValueXorNode !== undefined) {
            const valueXorNode: NodeIdMap.TXorNode = maybeValueXorNode;
            maybeSetStartingIdentifierValue(state, nameXorNode, valueXorNode);
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

    const maybeParentNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorNode(nodeIdMapCollection, parentNodeId);
    if (maybeParentNode === undefined) {
        return false;
    }
    const parent: NodeIdMap.TXorNode = maybeParentNode;

    return parent.node.kind === parentNodeKind;
}

function addToScopeIfNew(state: IdentifierState, key: string, xorNode: NodeIdMap.TXorNode): void {
    const scopeMap: Map<string, NodeIdMap.TXorNode> = state.result.scope as Map<string, NodeIdMap.TXorNode>;
    if (!scopeMap.has(key)) {
        scopeMap.set(key, xorNode);
    }
}

function addAstToScopeIfNew(state: IdentifierState, key: string, astNode: Ast.TNode): void {
    addToScopeIfNew(state, key, {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: astNode,
    });
}

function addContextToScopeIfNew(state: IdentifierState, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: NodeIdMap.XorNodeKind.Context,
        node: contextNode,
    });
}

// Takes an XorNode TCsvArray and returns collection.elements.map(csv => csv.node),
// plus extra boilerplate to handle TXorNode.
function nodesOnCsvFromCsvArray(
    nodeIdMapCollection: NodeIdMap.Collection,
    csvArrayXorNode: NodeIdMap.TXorNode,
): ReadonlyArray<NodeIdMap.TXorNode> {
    const csvXorNodes: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMapUtils.expectXorChildren(
        nodeIdMapCollection,
        csvArrayXorNode.node.id,
    );

    const result: NodeIdMap.TXorNode[] = [];
    for (const csvXorNode of csvXorNodes) {
        const maybeCsvNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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

function maybeSetStartingIdentifierValue(
    state: IdentifierState,
    keyXorNode: NodeIdMap.TXorNode,
    valueXorNode: NodeIdMap.TXorNode,
): void {
    if (
        // Nothing to assign as position wasn't on an identifier
        state.maybeIdentifierUnderPosition === undefined ||
        // Already assigned the result
        state.result.maybeIdentifierUnderPosition !== undefined
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

    if (key.literal === state.maybeIdentifierUnderPosition.literal) {
        const unsafeResult: TypeUtils.StripReadonly<IdentifierInspected> = state.result;
        unsafeResult.maybeIdentifierUnderPosition = {
            kind: PositionIdentifierKind.Local,
            identifier: key,
            definition: valueXorNode,
        };
    }
}

function maybeNthLastVisitedXorNode(state: IdentifierState, n: number): Option<NodeIdMap.TXorNode> {
    const identifierInspectedVisitedNodes: ReadonlyArray<IInspectedNode> = state.result.identifierVisitedNodes;
    const nthNodeId: number = identifierInspectedVisitedNodes[identifierInspectedVisitedNodes.length - 1 - n].id;
    return NodeIdMapUtils.maybeXorNode(state.nodeIdMapCollection, nthNodeId);
}

function expectNthLastVisitedXorNode(
    state: IdentifierState,
    n: number,
    maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): NodeIdMap.TXorNode {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybeNthLastVisitedXorNode(state, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no previous node");
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(xorNode.node.kind) === -1) {
        const details: {} = {
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`incorrect node kind for attribute`, details);
    }

    return maybeXorNode;
}

function expectPreviousXorNode(
    state: IdentifierState,
    maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): NodeIdMap.TXorNode {
    return expectNthLastVisitedXorNode(state, 1, maybeAllowedNodeKinds);
}

function isInKeyValuePairAssignment(state: IdentifierState, xorNode: NodeIdMap.TXorNode): boolean {
    const astNodeKind: Ast.NodeKind = xorNode.node.kind;
    if (
        astNodeKind !== Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral &&
        astNodeKind !== Ast.NodeKind.GeneralizedIdentifierPairedExpression &&
        astNodeKind !== Ast.NodeKind.IdentifierPairedExpression
    ) {
        const details: {} = {
            expectedAny: [
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                Ast.NodeKind.IdentifierPairedExpression,
            ],
            actual: astNodeKind,
        };
        throw new CommonError.InvariantError("unknown Ast.NodeKind", details);
    }

    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const astNode:
                | Ast.GeneralizedIdentifierPairedAnyLiteral
                | Ast.GeneralizedIdentifierPairedExpression
                | Ast.IdentifierPairedExpression = xorNode.node as
                | Ast.GeneralizedIdentifierPairedAnyLiteral
                | Ast.GeneralizedIdentifierPairedExpression
                | Ast.IdentifierPairedExpression;
            return isPositionOnAstNode(state.position, astNode.value);
        }

        case NodeIdMap.XorNodeKind.Context:
            const maybeValue: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                state.nodeIdMapCollection,
                xorNode.node.id,
                2,
                undefined,
            );
            return maybeValue !== undefined
                ? isPositionOnXorNode(state.position, state.nodeIdMapCollection, maybeValue)
                : false;

        default:
            throw isNever(xorNode);
    }
}
