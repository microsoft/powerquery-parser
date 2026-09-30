// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assertNthChildXor, assertNthChildXorChecked, nthChildAstChecked, nthChildXor } from "./childSelectors";
import { assertParentXor, assertParentXorChecked } from "./parentSelectors";
import { assertXor, assertXorChecked } from "./commonSelectors";
import { NodeIdMap, NodeIdMapUtils, XorNodeUtils } from "..";
import { AstXorNode, TXorNode, XorNode } from "../xorNode";
import { Ast } from "../../../language";
import { CommonError } from "../../../common";

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
    const invokeExprXorNode: TXorNode = assertXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);
    const headXorNode: TXorNode | undefined = invokeExpressionHead(nodeIdMapCollection, invokeExprXorNode);

    return headXorNode ? identifierExpressionHead(invokeExprXorNode, headXorNode) : undefined;
}

// The only place for a name in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
// only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
function invokeExpressionHead(
    nodeIdMapCollection: NodeIdMap.Collection,
    invokeExprXorNode: TXorNode,
): TXorNode | undefined {
    if (invokeExprXorNode.node.attributeIndex !== 0) {
        return undefined;
    }

    const recursiveArrayXorNode: TXorNode = assertParentXor(nodeIdMapCollection, invokeExprXorNode.node.id);
    const recursiveExprXorNode: TXorNode = assertParentXor(nodeIdMapCollection, recursiveArrayXorNode.node.id);

    return nthChildXor(
        nodeIdMapCollection,
        recursiveExprXorNode.node.id,
        0
    );
}

// Throws if the IdentifierExpression hasn't finished parsing.
function identifierExpressionHead(
    invokeExprXorNode: TXorNode,
    headXorNode: TXorNode,
): AstXorNode<Ast.IdentifierExpression> | undefined {
    // It's not an identifier expression so there's nothing we can do.
    if (!XorNodeUtils.isNodeKind<Ast.IdentifierExpression>(headXorNode, Ast.NodeKind.IdentifierExpression)) {
        return undefined;
    }

    if (!XorNodeUtils.isAstChecked<Ast.IdentifierExpression>(headXorNode, Ast.NodeKind.IdentifierExpression)) {
        const details: {
            identifierExpressionNodeId: number;
            invokeExpressionNodeId: number;
        } = {
            identifierExpressionNodeId: headXorNode.node.id,
            invokeExpressionNodeId: invokeExprXorNode.node.id,
        };

        throw new CommonError.InvariantError(
            `the younger IdentifierExpression sibling should've finished parsing before the InvokeExpression node was reached`,
            details,
        );
    }

    return headXorNode;
}

// Unboxes the identifier literal for function name if it exists.
// A section-access head (eg. `Section1!Foo(1)`) is returned as `Section1!Foo`.
export function invokeExpressionIdentifierLiteral(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): string | undefined {
    const invokeExprXorNode: TXorNode = assertXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);
    const headXorNode: TXorNode | undefined = invokeExpressionHead(nodeIdMapCollection, invokeExprXorNode);

    if (headXorNode === undefined) {
        return undefined;
    }

    const identifierExpressionXorNode: AstXorNode<Ast.IdentifierExpression> | undefined = identifierExpressionHead(
        invokeExprXorNode,
        headXorNode,
    );

    if (identifierExpressionXorNode !== undefined) {
        const identifierExpression: Ast.IdentifierExpression = identifierExpressionXorNode.node;

        return identifierExpression.inclusiveConstant === undefined
            ? identifierExpression.identifier.literal
            : identifierExpression.inclusiveConstant.constantKind + identifierExpression.identifier.literal;
    }

    // A SectionAccessExpression head which is still being parsed is treated as having no name.
    if (!XorNodeUtils.isAstChecked<Ast.SectionAccessExpression>(headXorNode, Ast.NodeKind.SectionAccessExpression)) {
        return undefined;
    }

    const sectionAccessExpression: Ast.SectionAccessExpression = headXorNode.node;

    return (
        sectionAccessExpression.sectionIdentifier.literal +
        sectionAccessExpression.bangConstant.constantKind +
        sectionAccessExpression.memberIdentifier.literal
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
