// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../powerquery-parser/common";
import { Ast } from "../language";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "../parser";
import { CommonSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { Position, PositionUtils } from "./position";

export type TriedInvokeExpression = Result<InvokeExpression | undefined, CommonError.CommonError>;

export interface InvokeExpression {
    readonly xorNode: TXorNode;
    readonly maybeName: string | undefined;
    readonly maybeArguments: InvokeExpressionArgs | undefined;
}

export interface InvokeExpressionArgs {
    readonly numArguments: number;
    readonly argumentOrdinal: number;
}

export function tryInvokeExpression(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeActiveNode: TMaybeActiveNode,
): TriedInvokeExpression {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return ResultUtils.okFactory(undefined);
    }

    return ResultUtils.ensureResult(settings.locale, () =>
        inspectInvokeExpression(nodeIdMapCollection, maybeActiveNode),
    );
}

function inspectInvokeExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): InvokeExpression | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = activeNode.ancestry.length;
    const position: Position = activeNode.position;

    for (let ancestryIndex: number = 0; ancestryIndex < numAncestors; ancestryIndex += 1) {
        const xorNode: TXorNode = ancestry[ancestryIndex];
        if (!isInvokeExpressionContent(position, xorNode)) {
            continue;
        }

        return {
            xorNode,
            maybeName: maybeInvokeExpressionName(nodeIdMapCollection, xorNode),
            maybeArguments: inspectInvokeExpressionArguments(nodeIdMapCollection, activeNode, ancestryIndex),
        };
    }

    return undefined;
}

function isInvokeExpressionContent(position: Position, xorNode: TXorNode): boolean {
    if (xorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        return false;
    }

    // Check if position is in the wrapped contents (InvokeExpression arguments).
    if (xorNode.kind === XorNodeKind.Ast) {
        const invokeExprAstNode: Ast.InvokeExpression = xorNode.node as Ast.InvokeExpression;
        if (!PositionUtils.isInAst(position, invokeExprAstNode.content, true, true)) {
            return false;
        }
    }

    return true;
}

function maybeInvokeExpressionName(
    nodeIdMapCollection: NodeIdMap.Collection,
    invokeExpr: TXorNode,
): string | undefined {
    XorNodeUtils.assertAstNodeKind(invokeExpr, Ast.NodeKind.InvokeExpression);

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    let maybeName: string | undefined;
    if (invokeExpr.node.maybeAttributeIndex === 0) {
        // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
        const recursiveArrayXorNode: TXorNode = NodeIdMapUtils.assertGetParentXor(
            nodeIdMapCollection,
            invokeExpr.node.id,
        );
        const recursiveExprXorNode: TXorNode = NodeIdMapUtils.assertGetParentXor(
            nodeIdMapCollection,
            recursiveArrayXorNode.node.id,
        );
        const headXorNode: TXorNode = NodeIdMapUtils.assertGetChildXorByAttributeIndex(
            nodeIdMapCollection,
            recursiveExprXorNode.node.id,
            0,
            undefined,
        );
        if (headXorNode.node.kind === Ast.NodeKind.IdentifierExpression) {
            Assert.isTrue(
                headXorNode.kind === XorNodeKind.Ast,
                `the younger IdentifierExpression sibling should've finished parsing before the InvokeExpression node was reached`,
                { identifierExpressionNodeId: headXorNode.node.id, invokeExpressionNodeId: invokeExpr.node.id },
            );

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
    const maybeCsvArray: TXorNode | undefined = AncestryUtils.maybePreviousXor(activeNode.ancestry, nodeIndex, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeCsvArray === undefined) {
        return undefined;
    }

    const csvArray: TXorNode = maybeCsvArray;
    const csvNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
        nodeIdMapCollection,
        csvArray.node.id,
    );
    const numArguments: number = csvNodes.length;
    if (numArguments === 0) {
        return undefined;
    }

    const maybeAncestorCsv: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
        activeNode.ancestry,
        nodeIndex,
        2,
        [Ast.NodeKind.Csv],
    );
    const maybePositionArgumentIndex: number | undefined = maybeAncestorCsv?.node.maybeAttributeIndex;

    return {
        numArguments,
        argumentOrdinal: maybePositionArgumentIndex !== undefined ? maybePositionArgumentIndex : 0,
    };
}
