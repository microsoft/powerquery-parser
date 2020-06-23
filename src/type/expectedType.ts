// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from ".";
import { CommonError, isNever } from "../common";
import { Ast } from "../language";
import { TXorNode } from "../parser";

const Primitive: Type.AnyUnion = {
    kind: Type.TypeKind.Any,
    maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
    isNullable: false,
    unionedTypePairs: [
        Type.ActionInstance,
        Type.AnyInstance,
        Type.AnyNonNullInstance,
        Type.BinaryInstance,
        Type.DateInstance,
        Type.DateTimeInstance,
        Type.DateTimeZoneInstance,
        Type.DurationInstance,
        Type.FunctionInstance,
        Type.ListInstance,
        Type.LogicalInstance,
        Type.NoneInstance,
        Type.NotApplicableInstance,
        Type.NullInstance,
        Type.NumberInstance,
        Type.RecordInstance,
        Type.TableInstance,
        Type.TextInstance,
        Type.TimeInstance,
        Type.TypeInstance,
    ],
};

const NullablePrimitive: Type.AnyUnion = {
    kind: Type.TypeKind.Any,
    maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
    isNullable: true,
    unionedTypePairs: [
        ...Primitive.unionedTypePairs,
        Type.NullableActionInstance,
        Type.NullableAnyInstance,
        Type.NullableBinaryInstance,
        Type.NullableDateInstance,
        Type.NullableDateTimeInstance,
        Type.NullableDateTimeZoneInstance,
        Type.NullableDurationInstance,
        Type.NullableFunctionInstance,
        Type.NullableListInstance,
        Type.NullableLogicalInstance,
        Type.NullableNoneInstance,
        Type.NullableNotApplicableInstance,
        Type.NullableNullInstance,
        Type.NullableNumberInstance,
        Type.NullableRecordInstance,
        Type.NullableTableInstance,
        Type.NullableTextInstance,
        Type.NullableTimeInstance,
        Type.NullableTypeInstance,
    ],
};

const Expression: Type.AnyUnion = {
    kind: Type.TypeKind.Any,
    maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
    isNullable: false,
    unionedTypePairs: [NullablePrimitive],
};

const TType: Type.TType = 0 as any;
const TTypeExpression: Type.TType = 0 as any;

const AnyLiteral: Type.AnyUnion = {
    kind: Type.TypeKind.Any,
    maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
    isNullable: false,
    unionedTypePairs: [
        Type.RecordInstance,
        Type.ListInstance,
        Type.LogicalInstance,
        Type.NumberInstance,
        Type.TextInstance,
        Type.NullInstance,
    ],
};

function unknownChildIndexError(parent: TXorNode, childIndex: number): CommonError.InvariantError {
    const details: {} = {
        parentId: parent.node.kind,
        parentNodeKind: parent.node.kind,
        childIndex,
    };
    return new CommonError.InvariantError(`unknown childIndex`, details);
}

export function expectedType(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number, childIndex: number): any {
    const parentXorNode: TXorNode = ancestry[ancestryIndex];

    switch (parentXorNode.node.kind) {
        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.Csv:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.FieldProjection:
        case Ast.NodeKind.FieldSelector:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordType:
            return Type.NotApplicableInstance;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Expression;

                case 1:
                    return Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.IsExpression:
            switch (childIndex) {
                case 0:
                    return Expression;

                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return NullablePrimitive;

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
                    return TType;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.AsNullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return NullablePrimitive;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.EachExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Expression;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.ErrorHandlingExpression:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return Expression;

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
                    return AnyLiteral;

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
                    return Expression;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FieldSpecification:
            switch (childIndex) {
                case 0:
                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return TType;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FieldTypeSpecification:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return TType;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FunctionExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.NotApplicableInstance;

                case 1:
                    return NullablePrimitive;

                case 3:
                    return Expression;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.FunctionType:
            switch (childIndex) {
                case 0:
                case 1:
                    return Type.NotApplicableInstance;

                case 2:
                    return NullablePrimitive;

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
                    return Expression;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.IsNullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return Type.NotApplicableInstance;

                case 1:
                    return NullablePrimitive;

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
                    return Expression;

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
                    return Expression;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.ListType:
            switch (childIndex) {
                case 0:
                case 2:
                    return Type.NotApplicableInstance;

                case 1:
                    return TType;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case Ast.NodeKind.MetadataExpression:
            switch (childIndex) {
                case 1:
                    return Type.NotApplicableInstance;

                case 0:
                case 2:
                    return TTypeExpression;

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

        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.Parameter:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.PrimitiveType:
        case Ast.NodeKind.RangeExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.TableType:
        case Ast.NodeKind.TypePrimaryType:
        case Ast.NodeKind.UnaryExpression:
            break;

        default:
            throw isNever(parentXorNode.node);
    }
}

// function expectedTypeFromChildAttributeIndex(
//     nodeIdMapCollection: NodeIdMap.Collection,
//     oldChildXorNode: TXorNode,
//     oldChildAttributeNumber: number,
//     newChildAttributeNumber: number,
// ): Type.TType {
//     const maybeNewChildXorNode: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
//         nodeIdMapCollection,
//         oldChildXorNode.node.id,
//         oldChildAttributeNumber,
//         undefined,
//     );
//     return maybeNewChildXorNode !== undefined
//         ? expectedType(nodeIdMapCollection, maybeNewChildXorNode, newChildAttributeNumber)
//         : Type.UnknownInstance;
// }
