// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from "../../common";
import { Ast, AstUtils } from "../../language";
import { AstXorNode, ContextXorNode, TAstXorNode, TContextXorNode, TXorNode, XorNode, XorNodeKind } from "./xorNode";
import { ParseContext } from "..";
import { ParseContextUtils } from "../context";

export function boxAst<T extends Ast.TNode>(node: T): XorNode<T> {
    return {
        kind: XorNodeKind.Ast,
        node,
    };
}

export function boxContext<T extends Ast.TNode>(node: ParseContext.Node<T>): ContextXorNode<T> {
    return {
        kind: XorNodeKind.Context,
        node,
    };
}

export function ast(xorNode: TXorNode): Ast.TNode | undefined {
    return isAst(xorNode) ? xorNode.node : undefined;
}

export function astChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const astNode: Ast.TNode | undefined = ast(xorNode);

    return astNode && AstUtils.isNodeKind(astNode, expectedNodeKinds) ? astNode : undefined;
}

export function context(xorNode: TXorNode): ParseContext.TNode | undefined {
    return isContext(xorNode) ? xorNode.node : undefined;
}

export function contextChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const contextNode: ParseContext.TNode | undefined = context(xorNode);

    return contextNode && ParseContextUtils.isNodeKind(contextNode, expectedNodeKinds) ? contextNode : undefined;
}

export function isAst(xorNode: TXorNode): xorNode is TAstXorNode {
    return xorNode.kind === XorNodeKind.Ast;
}

export function isAstChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): xorNode is AstXorNode<T> {
    return isAst(xorNode) && AstUtils.isNodeKind(xorNode.node, expectedNodeKinds);
}

export function isContext<T extends Ast.TNode>(xorNode: TXorNode): xorNode is ContextXorNode<T> {
    return xorNode.kind === XorNodeKind.Context;
}

export function isContextChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): xorNode is ContextXorNode<T> {
    return isContext(xorNode) && ParseContextUtils.isNodeKind(xorNode.node, expectedNodeKinds);
}

export function isNodeKind<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): xorNode is XorNode<T> {
    return (
        xorNode.node.kind === expectedNodeKinds ||
        (Array.isArray(expectedNodeKinds) && expectedNodeKinds.includes(xorNode.node.kind))
    );
}

export function isTUnaryType(xorNode: TXorNode): xorNode is XorNode<Ast.TUnaryExpression> {
    return xorNode.node.kind === Ast.NodeKind.UnaryExpression || isTTypeExpression(xorNode);
}

export function isTTypeExpression(xorNode: TXorNode): xorNode is XorNode<Ast.TTypeExpression> {
    return xorNode.node.kind === Ast.NodeKind.TypePrimaryType || isTPrimaryExpression(xorNode);
}

export function isTPrimaryExpression(xorNode: TXorNode): xorNode is XorNode<Ast.TPrimaryExpression> {
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

export function isTFieldAccessExpression(xorNode: TXorNode): xorNode is XorNode<Ast.TFieldAccessExpression> {
    return xorNode.node.kind === Ast.NodeKind.FieldSelector || xorNode.node.kind === Ast.NodeKind.FieldProjection;
}

export function assertAst(xorNode: TXorNode): Ast.TNode {
    assertIsAst(xorNode);

    return xorNode.node;
}

export function assertAstChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    const astNode: Ast.TNode = assertAst(xorNode);
    AstUtils.assertIsNodeKind(astNode, expectedNodeKinds);

    return astNode;
}

export function assertContext(xorNode: TXorNode): ParseContext.TNode {
    assertIsContext(xorNode);

    return xorNode.node;
}

export function assertContextChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    assertIsContextChecked(xorNode, expectedNodeKinds);

    return xorNode.node;
}

export function assertAsNodeKind<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    assertIsNodeKind(xorNode, expectedNodeKinds);

    return xorNode;
}

export function assertIsAst(xorNode: TXorNode): asserts xorNode is TAstXorNode {
    Assert.isTrue(isAst(xorNode), "expected xorNode to hold an Ast node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsAstChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts xorNode is AstXorNode<T> {
    assertIsAst(xorNode);
    assertIsNodeKind(xorNode, expectedNodeKinds);
}

export function assertIsContext(xorNode: TXorNode): asserts xorNode is TContextXorNode {
    Assert.isTrue(isContext(xorNode), "expected xorNode to hold an Context node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsContextChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts xorNode is ContextXorNode<T> {
    assertIsContext(xorNode);
    assertIsNodeKind(xorNode, expectedNodeKinds);
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
    } else {
        Assert.isTrue(xorNode.node.kind === expectedNodeKinds, "xorNode.node.kind === expectedNodeKinds", {
            nodeId: xorNode.node.id,
            nodeKind: xorNode.node.kind,
            expectedNodeKind: expectedNodeKinds,
        });
    }
}

export function assertIsIdentifier(
    xorNode: TXorNode,
): asserts xorNode is XorNode<Ast.Identifier | Ast.IdentifierExpression> {
    assertIsNodeKind(xorNode, [Ast.NodeKind.Identifier, Ast.NodeKind.IdentifierExpression]);
}

export function assertIsList(xorNode: TXorNode): asserts xorNode is XorNode<Ast.ListExpression | Ast.ListLiteral> {
    assertIsNodeKind(xorNode, [Ast.NodeKind.ListExpression, Ast.NodeKind.ListLiteral]);
}

export function assertIsRecord(
    xorNode: TXorNode,
): asserts xorNode is XorNode<Ast.RecordExpression | Ast.RecordLiteral> {
    assertIsNodeKind(xorNode, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);
}

export function isTWrapped(xorNode: TXorNode): xorNode is XorNode<Ast.TWrapped> {
    return isNodeKind<Ast.TWrapped>(xorNode, [
        Ast.NodeKind.FieldProjection,
        Ast.NodeKind.FieldSelector,
        Ast.NodeKind.FieldSpecificationList,
        Ast.NodeKind.InvokeExpression,
        Ast.NodeKind.ItemAccessExpression,
        Ast.NodeKind.ListExpression,
        Ast.NodeKind.ListLiteral,
        Ast.NodeKind.ListType,
        Ast.NodeKind.ParameterList,
        Ast.NodeKind.ParenthesizedExpression,
        Ast.NodeKind.RecordExpression,
        Ast.NodeKind.RecordLiteral,
    ]);
}

export function identifierExpressionLiteral(xorNode: TXorNode): string | undefined {
    const identifierExpression: Ast.IdentifierExpression | undefined = astChecked(
        xorNode,
        Ast.NodeKind.IdentifierExpression,
    );

    if (identifierExpression === undefined) {
        return undefined;
    }

    return identifierExpression.inclusiveConstant === undefined
        ? identifierExpression.identifier.literal
        : identifierExpression.inclusiveConstant.constantKind + identifierExpression.identifier.literal;
}
