// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assertNthChildXor, assertNthChildXorChecked, nthChildAstChecked, nthChildXorChecked } from "./childSelectors";
import { assertParentXor, assertParentXorChecked } from "./parentSelectors";
import { assertXor, assertXorChecked } from "./commonSelectors";
import { AstXorNode, TXorNode, XorNode } from "../xorNode";
import { NodeIdMap, NodeIdMapUtils, XorNodeUtils } from "..";
import { Ast } from "../../../language";
import { CommonError } from "../../../common";

export interface SectionAccessExpressionComponents {
    readonly sectionName: XorNode<Ast.Identifier> | undefined;
    readonly memberName: XorNode<Ast.Identifier> | undefined;
}

// Returns the previous sibling of the given recursive expression.
// Commonly used for things like getting the identifier name used in an InvokeExpression.
// Returns undefined if there is no previous sibling.
export function assertRecursiveExpressionPreviousSibling<T extends Ast.TNode>(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): TXorNode {
    const xorNode: TXorNode = assertXor(nodeIdMapCollection, nodeId);
    const arrayWrapper: TXorNode = assertParentXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.ArrayWrapper);
    const primaryExpressionAttributeId: number | undefined = xorNode.node.attributeIndex;

    // It's not the first element in the ArrayWrapper.
    if (primaryExpressionAttributeId && primaryExpressionAttributeId > 0) {
        const childIds: ReadonlyArray<number> = NodeIdMapUtils.assertChildIds(
            nodeIdMapCollection.childIdsById,
            arrayWrapper.node.id,
        );

        const indexOfPrimaryExpressionId: number = childIds.indexOf(xorNode.node.id);

        if (indexOfPrimaryExpressionId === -1 || indexOfPrimaryExpressionId === 0) {
            const details: {
                xorNodeId: number;
                arrayWrapperId: number;
                indexOfPrimaryExpressionId: number;
            } = {
                xorNodeId: xorNode.node.id,
                arrayWrapperId: arrayWrapper.node.id,
                indexOfPrimaryExpressionId,
            };

            throw new CommonError.InvariantError(
                `expected to find xorNodeId in arrayWrapper's children at an index > 0`,
                details,
            );
        }

        return expectedNodeKinds
            ? assertNthChildXorChecked(
                  nodeIdMapCollection,
                  arrayWrapper.node.id,
                  indexOfPrimaryExpressionId - 1,
                  expectedNodeKinds,
              )
            : assertNthChildXor(nodeIdMapCollection, arrayWrapper.node.id, indexOfPrimaryExpressionId - 1);
    }
    // It's the first element in ArrayWrapper, meaning we must grab RecursivePrimaryExpression.head
    else {
        const recursivePrimaryExpression: TXorNode = assertParentXor(nodeIdMapCollection, arrayWrapper.node.id);

        return expectedNodeKinds
            ? assertNthChildXorChecked(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0, expectedNodeKinds)
            : assertNthChildXor(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0);
    }
}

// Asserts the given node is an InvokeExpression,
// then returns the previous sibling on the condition that it's an identifier.
export function invokeExpressionIdentifier(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): XorNode<Ast.IdentifierExpression> | undefined {
    const headXorNode: XorNode<Ast.IdentifierExpression | Ast.SectionAccessExpression> | undefined =
        invokeExpressionReference(nodeIdMapCollection, nodeId);

    return headXorNode ? identifierExpressionHead(nodeId, headXorNode) : undefined;
}

// Returns the named head when the invocation is the first suffix, without unwrapping other expressions.
// The invocation and returned reference may be AST or unfinished context nodes.
export function invokeExpressionReference(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): XorNode<Ast.IdentifierExpression | Ast.SectionAccessExpression> | undefined {
    const invokeExprXorNode: TXorNode = assertXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);

    if (invokeExprXorNode.node.attributeIndex !== 0) {
        return undefined;
    }

    const recursiveArrayXorNode: TXorNode = assertParentXor(nodeIdMapCollection, invokeExprXorNode.node.id);
    const recursiveExprXorNode: TXorNode = assertParentXor(nodeIdMapCollection, recursiveArrayXorNode.node.id);

    return nthChildXorChecked<Ast.IdentifierExpression | Ast.SectionAccessExpression>(
        nodeIdMapCollection,
        recursiveExprXorNode.node.id,
        0,
        [Ast.NodeKind.IdentifierExpression, Ast.NodeKind.SectionAccessExpression],
    );
}

// Asserts section access and returns its available identifier children, preserving nodes and source ranges.
// An unfinished identifier is a context node; a child not yet started is undefined.
export function sectionAccessExpressionComponents(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): SectionAccessExpressionComponents {
    assertXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.SectionAccessExpression);

    return {
        sectionName: nthChildXorChecked<Ast.Identifier>(nodeIdMapCollection, nodeId, 0, Ast.NodeKind.Identifier),
        memberName: nthChildXorChecked<Ast.Identifier>(nodeIdMapCollection, nodeId, 2, Ast.NodeKind.Identifier),
    };
}

function identifierExpressionHead(
    invokeExpressionNodeId: number,
    headXorNode: TXorNode,
): AstXorNode<Ast.IdentifierExpression> | undefined {
    if (!XorNodeUtils.isNodeKind<Ast.IdentifierExpression>(headXorNode, Ast.NodeKind.IdentifierExpression)) {
        return undefined;
    }

    if (XorNodeUtils.isContext(headXorNode)) {
        throw new CommonError.InvariantError(
            `the younger IdentifierExpression sibling should've finished parsing before the InvokeExpression node was reached`,
            {
                identifierExpressionNodeId: headXorNode.node.id,
                invokeExpressionNodeId,
            },
        );
    }

    return headXorNode;
}

// Unboxes the identifier literal for function name if it exists.
// Section-qualified names preserve identifier spelling, but omit intervening whitespace and comments.
export function invokeExpressionIdentifierLiteral(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): string | undefined {
    const headXorNode: XorNode<Ast.IdentifierExpression | Ast.SectionAccessExpression> | undefined =
        invokeExpressionReference(nodeIdMapCollection, nodeId);

    if (headXorNode === undefined) {
        return undefined;
    }

    const identifierExpressionXorNode: AstXorNode<Ast.IdentifierExpression> | undefined = identifierExpressionHead(
        nodeId,
        headXorNode,
    );

    if (identifierExpressionXorNode !== undefined) {
        return XorNodeUtils.identifierExpressionLiteral(identifierExpressionXorNode);
    }

    if (!XorNodeUtils.isAstChecked<Ast.SectionAccessExpression>(headXorNode, Ast.NodeKind.SectionAccessExpression)) {
        return undefined;
    }

    const sectionAccessExpression: Ast.SectionAccessExpression = headXorNode.node;

    return (
        sectionAccessExpression.sectionName.literal +
        sectionAccessExpression.bangConstant.constantKind +
        sectionAccessExpression.memberName.literal
    );
}

// Unboxes the node if it's a identifier
export function parameterIdentifier(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionParameter: TXorNode,
): Ast.Identifier | undefined {
    return nthChildAstChecked<Ast.Identifier>(
        nodeIdMapCollection,
        functionParameter.node.id,
        1,
        Ast.NodeKind.Identifier,
    );
}

// Unboxes the identifier literal if it exists.
export function parameterIdentifierLiteral(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionParameter: TXorNode,
): string | undefined {
    const identifier: Ast.Identifier | undefined = parameterIdentifier(nodeIdMapCollection, functionParameter);

    return identifier ? identifier.literal : undefined;
}
