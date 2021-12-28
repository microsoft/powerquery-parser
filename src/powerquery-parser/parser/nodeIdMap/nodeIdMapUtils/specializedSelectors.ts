// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from "..";
import { CommonError } from "../../../common";
import { Ast } from "../../../language";
import { TXorNode, XorNode } from "../xorNode";
import {
    assertGetNthChild,
    assertGetNthChildChecked,
    maybeNthChildChecked,
    maybeUnboxNthChildIfAstChecked,
} from "./childSelectors";
import { assertGetXor, assertGetXorChecked } from "./commonSelectors";
import { assertGetParentXor, assertGetParentXorChecked } from "./parentSelectors";

// Returns the previous sibling of the given recursive expression.
// Commonly used for things like getting the identifier name used in an InvokeExpression.
export function assertGetRecursiveExpressionPreviousSibling<T extends Ast.TNode>(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): TXorNode {
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

        return maybeExpectedNodeKinds
            ? assertGetNthChildChecked(
                  nodeIdMapCollection,
                  arrayWrapper.node.id,
                  indexOfPrimaryExpressionId - 1,
                  maybeExpectedNodeKinds,
              )
            : assertGetNthChild(nodeIdMapCollection, arrayWrapper.node.id, indexOfPrimaryExpressionId - 1);
    }
    // It's the first element in ArrayWrapper, meaning we must grab RecursivePrimaryExpression.head
    else {
        const recursivePrimaryExpression: TXorNode = assertGetParentXor(nodeIdMapCollection, arrayWrapper.node.id);
        return maybeExpectedNodeKinds
            ? assertGetNthChildChecked(
                  nodeIdMapCollection,
                  recursivePrimaryExpression.node.id,
                  0,
                  maybeExpectedNodeKinds,
              )
            : assertGetNthChild(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0);
    }
}

export function maybeInvokeExpressionIdentifier(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): XorNode<Ast.IdentifierExpression> | undefined {
    const invokeExprXorNode: TXorNode = assertGetXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    if (invokeExprXorNode.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
    const recursiveArrayXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, invokeExprXorNode.node.id);
    const recursiveExprXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, recursiveArrayXorNode.node.id);
    const maybeHeadXorNode: XorNode<Ast.IdentifierExpression> | undefined =
        maybeNthChildChecked<Ast.IdentifierExpression>(
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
    if (XorNodeUtils.isContextXor(headXorNode)) {
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

export function maybeParameterName(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionParameter: TXorNode,
): Ast.Identifier | undefined {
    return maybeUnboxNthChildIfAstChecked<Ast.Identifier>(
        nodeIdMapCollection,
        functionParameter.node.id,
        1,
        Ast.NodeKind.Identifier,
    );
}

export function maybeParameterNameLiteral(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionParameter: TXorNode,
): string | undefined {
    const maybeIdentifier: Ast.Identifier | undefined = maybeParameterName(nodeIdMapCollection, functionParameter);

    return maybeIdentifier ? maybeIdentifier.literal : undefined;
}

export function maybeInvokeExpressionIdentifierLiteral(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): string | undefined {
    assertGetXorChecked(nodeIdMapCollection, nodeId, Ast.NodeKind.InvokeExpression);

    const maybeIdentifierExpressionXorNode: XorNode<Ast.IdentifierExpression> | undefined =
        maybeInvokeExpressionIdentifier(nodeIdMapCollection, nodeId);
    if (maybeIdentifierExpressionXorNode === undefined || XorNodeUtils.isContextXor(maybeIdentifierExpressionXorNode)) {
        return undefined;
    }

    const identifierExpression: Ast.IdentifierExpression = maybeIdentifierExpressionXorNode.node;

    return identifierExpression.maybeInclusiveConstant === undefined
        ? identifierExpression.identifier.literal
        : identifierExpression.maybeInclusiveConstant.constantKind + identifierExpression.identifier.literal;
}
