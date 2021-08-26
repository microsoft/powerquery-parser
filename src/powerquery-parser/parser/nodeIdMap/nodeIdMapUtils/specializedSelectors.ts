// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, XorNodeUtils } from "..";
import { CommonError } from "../../../common";
import { Ast } from "../../../language";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNode, XorNodeKind } from "../xorNode";
import { assertGetNthChild, maybeNthChild } from "./childSelectors";
import { assertGetXor } from "./commonSelectors";
import { assertGetParentXor } from "./parentSelectors";

// Returns the previous sibling of the given recursive expression.
// Commonly used for things like getting the identifier name used in an InvokeExpression.
export function assertGetRecursiveExpressionPreviousSibling<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    const xorNode: TXorNode = assertGetXor(nodeIdMapCollection, nodeId);
    const arrayWrapper: TXorNode = assertGetParentXor(nodeIdMapCollection, nodeId, Ast.NodeKind.ArrayWrapper);
    const maybePrimaryExpressionAttributeId: number | undefined = xorNode.node.maybeAttributeIndex;

    // It's not the first element in the ArrayWrapper.
    if (maybePrimaryExpressionAttributeId && maybePrimaryExpressionAttributeId > 0) {
        const childIds: ReadonlyArray<number> = NodeIdMapIterator.assertIterChildIds(
            nodeIdMapCollection.childIdsById,
            arrayWrapper.node.id,
        );
        const indexOfPrimaryExpressionId: number = childIds.indexOf(xorNode.node.id);
        if (indexOfPrimaryExpressionId === -1 || indexOfPrimaryExpressionId === 0) {
            const details: {} = {
                xorNodeId: xorNode.node.id,
                arrayWrapperId: arrayWrapper.node.id,
                indexOfPrimaryExpressionId,
            };
            throw new CommonError.InvariantError(
                `expected to find xorNodeId in arrayWrapper's children at an index > 0`,
                details,
            );
        }

        return assertGetNthChild(
            nodeIdMapCollection,
            arrayWrapper.node.id,
            indexOfPrimaryExpressionId - 1,
            maybeExpectedNodeKinds,
        );
    }
    // It's the first element in ArrayWrapper, meaning we must grab RecursivePrimaryExpression.head
    else {
        const recursivePrimaryExpression: TXorNode = assertGetParentXor(nodeIdMapCollection, arrayWrapper.node.id);
        return assertGetNthChild(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0, maybeExpectedNodeKinds);
    }
}

export function maybeInvokeExpressionIdentifier(
    nodeIdMapCollection: Collection,
    nodeId: number,
): XorNode<Ast.IdentifierExpression> | undefined {
    const invokeExprXorNode: TXorNode = assertGetXor(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    if (invokeExprXorNode.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
    const recursiveArrayXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, invokeExprXorNode.node.id);
    const recursiveExprXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, recursiveArrayXorNode.node.id);
    const maybeHeadXorNode: XorNode<Ast.IdentifierExpression> | undefined = maybeNthChild(
        nodeIdMapCollection,
        recursiveExprXorNode.node.id,
        0,
        Ast.NodeKind.IdentifierExpression,
    );

    // It's not an identifier expression so there's nothing we can do.
    if (maybeHeadXorNode === undefined) {
        return undefined;
    }
    const headXorNode: XorNode<Ast.IdentifierExpression> = maybeHeadXorNode;

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    if (headXorNode.kind !== XorNodeKind.Ast) {
        const details: {} = {
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

export function maybeInvokeExpressionIdentifierLiteral(
    nodeIdMapCollection: Collection,
    nodeId: number,
): string | undefined {
    assertGetXor(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);

    const maybeIdentifierExpressionXorNode:
        | XorNode<Ast.IdentifierExpression>
        | undefined = maybeInvokeExpressionIdentifier(nodeIdMapCollection, nodeId);
    if (maybeIdentifierExpressionXorNode === undefined || !XorNodeUtils.isAstXor(maybeIdentifierExpressionXorNode)) {
        return undefined;
    }

    const identifierExpression: Ast.IdentifierExpression = maybeIdentifierExpressionXorNode.node;

    return identifierExpression.maybeInclusiveConstant === undefined
        ? identifierExpression.identifier.literal
        : identifierExpression.maybeInclusiveConstant.constantKind + identifierExpression.identifier.literal;
}
