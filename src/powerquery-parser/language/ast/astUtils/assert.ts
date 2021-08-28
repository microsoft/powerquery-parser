// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as TypeGuards from "./typeGuards";

import { Ast } from "..";
import { CommonError } from "../../../common";

export function assertAsArithmeticExpression(node: Ast.TNode): Ast.ArithmeticExpression {
    return assertAs(TypeGuards.isArithmeticExpression, node, [Ast.NodeKind.ArithmeticExpression]);
}

export function assertAsAsExpression(node: Ast.TNode): Ast.AsExpression {
    return assertAs(TypeGuards.isAsExpression, node, [Ast.NodeKind.AsExpression]);
}

export function assertAsAsNullablePrimitiveType(node: Ast.TNode): Ast.AsNullablePrimitiveType {
    return assertAs(TypeGuards.isAsNullablePrimitiveType, node, [Ast.NodeKind.AsNullablePrimitiveType]);
}

export function assertAsEachExpression(node: Ast.TNode): Ast.EachExpression {
    return assertAs(TypeGuards.isEachExpression, node, [Ast.NodeKind.EachExpression]);
}

export function assertAsEqualityExpression(node: Ast.TNode): Ast.EqualityExpression {
    return assertAs(TypeGuards.isEqualityExpression, node, [Ast.NodeKind.EqualityExpression]);
}

export function assertAsErrorHandlingExpression(node: Ast.TNode): Ast.ErrorHandlingExpression {
    return assertAs(TypeGuards.isErrorHandlingExpression, node, [Ast.NodeKind.ErrorHandlingExpression]);
}

export function assertAsErrorRaisingExpression(node: Ast.TNode): Ast.ErrorRaisingExpression {
    return assertAs(TypeGuards.isErrorRaisingExpression, node, [Ast.NodeKind.ErrorRaisingExpression]);
}

export function assertAsFieldProjection(node: Ast.TNode): Ast.FieldProjection {
    return assertAs(TypeGuards.isFieldProjection, node, [Ast.NodeKind.FieldProjection]);
}

export function assertAsFieldSelector(node: Ast.TNode): Ast.FieldSelector {
    return assertAs(TypeGuards.isFieldSelector, node, [Ast.NodeKind.FieldSelector]);
}

export function assertAsFieldSpecification(node: Ast.TNode): Ast.FieldSpecification {
    return assertAs(TypeGuards.isFieldSpecification, node, [Ast.NodeKind.FieldSpecification]);
}

export function assertAsFieldSpecificationList(node: Ast.TNode): Ast.FieldSpecificationList {
    return assertAs(TypeGuards.isFieldSpecificationList, node, [Ast.NodeKind.FieldSpecificationList]);
}

export function assertAsFieldTypeSpecification(node: Ast.TNode): Ast.FieldTypeSpecification {
    return assertAs(TypeGuards.isFieldTypeSpecification, node, [Ast.NodeKind.FieldTypeSpecification]);
}

export function assertAsFunctionExpression(node: Ast.TNode): Ast.FunctionExpression {
    return assertAs(TypeGuards.isFunctionExpression, node, [Ast.NodeKind.FunctionExpression]);
}

export function assertAsFunctionType(node: Ast.TNode): Ast.FunctionType {
    return assertAs(TypeGuards.isFunctionType, node, [Ast.NodeKind.FunctionType]);
}

export function assertAsGeneralizedIdentifier(node: Ast.TNode): Ast.GeneralizedIdentifier {
    return assertAs(TypeGuards.isGeneralizedIdentifier, node, [Ast.NodeKind.GeneralizedIdentifier]);
}

export function assertAsGeneralizedIdentifierPairedAnyLiteral(
    node: Ast.TNode,
): Ast.GeneralizedIdentifierPairedAnyLiteral {
    return assertAs(TypeGuards.isGeneralizedIdentifierPairedAnyLiteral, node, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
    ]);
}

export function assertAsGeneralizedIdentifierPairedExpression(
    node: Ast.TNode,
): Ast.GeneralizedIdentifierPairedExpression {
    return assertAs(TypeGuards.isGeneralizedIdentifierPairedExpression, node, [
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
    ]);
}

export function assertAsIdentifier(node: Ast.TNode): Ast.Identifier {
    return assertAs(TypeGuards.isIdentifier, node, [Ast.NodeKind.Identifier]);
}

export function assertAsIdentifierExpression(node: Ast.TNode): Ast.IdentifierExpression {
    return assertAs(TypeGuards.isIdentifierExpression, node, [Ast.NodeKind.IdentifierExpression]);
}

