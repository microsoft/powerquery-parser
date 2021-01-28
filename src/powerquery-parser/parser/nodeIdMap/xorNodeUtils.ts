// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ArrayUtils, Assert } from "../../common";
import { Ast } from "../../language";
import { AstXorNode, ContextXorNode, TXorNode, XorNodeKind } from "./xorNode";

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

export function assertIsAst(xorNode: TXorNode): asserts xorNode is AstXorNode {
    Assert.isTrue(isAst(xorNode), "expected xorNode to hold an Ast node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsContext(xorNode: TXorNode): asserts xorNode is ContextXorNode {
    Assert.isTrue(isContext(xorNode), "expected xorNode to hold a Context node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsIdentifier(xorNode: TXorNode): void {
    assertAnyAstNodeKind(xorNode, [Ast.NodeKind.Identifier, Ast.NodeKind.IdentifierExpression]);
}

export function assertIsRecord(xorNode: TXorNode): void {
    assertAnyAstNodeKind(xorNode, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);
}

export function assertIsList(xorNode: TXorNode): void {
    assertAnyAstNodeKind(xorNode, [Ast.NodeKind.ListExpression, Ast.NodeKind.ListLiteral]);
}

export function assertGetAst(xorNode: TXorNode): Ast.TNode {
    assertIsAst(xorNode);
    return xorNode.node;
}

export function assertGetContext(xorNode: TXorNode): ParseContext.Node {
    assertIsContext(xorNode);
    return xorNode.node;
}

export function isAst(xorNode: TXorNode): xorNode is AstXorNode {
    return xorNode.kind === XorNodeKind.Ast;
}

export function isContext(xorNode: TXorNode): xorNode is ContextXorNode {
    return xorNode.kind === XorNodeKind.Context;
}
