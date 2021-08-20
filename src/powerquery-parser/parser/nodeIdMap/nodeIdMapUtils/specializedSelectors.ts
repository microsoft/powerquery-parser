// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, XorNodeUtils } from "..";
import { CommonError } from "../../../common";
import { Ast } from "../../../language";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";
import { assertGetChildXorByAttributeIndex, maybeChildXorByAttributeIndex } from "./childSelectors";
import { assertGetXor } from "./commonSelectors";
import { assertGetParentXor, assertGetParentXorChecked } from "./parentSelectors";

// Returns the previous sibling of the given recursive expression.
// Commonly used for things like getting the identifier name used in an InvokeExpression.
export function assertGetRecursiveExpressionPreviousSibling(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const xorNode: TXorNode = assertGetXor(nodeIdMapCollection, nodeId);
    const arrayWrapper: TXorNode = assertGetParentXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.ArrayWrapper);
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

        return assertGetChildXorByAttributeIndex(
            nodeIdMapCollection,
            arrayWrapper.node.id,
            indexOfPrimaryExpressionId - 1,
            undefined,
        );
    }
    // It's the first element in ArrayWrapper, meaning we must grab RecursivePrimaryExpression.head
    else {
        const recursivePrimaryExpression: TXorNode = assertGetParentXor(nodeIdMapCollection, arrayWrapper.node.id);
        return assertGetChildXorByAttributeIndex(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0, undefined);
    }
}

export function maybeInvokeExpressionIdentifier(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const invokeExprXorNode: TXorNode = assertGetXor(nodeIdMapCollection, nodeId);
    XorNodeUtils.assertAstNodeKind(invokeExprXorNode, Ast.NodeKind.InvokeExpression);

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    if (invokeExprXorNode.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
    const recursiveArrayXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, invokeExprXorNode.node.id);
    const recursiveExprXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, recursiveArrayXorNode.node.id);
    const maybeHeadXorNode: TXorNode | undefined = maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        recursiveExprXorNode.node.id,
        0,
        [Ast.NodeKind.IdentifierExpression],
    );

    // It's not an identifier expression so there's nothing we can do.
    if (maybeHeadXorNode === undefined) {
        return undefined;
    }
    const headXorNode: TXorNode = maybeHeadXorNode;

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
    const invokeExprXorNode: TXorNode = assertGetXor(nodeIdMapCollection, nodeId);
    XorNodeUtils.assertAstNodeKind(invokeExprXorNode, Ast.NodeKind.InvokeExpression);

    const maybeIdentifierExpressionXorNode: TXorNode | undefined = maybeInvokeExpressionIdentifier(
        nodeIdMapCollection,
        nodeId,
    );
    if (maybeIdentifierExpressionXorNode === undefined || maybeIdentifierExpressionXorNode.kind !== XorNodeKind.Ast) {
        return undefined;
    }
    const identifierExpressionXorNode: TXorNode = maybeIdentifierExpressionXorNode;
    XorNodeUtils.assertAstNodeKind(identifierExpressionXorNode, Ast.NodeKind.IdentifierExpression);
    const identifierExpression: Ast.IdentifierExpression = identifierExpressionXorNode.node as Ast.IdentifierExpression;

    return identifierExpression.maybeInclusiveConstant === undefined
        ? identifierExpression.identifier.literal
        : identifierExpression.maybeInclusiveConstant.constantKind + identifierExpression.identifier.literal;
}