export function assertAsIdentifierPairedExpression(node: Ast.TNode): Ast.IdentifierPairedExpression {
    return assertAs(TypeGuards.isIdentifierPairedExpression, node, [Ast.NodeKind.IdentifierPairedExpression]);
}

export function assertAsIfExpression(node: Ast.TNode): Ast.IfExpression {
    return assertAs(TypeGuards.isIfExpression, node, [Ast.NodeKind.IfExpression]);
}

export function assertAsInvokeExpression(node: Ast.TNode): Ast.InvokeExpression {
    return assertAs(TypeGuards.isInvokeExpression, node, [Ast.NodeKind.InvokeExpression]);
}

export function assertAsIsExpression(node: Ast.TNode): Ast.IsExpression {
    return assertAs(TypeGuards.isIsExpression, node, [Ast.NodeKind.IsExpression]);
}

export function assertAsIsNullablePrimitiveType(node: Ast.TNode): Ast.IsNullablePrimitiveType {
    return assertAs(TypeGuards.isIsNullablePrimitiveType, node, [Ast.NodeKind.IsNullablePrimitiveType]);
}

export function assertAsItemAccessExpression(node: Ast.TNode): Ast.ItemAccessExpression {
    return assertAs(TypeGuards.isItemAccessExpression, node, [Ast.NodeKind.ItemAccessExpression]);
}

export function assertAsLetExpression(node: Ast.TNode): Ast.LetExpression {
    return assertAs(TypeGuards.isLetExpression, node, [Ast.NodeKind.LetExpression]);
}

export function assertAsListExpression(node: Ast.TNode): Ast.ListExpression {
    return assertAs(TypeGuards.isListExpression, node, [Ast.NodeKind.ListExpression]);
}

export function assertAsListLiteral(node: Ast.TNode): Ast.ListLiteral {
    return assertAs(TypeGuards.isListLiteral, node, [Ast.NodeKind.ListLiteral]);
}

export function assertAsListType(node: Ast.TNode): Ast.ListType {
    return assertAs(TypeGuards.isListType, node, [Ast.NodeKind.ListType]);
}

export function assertAsLiteralExpression(node: Ast.TNode): Ast.LiteralExpression {
    return assertAs(TypeGuards.isLiteralExpression, node, [Ast.NodeKind.LiteralExpression]);
}

export function assertAsLogicalExpression(node: Ast.TNode): Ast.LogicalExpression {
    return assertAs(TypeGuards.isLogicalExpression, node, [Ast.NodeKind.LogicalExpression]);
}

export function assertAsMetadataExpression(node: Ast.TNode): Ast.MetadataExpression {
    return assertAs(TypeGuards.isMetadataExpression, node, [Ast.NodeKind.MetadataExpression]);
}

export function assertAsNotImplementedExpression(node: Ast.TNode): Ast.NotImplementedExpression {
    return assertAs(TypeGuards.isNotImplementedExpression, node, [Ast.NodeKind.NotImplementedExpression]);
}

export function assertAsNullCoalescingExpression(node: Ast.TNode): Ast.NullCoalescingExpression {
    return assertAs(TypeGuards.isNullCoalescingExpression, node, [Ast.NodeKind.NullCoalescingExpression]);
}

export function assertAsNullablePrimitiveType(node: Ast.TNode): Ast.NullablePrimitiveType {
    return assertAs(TypeGuards.isNullablePrimitiveType, node, [Ast.NodeKind.NullablePrimitiveType]);
}

export function assertAsNullableType(node: Ast.TNode): Ast.NullableType {
    return assertAs(TypeGuards.isNullableType, node, [Ast.NodeKind.NullableType]);
}

export function assertAsOtherwiseExpression(node: Ast.TNode): Ast.OtherwiseExpression {
    return assertAs(TypeGuards.isOtherwiseExpression, node, [Ast.NodeKind.OtherwiseExpression]);
}

export function assertAsParameter(node: Ast.TNode): Ast.TParameter {
    return assertAs(TypeGuards.isParameter, node, [Ast.NodeKind.Parameter]);
}

export function assertAsParenthesizedExpression(node: Ast.TNode): Ast.ParenthesizedExpression {
    return assertAs(TypeGuards.isParenthesizedExpression, node, [Ast.NodeKind.ParenthesizedExpression]);
}

export function assertAsPrimitiveType(node: Ast.TNode): Ast.PrimitiveType {
    return assertAs(TypeGuards.isPrimitiveType, node, [Ast.NodeKind.PrimitiveType]);
}

