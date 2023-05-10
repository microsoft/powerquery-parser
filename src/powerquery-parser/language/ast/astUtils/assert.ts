// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as TypeGuards from "./typeGuards";
import { Ast } from "..";
import { CommonError } from "../../../common";

export function assertAsNodeKind<T extends Ast.TNode>(
    node: Ast.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    assertIsNodeKind(node, expectedNodeKinds);

    return node;
}

export function assertAsTBinOpExpression(node: Ast.TNode): Ast.TBinOpExpression {
    return assertAsNodeKind(node, [
        Ast.NodeKind.ArithmeticExpression,
        Ast.NodeKind.AsExpression,
        Ast.NodeKind.EqualityExpression,
        Ast.NodeKind.IsExpression,
        Ast.NodeKind.LogicalExpression,
        Ast.NodeKind.MetadataExpression,
        Ast.NodeKind.RelationalExpression,
    ]);
}

export function assertAsTKeyValuePair(node: Ast.TNode): Ast.TKeyValuePair {
    return assertAsNodeKind(node, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.IdentifierPairedExpression,
    ]);
}

export function assertAsTPairedConstant(node: Ast.TNode): Ast.TPairedConstant {
    return assertAsNodeKind(node, [
        Ast.NodeKind.AsNullablePrimitiveType,
        Ast.NodeKind.AsType,
        Ast.NodeKind.ErrorRaisingExpression,
        Ast.NodeKind.IsNullablePrimitiveType,
        Ast.NodeKind.NullablePrimitiveType,
        Ast.NodeKind.NullableType,
        Ast.NodeKind.OtherwiseExpression,
        Ast.NodeKind.TypePrimaryType,
    ]);
}

export function assertIsNodeKind<T extends Ast.TNode>(
    node: Ast.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts node is T {
    if (!TypeGuards.isNodeKind(node, expectedNodeKinds)) {
        throw new CommonError.InvariantError(`unexpected node kind`, {
            nodeId: node.id,
            nodeKind: node.kind,
            expectedNodeKinds,
        });
    }
}

export function assertIsTBinOpExpression(node: Ast.TNode): asserts node is Ast.TBinOpExpression {
    assertIsNodeKind(node, [
        Ast.NodeKind.ArithmeticExpression,
        Ast.NodeKind.AsExpression,
        Ast.NodeKind.EqualityExpression,
        Ast.NodeKind.IsExpression,
        Ast.NodeKind.LogicalExpression,
        Ast.NodeKind.MetadataExpression,
        Ast.NodeKind.RelationalExpression,
    ]);
}

export function assertIsTKeyValuePair(node: Ast.TNode): asserts node is Ast.TKeyValuePair {
    assertIsNodeKind(node, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.IdentifierPairedExpression,
    ]);
}

export function assertIsTPairedConstant(node: Ast.TNode): asserts node is Ast.TPairedConstant {
    assertIsNodeKind(node, [
        Ast.NodeKind.AsNullablePrimitiveType,
        Ast.NodeKind.AsType,
        Ast.NodeKind.ErrorRaisingExpression,
        Ast.NodeKind.IsNullablePrimitiveType,
        Ast.NodeKind.NullablePrimitiveType,
        Ast.NodeKind.NullableType,
        Ast.NodeKind.OtherwiseExpression,
        Ast.NodeKind.TypePrimaryType,
    ]);
}
