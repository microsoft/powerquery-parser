// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
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

        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.CatchExpression:
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.Csv:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.ErrorHandlingExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.FieldProjection:
        case Ast.NodeKind.FieldSelector:
        case Ast.NodeKind.FieldSpecification:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.FunctionExpression:
        case Ast.NodeKind.FunctionType:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
        case Ast.NodeKind.IfExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.IsNullablePrimitiveType:
        case Ast.NodeKind.ItemAccessExpression:
        case Ast.NodeKind.LetExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ListType:
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.NotImplementedExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.Parameter:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.PrimitiveType:
        case Ast.NodeKind.RangeExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordType:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.Section:
        case Ast.NodeKind.SectionMember:
        case Ast.NodeKind.TableType:
        case Ast.NodeKind.TypePrimaryType:
        case Ast.NodeKind.UnaryExpression:
            return false;

        default:
            throw Assert.isNever(nodeKind);
    }
}

export function isTKeyValuePair(node: Ast.TNode): node is Ast.TKeyValuePair {
    const nodeKind: Ast.NodeKind = node.kind;

    switch (nodeKind) {
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            return true;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.CatchExpression:
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.Csv:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.ErrorHandlingExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.FieldProjection:
        case Ast.NodeKind.FieldSelector:
        case Ast.NodeKind.FieldSpecification:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.FunctionExpression:
        case Ast.NodeKind.FunctionType:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.IfExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.IsNullablePrimitiveType:
        case Ast.NodeKind.ItemAccessExpression:
        case Ast.NodeKind.LetExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ListType:
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.MetadataExpression:
        case Ast.NodeKind.NotImplementedExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.NullCoalescingExpression:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.Parameter:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.PrimitiveType:
        case Ast.NodeKind.RangeExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordType:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.RelationalExpression:
        case Ast.NodeKind.Section:
        case Ast.NodeKind.SectionMember:
        case Ast.NodeKind.TableType:
        case Ast.NodeKind.TypePrimaryType:
        case Ast.NodeKind.UnaryExpression:
            return false;

        default:
            throw Assert.isNever(nodeKind);
    }
}

export function isTPairedConstant(node: Ast.TNode): node is Ast.TPairedConstant {
    const nodeKind: Ast.NodeKind = node.kind;

    switch (nodeKind) {
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.IsNullablePrimitiveType:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.TypePrimaryType:
            return true;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.CatchExpression:
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.Csv:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.ErrorHandlingExpression:
        case Ast.NodeKind.FieldProjection:
        case Ast.NodeKind.FieldSelector:
        case Ast.NodeKind.FieldSpecification:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.FunctionExpression:
        case Ast.NodeKind.FunctionType:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
        case Ast.NodeKind.IfExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.ItemAccessExpression:
        case Ast.NodeKind.LetExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ListType:
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.MetadataExpression:
        case Ast.NodeKind.NotImplementedExpression:
        case Ast.NodeKind.NullCoalescingExpression:
        case Ast.NodeKind.Parameter:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.PrimitiveType:
        case Ast.NodeKind.RangeExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordType:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.RelationalExpression:
        case Ast.NodeKind.Section:
        case Ast.NodeKind.SectionMember:
        case Ast.NodeKind.TableType:
        case Ast.NodeKind.UnaryExpression:
            return false;

        default:
            throw Assert.isNever(nodeKind);
    }
}