export function assertAsRangeExpression(node: Ast.TNode): Ast.RangeExpression {
    return assertAs(TypeGuards.isRangeExpression, node, [Ast.NodeKind.RangeExpression]);
}

export function assertAsRecordExpression(node: Ast.TNode): Ast.RecordExpression {
    return assertAs(TypeGuards.isRecordExpression, node, [Ast.NodeKind.RecordExpression]);
}

export function assertAsRecordLiteral(node: Ast.TNode): Ast.RecordLiteral {
    return assertAs(TypeGuards.isRecordLiteral, node, [Ast.NodeKind.RecordLiteral]);
}

export function assertAsRecordType(node: Ast.TNode): Ast.RecordType {
    return assertAs(TypeGuards.isRecordType, node, [Ast.NodeKind.RecordType]);
}

export function assertAsRecursivePrimaryExpression(node: Ast.TNode): Ast.RecursivePrimaryExpression {
    return assertAs(TypeGuards.isRecursivePrimaryExpression, node, [Ast.NodeKind.RecursivePrimaryExpression]);
}

export function assertAsRelationalExpression(node: Ast.TNode): Ast.RelationalExpression {
    return assertAs(TypeGuards.isRelationalExpression, node, [Ast.NodeKind.RelationalExpression]);
}

export function assertAsSection(node: Ast.TNode): Ast.Section {
    return assertAs(TypeGuards.isSection, node, [Ast.NodeKind.Section]);
}

export function assertAsSectionMember(node: Ast.TNode): Ast.SectionMember {
    return assertAs(TypeGuards.isSectionMember, node, [Ast.NodeKind.SectionMember]);
}

export function assertAsTableType(node: Ast.TNode): Ast.TableType {
    return assertAs(TypeGuards.isTableType, node, [Ast.NodeKind.TableType]);
}

export function assertAsTArrayWrapper(node: Ast.TNode): Ast.TArrayWrapper {
    return assertAs(TypeGuards.isTArrayWrapper, node, [Ast.NodeKind.ArrayWrapper]);
}

export function assertAsTBinOpExpression(node: Ast.TNode): Ast.TBinOpExpression {
    return assertAs(TypeGuards.isTBinOpExpression, node, [
        Ast.NodeKind.ArithmeticExpression,
        Ast.NodeKind.AsExpression,
        Ast.NodeKind.EqualityExpression,
        Ast.NodeKind.IsExpression,
        Ast.NodeKind.LogicalExpression,
        Ast.NodeKind.MetadataExpression,
        Ast.NodeKind.RelationalExpression,
    ]);
}

export function assertAsTConstant(node: Ast.TNode): Ast.TConstant {
    return assertAs(TypeGuards.isTConstant, node, [Ast.NodeKind.Constant]);
}

export function assertAsTCsv(node: Ast.TNode): Ast.TCsv {
    return assertAs(TypeGuards.isTCsv, node, [Ast.NodeKind.Csv]);
}

export function assertAsTKeyValuePair(node: Ast.TNode): Ast.TKeyValuePair {
    return assertAs(TypeGuards.isTKeyValuePair, node, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.IdentifierPairedExpression,
    ]);
}

