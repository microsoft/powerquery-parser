// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "../../common";
import { AncestorUtils, Ast, NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";
import { ActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";

export interface InspectedInvokeExpression {
    readonly maybeInvokeExpression: InvokeExpression | undefined;
}

export interface InvokeExpression {
    readonly xorNode: TXorNode;
    readonly maybeName: string | undefined;
    readonly maybeArguments: InvokeExpressionArgs | undefined;
}

export interface InvokeExpressionArgs {
    readonly numArguments: number;
    readonly positionArgumentIndex: number;
}

export function inspectInvokeExpression(
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): InspectedInvokeExpression {
    const ancestors: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = activeNode.ancestry.length;
    const position: Position = activeNode.position;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestors[index];
        if (!isInvokeExpressionContent(position, xorNode)) {
            continue;
        }

        return {
            maybeInvokeExpression: {
                xorNode: xorNode,
                maybeName: maybeInvokeExpressionName(nodeIdMapCollection, xorNode.node.id),
                maybeArguments: inspectInvokeExpressionArguments(nodeIdMapCollection, activeNode, index),
            },
        };
    }

    return {
        maybeInvokeExpression: undefined,
    };
}

function isInvokeExpressionContent(position: Position, xorNode: TXorNode): boolean {
    if (xorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        return false;
    }

    // Check if position is in the wrapped contents (InvokeExpression arguments).
    if (xorNode.kind === XorNodeKind.Ast) {
        const invokeExprAstNode: Ast.InvokeExpression = xorNode.node as Ast.InvokeExpression;
        if (!PositionUtils.isInAstNode(position, invokeExprAstNode.content, true, true)) {
            return false;
        }
    }

    return true;
}

function maybeInvokeExpressionName(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): string | undefined {
    const invokeExprXorNode: TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, nodeId);

    if (invokeExprXorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        const details: {} = { invokeExprXorNode };
        throw new CommonError.InvariantError(
            `expected invokeExprXorNode to have a Ast.NodeKind of ${Ast.NodeKind.InvokeExpression}`,
            details,
        );
    }

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    let maybeName: string | undefined;
    if (invokeExprXorNode.node.maybeAttributeIndex === 0) {
        // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
        const recursiveArrayXorNode: TXorNode = NodeIdMapUtils.expectParentXorNode(
            nodeIdMapCollection,
            invokeExprXorNode.node.id,
        );
        const recursiveExprXorNode: TXorNode = NodeIdMapUtils.expectParentXorNode(
            nodeIdMapCollection,
            recursiveArrayXorNode.node.id,
        );
        const headXorNode: TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
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

function inspectInvokeExpressionArguments(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    nodeIndex: number,
): InvokeExpressionArgs | undefined {
    // Grab arguments if they exist, else return early.
    const maybeCsvArray: TXorNode | undefined = AncestorUtils.maybePreviousXorNode(activeNode.ancestry, nodeIndex, 1, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeCsvArray === undefined) {
        return undefined;
    }
    // const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    // const position: Position = state.activeNode.position;
    const csvArray: TXorNode = maybeCsvArray;
    const csvNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorChildren(
        nodeIdMapCollection,
        csvArray.node.id,
    );
    const numArguments: number = csvNodes.length;

    const maybeAncestorCsv: TXorNode | undefined = AncestorUtils.maybePreviousXorNode(
        activeNode.ancestry,
        nodeIndex,
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
