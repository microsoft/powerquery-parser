// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ArrayUtils, Assert } from "../../common";
import { Ast } from "../../language";
import { AstXorNode, ContextXorNode, TAstXorNode, TXorNode, XorNode, XorNodeKind } from "./xorNode";

export function createAstNode<T extends Ast.TNode>(node: T): XorNode<T> {
    return {
        kind: XorNodeKind.Ast,
        node,
    };
}

export function createContextNode(node: ParseContext.Node): TXorNode {
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

export function assertAstNodeKind(xorNode: TXorNode, expectedNodeKind: Ast.NodeKind): void {
    Assert.isTrue(xorNode.node.kind === expectedNodeKind, `xorNode.node.kind === expected`, {
        xorNodeKind: xorNode.node.kind,
        expectedNodeKind,
    });
}

export function assertAnyAstNodeKind(xorNode: TXorNode, allowedNodeKinds: ReadonlyArray<Ast.NodeKind>): void {
    ArrayUtils.assertIn(allowedNodeKinds, xorNode.node.kind, `incorrect Ast NodeKind`);
}

export function assertIsAst<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKind: T["kind"],
): asserts xorNode is AstXorNode<T> {
    Assert.isTrue(isAst(xorNode, expectedNodeKind), "expected xorNode to hold an Ast node of a specific node kind", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
        expectedNodeKind,
    });
}

export function assertIsAstXor(xorNode: TXorNode): asserts xorNode is TAstXorNode {
    Assert.isTrue(isAstXor(xorNode), "expected xorNode to hold an Ast node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsContextXor(xorNode: TXorNode): asserts xorNode is ContextXorNode {
    Assert.isTrue(isContextXor(xorNode), "expected xorNode to hold a Context node", {
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

export function assertGetAst<T extends Ast.TNode>(xorNode: TXorNode, expectedNodeKind: T["kind"]): T {
    assertIsAst(xorNode, expectedNodeKind);
    return xorNode.node;
}

export function assertUnwrapAst<T extends Ast.TNode>(xorNode: TXorNode, expectedNodeKind: T["kind"]): T {
    assertIsAst(xorNode, expectedNodeKind);
    return xorNode.node;
}

export function assertUnwrapTAst(xorNode: TXorNode): Ast.TNode {
    assertIsAstXor(xorNode);
    return xorNode.node;
}

export function assertUnwrapContext(xorNode: TXorNode): ParseContext.Node {
    assertIsContextXor(xorNode);
    return xorNode.node;
}

export function isAst<T extends Ast.TNode>(xorNode: TXorNode, nodeKind: T["kind"]): xorNode is AstXorNode<T> {
    return isAstXor(xorNode) && xorNode.node.kind === nodeKind;
}

export function isAstXor(xorNode: TXorNode): xorNode is TAstXorNode {
    return xorNode.kind === XorNodeKind.Ast;
}

export function isContextXor(xorNode: TXorNode): xorNode is ContextXorNode {
    return xorNode.kind === XorNodeKind.Context;
}

export function maybeIdentifierExpressionLiteral(xorNode: TXorNode): string | undefined {
    const maybeIdentifierExpression: Ast.IdentifierExpression | undefined = maybeUnwrapAst(
        xorNode,
        Ast.NodeKind.IdentifierExpression,
    );
    if (maybeIdentifierExpression === undefined) {
        return undefined;
    }
    const identifierExpression: Ast.IdentifierExpression = maybeIdentifierExpression;

    return identifierExpression.maybeInclusiveConstant === undefined
        ? identifierExpression.identifier.literal
        : identifierExpression.maybeInclusiveConstant.constantKind + identifierExpression.identifier.literal;
}

export function maybeUnwrapAst<T extends Ast.TNode>(xorNode: TXorNode, expectedNodeKind: T["kind"]): T | undefined {
    return isAst(xorNode, expectedNodeKind) ? xorNode.node : undefined;
}