export function assertAsTPairedConstant(node: Ast.TNode): Ast.TPairedConstant {
    return assertAs(TypeGuards.isTPairedConstant, node, [
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

export function assertAsTypePrimaryType(node: Ast.TNode): Ast.TypePrimaryType {
    return assertAs(TypeGuards.isTypePrimaryType, node, Ast.NodeKind.TypePrimaryType);
}

export function assertAsUnaryExpression(node: Ast.TNode): Ast.UnaryExpression {
    return assertAs(TypeGuards.isUnaryExpression, node, Ast.NodeKind.UnaryExpression);
}

export function assertIsArithmeticExpression(node: Ast.TNode): asserts node is Ast.ArithmeticExpression {
    assertIsNodeKind(TypeGuards.isArithmeticExpression, node, Ast.NodeKind.ArithmeticExpression);
}

export function assertIsAsExpression(node: Ast.TNode): asserts node is Ast.AsExpression {
    assertIsNodeKind(TypeGuards.isAsExpression, node, Ast.NodeKind.AsExpression);
}

export function assertIsAsNullablePrimitiveType(node: Ast.TNode): asserts node is Ast.AsNullablePrimitiveType {
    assertIsNodeKind(TypeGuards.isAsNullablePrimitiveType, node, Ast.NodeKind.AsNullablePrimitiveType);
}

export function assertIsEachExpression(node: Ast.TNode): asserts node is Ast.EachExpression {
    assertIsNodeKind(TypeGuards.isEachExpression, node, Ast.NodeKind.EachExpression);
}

export function assertIsEqualityExpression(node: Ast.TNode): asserts node is Ast.EqualityExpression {
    assertIsNodeKind(TypeGuards.isEqualityExpression, node, Ast.NodeKind.EqualityExpression);
}

export function assertIsErrorHandlingExpression(node: Ast.TNode): asserts node is Ast.ErrorHandlingExpression {
    assertIsNodeKind(TypeGuards.isErrorHandlingExpression, node, Ast.NodeKind.ErrorHandlingExpression);
}

export function assertIsErrorRaisingExpression(node: Ast.TNode): asserts node is Ast.ErrorRaisingExpression {
    assertIsNodeKind(TypeGuards.isErrorRaisingExpression, node, Ast.NodeKind.ErrorRaisingExpression);
}

export function assertIsFieldProjection(node: Ast.TNode): asserts node is Ast.FieldProjection {
    assertIsNodeKind(TypeGuards.isFieldProjection, node, Ast.NodeKind.FieldProjection);
}

export function assertIsFieldSelector(node: Ast.TNode): asserts node is Ast.FieldSelector {
    assertIsNodeKind(TypeGuards.isFieldSelector, node, Ast.NodeKind.FieldSelector);
}

export function assertIsFieldSpecification(node: Ast.TNode): asserts node is Ast.FieldSpecification {
    assertIsNodeKind(TypeGuards.isFieldSpecification, node, Ast.NodeKind.FieldSpecification);
}

export function assertIsFieldSpecificationList(node: Ast.TNode): asserts node is Ast.FieldSpecificationList {
    assertIsNodeKind(TypeGuards.isFieldSpecificationList, node, Ast.NodeKind.FieldSpecificationList);
}

export function assertIsFieldTypeSpecification(node: Ast.TNode): asserts node is Ast.FieldTypeSpecification {
    assertIsNodeKind(TypeGuards.isFieldTypeSpecification, node, Ast.NodeKind.FieldTypeSpecification);
}

export function assertIsFunctionExpression(node: Ast.TNode): asserts node is Ast.FunctionExpression {
    assertIsNodeKind(TypeGuards.isFunctionExpression, node, Ast.NodeKind.FunctionExpression);
}

export function assertIsFunctionType(node: Ast.TNode): asserts node is Ast.FunctionType {
    assertIsNodeKind(TypeGuards.isFunctionType, node, Ast.NodeKind.FunctionType);
}

export function assertIsGeneralizedIdentifier(node: Ast.TNode): asserts node is Ast.GeneralizedIdentifier {
    assertIsNodeKind(TypeGuards.isGeneralizedIdentifier, node, Ast.NodeKind.GeneralizedIdentifier);
}

export function assertIsGeneralizedIdentifierPairedAnyLiteral(
    node: Ast.TNode,
): asserts node is Ast.GeneralizedIdentifierPairedAnyLiteral {
    assertIsNodeKind(TypeGuards.isGeneralizedIdentifierPairedAnyLiteral, node, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
    ]);
}

export function assertIsGeneralizedIdentifierPairedExpression(
    node: Ast.TNode,
): asserts node is Ast.GeneralizedIdentifierPairedExpression {
    assertIsNodeKind(TypeGuards.isGeneralizedIdentifierPairedExpression, node, [
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
    ]);
}

export function assertIsIdentifier(node: Ast.TNode): asserts node is Ast.Identifier {
    assertIsNodeKind(TypeGuards.isIdentifier, node, Ast.NodeKind.Identifier);
}

export function assertIsIdentifierExpression(node: Ast.TNode): asserts node is Ast.IdentifierExpression {
    assertIsNodeKind(TypeGuards.isIdentifierExpression, node, Ast.NodeKind.IdentifierExpression);
}

export function assertIsIdentifierPairedExpression(node: Ast.TNode): asserts node is Ast.IdentifierPairedExpression {
    assertIsNodeKind(TypeGuards.isIdentifierPairedExpression, node, Ast.NodeKind.IdentifierPairedExpression);
}

export function assertIsIfExpression(node: Ast.TNode): asserts node is Ast.IfExpression {
    assertIsNodeKind(TypeGuards.isIfExpression, node, Ast.NodeKind.IfExpression);
}

export function assertIsInvokeExpression(node: Ast.TNode): asserts node is Ast.InvokeExpression {
    assertIsNodeKind(TypeGuards.isInvokeExpression, node, Ast.NodeKind.InvokeExpression);
}

export function assertIsIsExpression(node: Ast.TNode): asserts node is Ast.IsExpression {
    assertIsNodeKind(TypeGuards.isIsExpression, node, Ast.NodeKind.IsExpression);
}

export function assertIsIsNullablePrimitiveType(node: Ast.TNode): asserts node is Ast.IsNullablePrimitiveType {
    assertIsNodeKind(TypeGuards.isIsNullablePrimitiveType, node, Ast.NodeKind.IsNullablePrimitiveType);
}

export function assertIsItemAccessExpression(node: Ast.TNode): asserts node is Ast.ItemAccessExpression {
    assertIsNodeKind(TypeGuards.isItemAccessExpression, node, Ast.NodeKind.ItemAccessExpression);
}

export function assertIsLetExpression(node: Ast.TNode): asserts node is Ast.LetExpression {
    assertIsNodeKind(TypeGuards.isLetExpression, node, Ast.NodeKind.LetExpression);
}

export function assertIsListExpression(node: Ast.TNode): asserts node is Ast.ListExpression {
    assertIsNodeKind(TypeGuards.isListExpression, node, Ast.NodeKind.ListExpression);
}

export function assertIsListLiteral(node: Ast.TNode): asserts node is Ast.ListLiteral {
    assertIsNodeKind(TypeGuards.isListLiteral, node, Ast.NodeKind.ListLiteral);
}

export function assertIsListType(node: Ast.TNode): asserts node is Ast.ListType {
    assertIsNodeKind(TypeGuards.isListType, node, Ast.NodeKind.ListType);
}

export function assertIsLiteralExpression(node: Ast.TNode): asserts node is Ast.LiteralExpression {
    assertIsNodeKind(TypeGuards.isLiteralExpression, node, Ast.NodeKind.LiteralExpression);
}

export function assertIsLogicalExpression(node: Ast.TNode): asserts node is Ast.LogicalExpression {
    assertIsNodeKind(TypeGuards.isLogicalExpression, node, Ast.NodeKind.LogicalExpression);
}

export function assertIsMetadataExpression(node: Ast.TNode): asserts node is Ast.MetadataExpression {
    assertIsNodeKind(TypeGuards.isMetadataExpression, node, Ast.NodeKind.MetadataExpression);
}

export function assertIsNodeKind<T extends Ast.TNode>(
    predicateFn: (node: Ast.TNode, expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"]) => node is T,
    node: Ast.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts node is T {
    if (!predicateFn(node, expectedNodeKinds)) {
        throw new CommonError.InvariantError(`unexpected node kind`, {
            nodeId: node.id,
            nodeKind: node.kind,
            expectedNodeKinds,
        });
    }
}

export function assertIsNotImplementedExpression(node: Ast.TNode): asserts node is Ast.NotImplementedExpression {
    assertIsNodeKind<Ast.NotImplementedExpression>(
        TypeGuards.isNotImplementedExpression,
        node,
        Ast.NodeKind.NotImplementedExpression,
    );
}

export function assertIsNullCoalescingExpression(node: Ast.TNode): asserts node is Ast.NullCoalescingExpression {
    assertIsNodeKind(TypeGuards.isNullCoalescingExpression, node, Ast.NodeKind.NullCoalescingExpression);
}

export function assertIsNullablePrimitiveType(node: Ast.TNode): asserts node is Ast.NullablePrimitiveType {
    assertIsNodeKind(TypeGuards.isNullablePrimitiveType, node, Ast.NodeKind.NullablePrimitiveType);
}

export function assertIsNullableType(node: Ast.TNode): asserts node is Ast.NullableType {
    assertIsNodeKind(TypeGuards.isNullableType, node, Ast.NodeKind.NullableType);
}

export function assertIsOtherwiseExpression(node: Ast.TNode): asserts node is Ast.OtherwiseExpression {
    assertIsNodeKind(TypeGuards.isOtherwiseExpression, node, Ast.NodeKind.OtherwiseExpression);
}

export function assertIsParenthesizedExpression(node: Ast.TNode): asserts node is Ast.ParenthesizedExpression {
    assertIsNodeKind(TypeGuards.isParenthesizedExpression, node, Ast.NodeKind.ParenthesizedExpression);
}

export function assertIsPrimitiveType(node: Ast.TNode): asserts node is Ast.PrimitiveType {
    assertIsNodeKind(TypeGuards.isPrimitiveType, node, Ast.NodeKind.PrimitiveType);
}

export function assertIsRangeExpression(node: Ast.TNode): asserts node is Ast.RangeExpression {
    assertIsNodeKind(TypeGuards.isRangeExpression, node, Ast.NodeKind.RangeExpression);
}

export function assertIsRecordExpression(node: Ast.TNode): asserts node is Ast.RecordExpression {
    assertIsNodeKind(TypeGuards.isRecordExpression, node, Ast.NodeKind.RecordExpression);
}

export function assertIsRecordLiteral(node: Ast.TNode): asserts node is Ast.RecordLiteral {
    assertIsNodeKind(TypeGuards.isRecordLiteral, node, Ast.NodeKind.RecordLiteral);
}

export function assertIsRecordType(node: Ast.TNode): asserts node is Ast.RecordType {
    assertIsNodeKind(TypeGuards.isRecordType, node, Ast.NodeKind.RecordType);
}

export function assertIsRecursivePrimaryExpression(node: Ast.TNode): asserts node is Ast.RecursivePrimaryExpression {
    assertIsNodeKind(TypeGuards.isRecursivePrimaryExpression, node, Ast.NodeKind.RecursivePrimaryExpression);
}

export function assertIsRelationalExpression(node: Ast.TNode): asserts node is Ast.RelationalExpression {
    assertIsNodeKind(TypeGuards.isRelationalExpression, node, Ast.NodeKind.RelationalExpression);
}

export function assertIsSection(node: Ast.TNode): asserts node is Ast.Section {
    assertIsNodeKind(TypeGuards.isSection, node, Ast.NodeKind.Section);
}

export function assertIsSectionMember(node: Ast.TNode): asserts node is Ast.SectionMember {
    assertIsNodeKind(TypeGuards.isSectionMember, node, Ast.NodeKind.SectionMember);
}

export function assertIsTableType(node: Ast.TNode): asserts node is Ast.TableType {
    assertIsNodeKind(TypeGuards.isTableType, node, Ast.NodeKind.TableType);
}

export function assertIsTArrayWrapper(node: Ast.TNode): asserts node is Ast.TArrayWrapper {
    assertIsNodeKind(TypeGuards.isTArrayWrapper, node, Ast.NodeKind.ArrayWrapper);
}

export function assertIsTBinOpExpression(node: Ast.TNode): asserts node is Ast.TBinOpExpression {
    assertIsNodeKind(TypeGuards.isTBinOpExpression, node, [
        Ast.NodeKind.ArithmeticExpression,
        Ast.NodeKind.AsExpression,
        Ast.NodeKind.EqualityExpression,
        Ast.NodeKind.IsExpression,
        Ast.NodeKind.LogicalExpression,
        Ast.NodeKind.MetadataExpression,
        Ast.NodeKind.RelationalExpression,
    ]);
}

export function assertIsTConstant(node: Ast.TNode): asserts node is Ast.TConstant {
    assertIsNodeKind(TypeGuards.isTConstant, node, Ast.NodeKind.Constant);
}

export function assertIsTCsv(node: Ast.TNode): asserts node is Ast.TCsv {
    assertIsNodeKind(TypeGuards.isTCsv, node, [Ast.NodeKind.Csv]);
}

export function assertIsTKeyValuePair(node: Ast.TNode): asserts node is Ast.TKeyValuePair {
    assertIsNodeKind(TypeGuards.isTKeyValuePair, node, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.IdentifierPairedExpression,
    ]);
}

export function assertIsTPairedConstant(node: Ast.TNode): asserts node is Ast.TPairedConstant {
    assertIsNodeKind(TypeGuards.isTPairedConstant, node, [
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

export function assertIsTypePrimaryType(node: Ast.TNode): asserts node is Ast.TypePrimaryType {
    assertIsNodeKind(TypeGuards.isTypePrimaryType, node, Ast.NodeKind.TypePrimaryType);
}

export function assertIsUnaryExpression(node: Ast.TNode): asserts node is Ast.UnaryExpression {
    assertIsNodeKind(TypeGuards.isUnaryExpression, node, Ast.NodeKind.UnaryExpression);
}

function assertAs<T extends Ast.TNode>(
    predicateFn: (node: Ast.TNode) => node is T,
    node: Ast.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    assertIsNodeKind<T>(predicateFn, node, expectedNodeKinds);

    return node;
}
