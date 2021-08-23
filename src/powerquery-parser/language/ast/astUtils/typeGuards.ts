// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "..";

export function isArithmeticExpression(node: Ast.TNode): node is Ast.ArithmeticExpression {
    return node.kind === Ast.NodeKind.ArithmeticExpression;
}

export function isAsExpression(node: Ast.TNode): node is Ast.AsExpression {
    return node.kind === Ast.NodeKind.AsExpression;
}

export function isAsNullablePrimitiveType(node: Ast.TNode): node is Ast.AsNullablePrimitiveType {
    return node.kind === Ast.NodeKind.AsNullablePrimitiveType;
}

export function isAsType(node: Ast.TNode): node is Ast.AsType {
    return node.kind === Ast.NodeKind.AsType;
}

export function isEachExpression(node: Ast.TNode): node is Ast.EachExpression {
    return node.kind === Ast.NodeKind.EachExpression;
}

export function isEqualityExpression(node: Ast.TNode): node is Ast.EqualityExpression {
    return node.kind === Ast.NodeKind.EqualityExpression;
}

export function isErrorHandlingExpression(node: Ast.TNode): node is Ast.ErrorHandlingExpression {
    return node.kind === Ast.NodeKind.ErrorHandlingExpression;
}

export function isErrorRaisingExpression(node: Ast.TNode): node is Ast.ErrorRaisingExpression {
    return node.kind === Ast.NodeKind.ErrorRaisingExpression;
}

export function isFieldProjection(node: Ast.TNode): node is Ast.FieldProjection {
    return node.kind === Ast.NodeKind.FieldProjection;
}

export function isFieldSelector(node: Ast.TNode): node is Ast.FieldSelector {
    return node.kind === Ast.NodeKind.FieldSelector;
}

export function isFieldSpecification(node: Ast.TNode): node is Ast.FieldSpecification {
    return node.kind === Ast.NodeKind.FieldSpecification;
}

export function isFieldSpecificationList(node: Ast.TNode): node is Ast.FieldSpecificationList {
    return node.kind === Ast.NodeKind.FieldSpecificationList;
}

export function isFieldTypeSpecification(node: Ast.TNode): node is Ast.FieldTypeSpecification {
    return node.kind === Ast.NodeKind.FieldTypeSpecification;
}

export function isFunctionExpression(node: Ast.TNode): node is Ast.FunctionExpression {
    return node.kind === Ast.NodeKind.FunctionExpression;
}

export function isFunctionType(node: Ast.TNode): node is Ast.FunctionType {
    return node.kind === Ast.NodeKind.FunctionType;
}

export function isGeneralizedIdentifier(node: Ast.TNode): node is Ast.GeneralizedIdentifier {
    return node.kind === Ast.NodeKind.GeneralizedIdentifier;
}

export function isGeneralizedIdentifierPairedAnyLiteral(
    node: Ast.TNode,
): node is Ast.GeneralizedIdentifierPairedAnyLiteral {
    return node.kind === Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral;
}

export function isGeneralizedIdentifierPairedExpression(
    node: Ast.TNode,
): node is Ast.GeneralizedIdentifierPairedExpression {
    return node.kind === Ast.NodeKind.GeneralizedIdentifierPairedExpression;
}

export function isIdentifier(node: Ast.TNode): node is Ast.Identifier {
    return node.kind === Ast.NodeKind.Identifier;
}

export function isIdentifierExpression(node: Ast.TNode): node is Ast.IdentifierExpression {
    return node.kind === Ast.NodeKind.IdentifierExpression;
}

export function isIdentifierPairedExpression(node: Ast.TNode): node is Ast.IdentifierPairedExpression {
    return node.kind === Ast.NodeKind.IdentifierPairedExpression;
}

export function isIfExpression(node: Ast.TNode): node is Ast.IfExpression {
    return node.kind === Ast.NodeKind.IfExpression;
}

export function isInvokeExpression(node: Ast.TNode): node is Ast.InvokeExpression {
    return node.kind === Ast.NodeKind.InvokeExpression;
}

export function isIsExpression(node: Ast.TNode): node is Ast.IsExpression {
    return node.kind === Ast.NodeKind.IsExpression;
}

export function isIsNullablePrimitiveType(node: Ast.TNode): node is Ast.IsNullablePrimitiveType {
    return node.kind === Ast.NodeKind.IsNullablePrimitiveType;
}

export function isItemAccessExpression(node: Ast.TNode): node is Ast.ItemAccessExpression {
    return node.kind === Ast.NodeKind.ItemAccessExpression;
}

export function isLetExpression(node: Ast.TNode): node is Ast.LetExpression {
    return node.kind === Ast.NodeKind.LetExpression;
}

