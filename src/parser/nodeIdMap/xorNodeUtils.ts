// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ArrayUtils, Assert } from "../../common";
import { Ast } from "../../language";
import { TXorNode, XorNodeKind } from "./xorNode";

export function astFactory(node: Ast.TNode): TXorNode {
    return {
        kind: XorNodeKind.Ast,
        node,
    };
}

export function contextFactory(node: ParseContext.Node): TXorNode {
    return {
        kind: XorNodeKind.Context,
        node,
    };
}

export function isTUnaryType(xorNode: TXorNode): boolean {
    return xorNode.node.kind === Ast.NodeKind.UnaryExpression || isTTypeExpression(xorNode);
}

export function isTTypeExpression(xorNode: TXorNode): boolean {
    return xorNode.node.kind === Ast.NodeKind.TypePrimaryType || isTPrimaryExpression(xorNode);
}

export function isTPrimaryExpression(xorNode: TXorNode): boolean {
    switch (xorNode.node.kind) {
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.NotImplementedExpression:
            return true;

        default:
            return isTFieldAccessExpression(xorNode);
    }
}

export function isTFieldAccessExpression(xorNode: TXorNode): boolean {
    return xorNode.node.kind === Ast.NodeKind.FieldSelector || xorNode.node.kind === Ast.NodeKind.FieldProjection;
}

export function assertAstNodeKind(xorNode: TXorNode, expected: Ast.NodeKind): void {
    Assert.isTrue(xorNode.node.kind === expected, `xorNode.node.kind === expected`, {
        xorNodeKind: xorNode.node.kind,
        expected,
    });
}

export function assertAnyAstNodeKind(xorNode: TXorNode, allowedNodeKinds: ReadonlyArray<Ast.NodeKind>): void {
    ArrayUtils.assertIn(allowedNodeKinds, xorNode.node.kind, `incorrect Ast NodeKind`);
}
