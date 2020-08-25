// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, XorNodeUtils } from "..";
import { CommonError } from "../../../common";
import { Ast } from "../../../language";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";
import { assertChildXorByAttributeIndex } from "./childSelectors";
import { assertXor } from "./commonSelectors";
import { assertParentXor } from "./parentSelectors";

// Returns the previous sibling of the given recursive expression.
// Commonly used for things like getting the identifier name used in an InvokeExpression.
export function assertRecursiveExpressionPreviousSibling(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const xorNode: TXorNode = assertXor(nodeIdMapCollection, nodeId);
    const arrayWrapper: TXorNode = assertParentXor(nodeIdMapCollection, nodeId, [Ast.NodeKind.ArrayWrapper]);
    const maybeInvokeExpressionAttributeIndex: number | undefined = xorNode.node.maybeAttributeIndex;

    // It's not the first element in the ArrayWrapper.
    if (maybeInvokeExpressionAttributeIndex && maybeInvokeExpressionAttributeIndex > 0) {
        const childIds: ReadonlyArray<number> = NodeIdMapIterator.assertIterChildIds(
            nodeIdMapCollection.childIdsById,
            arrayWrapper.node.id,
        );
        const indexOfInvokeExprId: number = childIds.indexOf(xorNode.node.id);
        if (indexOfInvokeExprId === -1 || indexOfInvokeExprId === 0) {
            const details: {} = {
                invokeExprId: xorNode.node.id,
                arrayWrapperId: arrayWrapper.node.id,
                indexOfInvokeExprId,
            };
            throw new CommonError.InvariantError(
                `expected to find invokeExpr in arrayWrapper's children at an index > 0`,
                details,
            );
        }

        return assertChildXorByAttributeIndex(
            nodeIdMapCollection,
            arrayWrapper.node.id,
            indexOfInvokeExprId - 1,
            undefined,
        );
    }
    // It's the first element in ArrayWrapper, meaning we must grab RecursivePrimaryExpression.head
    else {
        const recursivePrimaryExpression: TXorNode = assertParentXor(nodeIdMapCollection, arrayWrapper.node.id);
        return assertChildXorByAttributeIndex(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0, undefined);
    }
}

export function maybeInvokeExpressionName(nodeIdMapCollection: Collection, nodeId: number): string | undefined {
    const invokeExprXorNode: TXorNode = assertXor(nodeIdMapCollection, nodeId);
    XorNodeUtils.assertAstNodeKind(invokeExprXorNode, Ast.NodeKind.InvokeExpression);

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    let maybeName: string | undefined;
    if (invokeExprXorNode.node.maybeAttributeIndex === 0) {
        // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
        const recursiveArrayXorNode: TXorNode = assertParentXor(nodeIdMapCollection, invokeExprXorNode.node.id);
        const recursiveExprXorNode: TXorNode = assertParentXor(nodeIdMapCollection, recursiveArrayXorNode.node.id);
        const headXorNode: TXorNode = assertChildXorByAttributeIndex(
            nodeIdMapCollection,
            recursiveExprXorNode.node.id,
            0,
            undefined,
        );
        if (headXorNode.node.kind === Ast.NodeKind.IdentifierExpression) {
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

            const identifierExpression: Ast.IdentifierExpression = headXorNode.node as Ast.IdentifierExpression;
            maybeName =
                identifierExpression.maybeInclusiveConstant === undefined
                    ? identifierExpression.identifier.literal
                    : identifierExpression.maybeInclusiveConstant.constantKind +
                      identifierExpression.identifier.literal;
        }
    }

    return maybeName;
}
