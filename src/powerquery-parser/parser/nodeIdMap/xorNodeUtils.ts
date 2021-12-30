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

export function assertAsNodeKind<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    assertIsNodeKind(xorNode, expectedNodeKinds);
    return xorNode;
}

export function assertAsFunctionParameterList(xorNode: TXorNode): XorNode<Ast.FieldSpecificationList> {
    assertIsFieldSpecificationList(xorNode);
    return xorNode;
}

export function assertAsInvokeExpression(xorNode: TXorNode): XorNode<Ast.InvokeExpression> {
    assertIsInvokeExpression(xorNode);
    return xorNode;
}

export function assertAsLetExpression(xorNode: TXorNode): XorNode<Ast.LetExpression> {
    assertIsLetExpression(xorNode);
    return xorNode;
}

export function assertAsList(xorNode: TXorNode): XorNode<Ast.ListExpression | Ast.ListLiteral> {
    assertIsList(xorNode);
    return xorNode;
}

export function assertAsParameter(xorNode: TXorNode): XorNode<Ast.TParameter> {
    assertIsParameter(xorNode);
    return xorNode;
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

export function assertIsAstXor(xorNode: TXorNode): asserts xorNode is TAstXorNode {
    Assert.isTrue(isAstXor(xorNode), "expected xorNode to hold an Ast node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsAstXorChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts xorNode is AstXorNode<T> {
    assertIsAstXor(xorNode);
    assertIsNodeKind(xorNode, expectedNodeKinds);
}

export function assertIsContextXor(xorNode: TXorNode): asserts xorNode is TContextXorNode {
    Assert.isTrue(isContextXor(xorNode), "expected xorNode to hold an Context node", {
        xorNodeKind: xorNode.kind,
        xorNodeId: xorNode.node.id,
    });
}

export function assertIsContextXorChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts xorNode is ContextXorNode<T> {
    assertIsContextXor(xorNode);
    assertIsNodeKind(xorNode, expectedNodeKinds);
}

export function assertIsIdentifier(
    xorNode: TXorNode,
): asserts xorNode is XorNode<Ast.Identifier | Ast.IdentifierExpression> {
    assertIsNodeKind(xorNode, [Ast.NodeKind.Identifier, Ast.NodeKind.IdentifierExpression]);
}

export function assertIsRecord(
    xorNode: TXorNode,
): asserts xorNode is XorNode<Ast.RecordExpression | Ast.RecordLiteral> {
    assertIsNodeKind(xorNode, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);
}

export function assertIsFieldSpecificationList(
    xorNode: TXorNode,
): asserts xorNode is XorNode<Ast.FieldSpecificationList> {
    assertIsNodeKind(xorNode, Ast.NodeKind.FieldSpecificationList);
}

export function assertIsInvokeExpression(xorNode: TXorNode): asserts xorNode is XorNode<Ast.InvokeExpression> {
    assertIsNodeKind(xorNode, Ast.NodeKind.InvokeExpression);
}

export function assertIsLetExpression(xorNode: TXorNode): asserts xorNode is XorNode<Ast.LetExpression> {
    assertIsNodeKind(xorNode, Ast.NodeKind.LetExpression);
}

export function assertIsList(xorNode: TXorNode): asserts xorNode is XorNode<Ast.ListExpression | Ast.ListLiteral> {
    assertIsNodeKind(xorNode, [Ast.NodeKind.ListExpression, Ast.NodeKind.ListLiteral]);
}

export function assertIsParameter(xorNode: TXorNode): asserts xorNode is XorNode<Ast.TParameter> {
    assertIsNodeKind(xorNode, Ast.NodeKind.Parameter);
}

export function assertUnboxAst(xorNode: TXorNode): Ast.TNode {
    assertIsAstXor(xorNode);
    return xorNode.node;
}

export function assertUnboxAstChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    const astNode: Ast.TNode = assertUnboxAst(xorNode);
    AstUtils.assertIsNodeKind(astNode, expectedNodeKinds);
    return astNode;
}

export function assertUnboxContext(xorNode: TXorNode): ParseContext.TNode {
    assertIsContextXor(xorNode);
    return xorNode.node;
}

export function assertUnboxContextChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    assertIsContextXorChecked(xorNode, expectedNodeKinds);
    return xorNode.node;
}

export function isAstXor(xorNode: TXorNode): xorNode is TAstXorNode {
    return xorNode.kind === XorNodeKind.Ast;
}

export function isAstXorChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): xorNode is AstXorNode<T> {
    return isAstXor(xorNode) && AstUtils.isNodeKind(xorNode.node, expectedNodeKinds);
}

export function isContextXor<T extends Ast.TNode>(xorNode: TXorNode): xorNode is ContextXorNode<T> {
    return xorNode.kind === XorNodeKind.Context;
}

export function isContextXorChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): xorNode is ContextXorNode<T> {
    return isContextXor(xorNode) && ParseContextUtils.isNodeKind(xorNode.node, expectedNodeKinds);
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

export function maybeIdentifierExpressionLiteral(xorNode: TXorNode): string | undefined {
    const maybeIdentifierExpression: Ast.IdentifierExpression | undefined = maybeUnboxAstChecked(
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

export function maybeUnboxAst(xorNode: TXorNode): Ast.TNode | undefined {
    return isAstXor(xorNode) ? xorNode.node : undefined;
}

export function maybeUnboxAstChecked<T extends Ast.TNode>(
    xorNode: TXorNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeUnboxAst(xorNode);
    return maybeAstNode && AstUtils.isNodeKind(maybeAstNode, expectedNodeKinds) ? maybeAstNode : undefined;
}
