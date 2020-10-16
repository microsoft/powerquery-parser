// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from ".";
import { Assert, CommonError, Result, ResultUtils } from "../../common";
import { ActiveNode, ActiveNodeLeafKind } from "../../inspection/activeNode";
import { Ast } from "../../language";
import { LocalizationUtils } from "../../localization";
import { TXorNode, XorNodeKind } from "../../parser";
import { CommonSettings } from "../../settings";

export type TriedExpectedType = Result<Type.TType | undefined, CommonError.CommonError>;

export function tryExpectedType(settings: CommonSettings, activeNode: ActiveNode): TriedExpectedType {
    return ResultUtils.ensureResult(LocalizationUtils.getLocalizationTemplates(settings.locale), () =>
        maybeExpectedType(activeNode),
    );
}

// Traverse up the ancestry and find what type is expected as the nth child of a node's kind.
// The last type generated this way should have the widest typing,
// which then can be used for type hinting.
export function maybeExpectedType(activeNode: ActiveNode): Type.TType | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const upperBound: number = ancestry.length - 1;
    let bestMatch: Type.TType | undefined;

    for (let index: number = 0; index < upperBound; index += 1) {
        const parent: TXorNode = ancestry[index + 1];
        const child: TXorNode = ancestry[index];

        Assert.isDefined(child.node.maybeAttributeIndex, `Expected child to have an attribute index.`, {
            childId: child.node.id,
        });
        const attributeIndex: number =
            parent.kind === XorNodeKind.Ast && activeNode.leafKind === ActiveNodeLeafKind.AfterAstNode
                ? child.node.maybeAttributeIndex + 1
                : child.node.maybeAttributeIndex;

        const allowedType: Type.TType = expectedType(parent, attributeIndex);
        if (allowedType.kind !== Type.TypeKind.NotApplicable) {
            bestMatch = allowedType;
        }
    }

    return bestMatch;
}

// For a given parent node, what is the expected type for a child at a given index?
export function expectedType(parentXorNode: TXorNode, childIndex: number): Type.TType {
    switch (parentXorNode.node.kind) {
        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.Csv:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.FieldProjection:
        case Ast.NodeKind.FieldSelector:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordType:
        case Ast.NodeKind.Parameter:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.PrimitiveType:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecursivePrimaryExpression:
            return Type.NotApplicableInstance;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.TypeExpressionInstance;

                case 1:
                    return Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.IsExpression:
            switch (childIndex) {
                case 0:
                    return Type.TypeExpressionInstance;

                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.Section:
        case Ast.NodeKind.SectionMember:
            switch (childIndex) {
                case 0:
                    return Type.RecordInstance;

                default:
                    return Type.NotApplicableInstance;
            }

        case Ast.NodeKind.AsType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.AsNullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.EachExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.ErrorHandlingExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.ExpressionInstance;

                case 2:
                    return Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        // TODO: how should error raising be typed?
        case Ast.NodeKind.ErrorRaisingExpression:
            return Type.NotApplicableInstance;

        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
            switch (childIndex) {
                case 0:
                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return Type.AnyLiteralInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            switch (childIndex) {
                case 0:
                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FieldSpecification:
            switch (childIndex) {
                case 0:
                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FieldTypeSpecification:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FunctionExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.NullablePrimitiveInstance;

                case 3:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FunctionType:
            switch (childIndex) {
                case 0:
                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.IfExpression:
            switch (childIndex) {
                case 0:
                case 2:
                case 4:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.LogicalInstance;

                case 3:
                case 5:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.IsNullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.ItemAccessExpression:
            switch (childIndex) {
                case 0:
                case 2:
                case 3:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.LetExpression:
            switch (childIndex) {
                case 0:
                case 1:
                case 2:
                    return Type.NotApplicableInstance;

                case 3:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.ListType:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.MetadataExpression:
            switch (childIndex) {
                case 1:
                    return Type.NotApplicableInstance;

                case 0:
                case 2:
                    return Type.TypeExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.NotImplementedExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.NullCoalescingExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.ExpressionInstance;

                case 1:
                    return Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.NullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.PrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.NullableType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.OtherwiseExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.ParenthesizedExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.RangeExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.ExpressionInstance;

                case 1:
                    return Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.TableType:
            switch (childIndex) {
                case 1:
                case 2:
                    return Type.PrimaryExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.TypePrimaryType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.PrimaryTypeInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.UnaryExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Type.TypeExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        default:
            throw Assert.isNever(parentXorNode.node);
    }
}

function unknownChildIndexError(parent: TXorNode, childIndex: number): CommonError.InvariantError {
    const details: {} = {
        parentId: parent.node.kind,
        parentNodeKind: parent.node.kind,
        childIndex,
    };
    return new CommonError.InvariantError(`unknown childIndex`, details);
}