export function isListExpression(node: Ast.TNode): node is Ast.ListExpression {
    return node.kind === Ast.NodeKind.ListExpression;
}

export function isListLiteral(node: Ast.TNode): node is Ast.ListLiteral {
    return node.kind === Ast.NodeKind.ListLiteral;
}

export function isListType(node: Ast.TNode): node is Ast.ListType {
    return node.kind === Ast.NodeKind.ListType;
}

export function isLiteralExpression(node: Ast.TNode): node is Ast.LiteralExpression {
    return node.kind === Ast.NodeKind.LiteralExpression;
}

export function isLogicalExpression(node: Ast.TNode): node is Ast.LogicalExpression {
    return node.kind === Ast.NodeKind.LogicalExpression;
}

export function isMetadataExpression(node: Ast.TNode): node is Ast.MetadataExpression {
    return node.kind === Ast.NodeKind.MetadataExpression;
}

export function isNodeKind<T extends Ast.TNode>(
    node: Ast.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): node is T {
    return Array.isArray(expectedNodeKinds) ? expectedNodeKinds.includes(node.kind) : node.kind === expectedNodeKinds;
}

export function isNotImplementedExpression(node: Ast.TNode): node is Ast.NotImplementedExpression {
    return node.kind === Ast.NodeKind.NotImplementedExpression;
}

export function isNullCoalescingExpression(node: Ast.TNode): node is Ast.NullCoalescingExpression {
    return node.kind === Ast.NodeKind.NullCoalescingExpression;
}

export function isNullablePrimitiveType(node: Ast.TNode): node is Ast.NullablePrimitiveType {
    return node.kind === Ast.NodeKind.NullablePrimitiveType;
}

export function isNullableType(node: Ast.TNode): node is Ast.NullableType {
    return node.kind === Ast.NodeKind.NullableType;
}

export function isOtherwiseExpression(node: Ast.TNode): node is Ast.OtherwiseExpression {
    return node.kind === Ast.NodeKind.OtherwiseExpression;
}

export function isParameter(node: Ast.TNode): node is Ast.TParameter {
    return node.kind === Ast.NodeKind.Parameter;
}

export function isParenthesizedExpression(node: Ast.TNode): node is Ast.ParenthesizedExpression {
    return node.kind === Ast.NodeKind.ParenthesizedExpression;
}

export function isPrimitiveType(node: Ast.TNode): node is Ast.PrimitiveType {
    return node.kind === Ast.NodeKind.PrimitiveType;
}

export function isRangeExpression(node: Ast.TNode): node is Ast.RangeExpression {
    return node.kind === Ast.NodeKind.RangeExpression;
}

export function isRecordExpression(node: Ast.TNode): node is Ast.RecordExpression {
    return node.kind === Ast.NodeKind.RecordExpression;
}

export function isRecordLiteral(node: Ast.TNode): node is Ast.RecordLiteral {
    return node.kind === Ast.NodeKind.RecordLiteral;
}

export function isRecordType(node: Ast.TNode): node is Ast.RecordType {
    return node.kind === Ast.NodeKind.RecordType;
}

export function isRecursivePrimaryExpression(node: Ast.TNode): node is Ast.RecursivePrimaryExpression {
    return node.kind === Ast.NodeKind.RecursivePrimaryExpression;
}

export function isRelationalExpression(node: Ast.TNode): node is Ast.RelationalExpression {
    return node.kind === Ast.NodeKind.RelationalExpression;
}

export function isSection(node: Ast.TNode): node is Ast.Section {
    return node.kind === Ast.NodeKind.Section;
}

export function isSectionMember(node: Ast.TNode): node is Ast.SectionMember {
    return node.kind === Ast.NodeKind.SectionMember;
}

export function isTableType(node: Ast.TNode): node is Ast.TableType {
    return node.kind === Ast.NodeKind.TableType;
}

export function isTArrayWrapper(node: Ast.TNode): node is Ast.TArrayWrapper {
    return node.kind === Ast.NodeKind.ArrayWrapper;
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

export function isTConstant(node: Ast.TNode): node is Ast.TConstant {
    return node.kind === Ast.NodeKind.Constant;
}

export function isTCsv(node: Ast.TNode): node is Ast.TCsv {
    return node.kind === Ast.NodeKind.Csv;
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

export function isTypePrimaryType(node: Ast.TNode): node is Ast.TypePrimaryType {
    return node.kind === Ast.NodeKind.TypePrimaryType;
}

export function isUnaryExpression(node: Ast.TNode): node is Ast.UnaryExpression {
    return node.kind === Ast.NodeKind.UnaryExpression;
}
