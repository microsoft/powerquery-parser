// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "..";

export function isNodeKind<T extends Ast.TNode>(
    node: Ast.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): node is T {
    return Array.isArray(expectedNodeKinds) ? expectedNodeKinds.includes(node.kind) : node.kind === expectedNodeKinds;
}

export function isTBinOpExpression(node: Ast.TNode): node is Ast.TBinOpExpression {
    return isNodeKind<
        | Ast.ArithmeticExpression
        | Ast.AsExpression
        | Ast.EqualityExpression
        | Ast.IsExpression
        | Ast.LogicalExpression
        | Ast.NullCoalescingExpression
        | Ast.MetadataExpression
        | Ast.RelationalExpression
    >(node, [
        Ast.NodeKind.ArithmeticExpression,
        Ast.NodeKind.AsExpression,
        Ast.NodeKind.EqualityExpression,
        Ast.NodeKind.IsExpression,
        Ast.NodeKind.LogicalExpression,
        Ast.NodeKind.NullCoalescingExpression,
        Ast.NodeKind.MetadataExpression,
        Ast.NodeKind.RelationalExpression,
    ]);
}

export function isTBinOpExpressionKind(nodeKind: Ast.NodeKind): nodeKind is Ast.TBinOpExpressionNodeKind {
    switch (nodeKind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.NullCoalescingExpression:
        case Ast.NodeKind.MetadataExpression:
        case Ast.NodeKind.RelationalExpression:
            return true;

        default:
            return false;
    }
}

export function isTKeyValuePair(node: Ast.TNode): node is Ast.TKeyValuePair {
    switch (node.kind) {
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            return true;

        default:
            return false;
    }
}

export function isTPairedConstant(node: Ast.TNode): node is Ast.TPairedConstant {
    switch (node.kind) {
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.IsNullablePrimitiveType:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.TypePrimaryType:
            return true;

        default:
            return false;
    }
}
