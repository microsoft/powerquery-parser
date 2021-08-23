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

export function createContextNode(node: ParseContext.Node): ContextXorNode {
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

export function assertIsNodeKind<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts xorNode is XorNode<T> {
    if (Array.isArray(expectedNodeKinds)) {
        ArrayUtils.assertIn(expectedNodeKinds, xorNode.node.kind, `incorrect Ast.NodeKind`, {
            actualNodeKind: xorNode.node.kind,
            actualNodeId: xorNode.node.id,
            expectedNodeKinds,
        });
    }
}

export function assertIsAstXor<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): asserts xorNode is TAstXorNode {
    Assert.isTrue(
        isAstXor(xorNode, maybeExpectedNodeKinds),
        "expected xorNode to hold an Ast node an to optionally be a specified type node kind",
        {
            xorNodeKind: xorNode.kind,
            xorNodeId: xorNode.node.id,
            maybeExpectedNodeKinds,
        },
    );
}

export function assertIsContextXor<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): asserts xorNode is ContextXorNode {
    Assert.isTrue(
        isContextXor(xorNode, maybeExpectedNodeKinds),
        "expected xorNode to hold an Context node an to optionally be a specified type node kind",
        {
            xorNodeKind: xorNode.kind,
            xorNodeId: xorNode.node.id,
            maybeExpectedNodeKinds,
        },
    );
}

export function assertIsIdentifier(xorNode: TXorNode): void {
    assertIsNodeKind(xorNode, [Ast.NodeKind.Identifier, Ast.NodeKind.IdentifierExpression]);
}

export function assertIsRecord(xorNode: TXorNode): void {
    assertIsNodeKind(xorNode, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);
}

export function assertIsList(xorNode: TXorNode): void {
    assertIsNodeKind(xorNode, [Ast.NodeKind.ListExpression, Ast.NodeKind.ListLiteral]);
}

export function assertUnwrapAst<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): Ast.TNode {
    assertIsAstXor(xorNode, maybeExpectedNodeKinds);
    return xorNode.node;
}

export function assertUnwrapContext<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): ParseContext.Node {
    assertIsContextXor(xorNode, maybeExpectedNodeKinds);
    return xorNode.node;
}

export function isAstXor<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): xorNode is AstXorNode<T> {
    if (xorNode.kind !== XorNodeKind.Ast) {
        return false;
    } else {
        return !maybeExpectedNodeKinds || isNodeKind(xorNode, maybeExpectedNodeKinds);
    }
}

export function isContextXor<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): xorNode is ContextXorNode {
    if (xorNode.kind !== XorNodeKind.Context) {
        return false;
    } else {
        return !maybeExpectedNodeKinds || isNodeKind(xorNode, maybeExpectedNodeKinds);
    }
}

export function isNodeKind<T extends Ast.TNode>(
    xorNode: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): xorNode is XorNode<T> {
    return (
        xorNode.node.kind === maybeExpectedNodeKinds ||
        (Array.isArray(maybeExpectedNodeKinds) && maybeExpectedNodeKinds.includes(xorNode.node.kind))
    );
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

export function maybeUnwrapAst<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): T | undefined {
    return isAstXor(xorNode, expectedNodeKinds) ? xorNode.node : undefined;
}
