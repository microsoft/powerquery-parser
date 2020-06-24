// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils, ResultUtils, TypeScriptUtils } from "../../common";
import { Ast, AstUtils } from "../../language";
import { AncestryUtils, NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";
import { Type, TypeInspector, TypeUtils } from "../../type";
import { ScopeItemByKey, ScopeItemKind, TriedScopeForRoot, tryScopeItems, TScopeItem } from "../scope";
import * as BinOpExpression from "./binOpExpression";
import { TypeInspectionState } from "./type";

export function getOrCreateType(state: TypeInspectionState, scopeItem: TScopeItem): Type.TType {
    const nodeId: number = scopeItem.id;

    const maybeGivenType: Type.TType | undefined = state.givenTypeById.get(nodeId);
    if (maybeGivenType !== undefined) {
        return maybeGivenType;
    }

    const maybeDeltaType: Type.TType | undefined = state.givenTypeById.get(nodeId);
    if (maybeDeltaType !== undefined) {
        return maybeDeltaType;
    }

    const scopeType: Type.TType = inspectScopeItem(state, scopeItem);
    return scopeType;
}

export function getOrCreateScope(state: TypeInspectionState, nodeId: number): ScopeItemByKey {
    const maybeScope: ScopeItemByKey | undefined = state.scopeById.get(nodeId);
    if (maybeScope !== undefined) {
        return maybeScope;
    }

    const ancestry: ReadonlyArray<TXorNode> = AncestryUtils.expectAncestry(state.nodeIdMapCollection, nodeId);
    const triedScope: TriedScopeForRoot = tryScopeItems(
        state.settings,
        state.nodeIdMapCollection,
        state.leafNodeIds,
        ancestry[0].node.id,
        state.scopeById,
    );
    if (ResultUtils.isErr(triedScope)) {
        throw triedScope.error;
    }

    return triedScope.value;
}

export function inspectScopeItem(state: TypeInspectionState, scopeItem: TScopeItem): Type.TType {
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
            return inspectXorNode(state, scopeItem.eachExpression);

        case ScopeItemKind.KeyValuePair:
            return scopeItem.maybeValue === undefined
                ? Type.UnknownInstance
                : inspectXorNode(state, scopeItem.maybeValue);

        case ScopeItemKind.Parameter:
            return TypeUtils.parameterFactory(scopeItem);

        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined
                ? Type.UnknownInstance
                : inspectXorNode(state, scopeItem.maybeValue);

        case ScopeItemKind.Undefined:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(scopeItem);
    }
}

export function inspectXorNode(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const xorNodeId: number = xorNode.node.id;
    const maybeCached: Type.TType | undefined =
        state.givenTypeById.get(xorNodeId) || state.deltaTypeById.get(xorNodeId);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: Type.TType;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.Section:
            return TypeUtils.notApplicableFactory();

        case Ast.NodeKind.AsType:
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.TypePrimaryType:
            result = inspectFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = inspectBinOpExpression(state, xorNode);
            break;

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.SectionMember:
            result = inspectFromChildAttributeIndex(state, xorNode, 2);
            break;

        case Ast.NodeKind.Csv:
        case Ast.NodeKind.MetadataExpression:
            result = inspectFromChildAttributeIndex(state, xorNode, 0);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
            result = inspectList(state, xorNode);
            break;

        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.NullablePrimitiveType:
            result = {
                ...inspectFromChildAttributeIndex(state, xorNode, 1),
                isNullable: true,
            };
            break;

        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordExpression:
            result = inspectRecord(state, xorNode);
            break;

        // TODO: how should error raising be typed?
        case Ast.NodeKind.ErrorRaisingExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.Constant:
            result = inspectConstant(xorNode);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            result = inspectErrorHandlingExpression(state, xorNode);
            break;

        case Ast.NodeKind.FieldProjection:
            result = inspectFieldProjection(state, xorNode);
            break;

        case Ast.NodeKind.FieldSelector:
            result = inspectFieldSelector(state, xorNode);
            break;

        case Ast.NodeKind.FieldSpecification:
            result = inspectFieldSpecification(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            result = inspectFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionType:
            result = inspectFunctionType(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            result = inspectIdentifier(state, xorNode);
            break;

        case Ast.NodeKind.IdentifierExpression:
            result = inspectIdentifierExpression(state, xorNode);
            break;

        case Ast.NodeKind.IfExpression:
            result = inspectIfExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsExpression:
            result = TypeUtils.primitiveTypeFactory(Type.TypeKind.Logical, false);
            break;

        case Ast.NodeKind.InvokeExpression:
            result = inspectInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsNullablePrimitiveType:
            result = TypeUtils.primitiveTypeFactory(Type.TypeKind.Logical, false);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.LetExpression:
            result = inspectFromChildAttributeIndex(state, xorNode, 3);
            break;

        case Ast.NodeKind.ListType:
            result = inspectListType(state, xorNode);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = inspectLiteralExpression(xorNode);
            break;

        case Ast.NodeKind.NotImplementedExpression:
            result = Type.NoneInstance;
            break;

        case Ast.NodeKind.Parameter:
            result = inspectParameter(state, xorNode);
            break;

        case Ast.NodeKind.PrimitiveType:
            result = inspectPrimitiveType(xorNode);
            break;

        case Ast.NodeKind.RangeExpression:
            result = inspectRangeExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordType:
            result = inspectRecordType(state, xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = inspectRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.TableType:
            result = inspectTableType(state, xorNode);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = inspectUnaryExpression(state, xorNode);
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    state.deltaTypeById.set(xorNodeId, result);
    return result;
}

type TRecordOrTable = Type.Record | Type.Table | Type.DefinedRecord | Type.DefinedTable;

interface ExaminedFieldSpecificationList {
    readonly fields: Map<string, Type.TType>;
    readonly isOpen: boolean;
}

function inspectFromChildAttributeIndex(
    state: TypeInspectionState,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Type.TType {
    const maybeXorNode: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
        undefined,
    );
    return maybeXorNode !== undefined ? inspectXorNode(state, maybeXorNode) : Type.UnknownInstance;
}

function inspectBinOpExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    if (!AstUtils.isTBinOpExpressionKind(xorNode.node.kind)) {
        const details: {} = {
            nodeId: xorNode.node.id,
            nodeKind: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`xorNode isn't a TBinOpExpression`, details);
    }

    const parentId: number = xorNode.node.id;
    const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorChildren(state.nodeIdMapCollection, parentId);

    const maybeLeft: TXorNode | undefined = children[0];
    const maybeOperatorKind: Ast.TBinOpExpressionOperator | undefined =
        children[1] === undefined || children[1].kind === XorNodeKind.Context
            ? undefined
            : (children[1].node as Ast.IConstant<Ast.TBinOpExpressionOperator>).constantKind;
    const maybeRight: TXorNode | undefined = children[2];

    // ''
    if (maybeLeft === undefined) {
        return Type.UnknownInstance;
    }
    // '1'
    else if (maybeOperatorKind === undefined) {
        return inspectXorNode(state, maybeLeft);
    }
    // '1 +'
    else if (maybeRight === undefined || maybeRight.kind === XorNodeKind.Context) {
        const leftType: Type.TType = inspectXorNode(state, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;

        const partialLookupKey: string = BinOpExpression.partialLookupKey(leftType.kind, operatorKind);
        const maybeAllowedTypeKinds: ReadonlySet<Type.TypeKind> | undefined = BinOpExpression.PartialLookup.get(
            partialLookupKey,
        );
        if (maybeAllowedTypeKinds === undefined) {
            return Type.NoneInstance;
        } else if (maybeAllowedTypeKinds.size === 1) {
            return TypeUtils.primitiveTypeFactory(maybeAllowedTypeKinds.values().next().value, leftType.isNullable);
        } else {
            const unionedTypePairs: Type.TType[] = [];
            for (const kind of maybeAllowedTypeKinds.values()) {
                unionedTypePairs.push({
                    kind,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                });
            }
            return TypeUtils.anyUnionFactory(unionedTypePairs);
        }
    }
    // '1 + 1'
    else {
        const leftType: Type.TType = inspectXorNode(state, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;
        const rightType: Type.TType = inspectXorNode(state, maybeRight);

        const key: string = BinOpExpression.lookupKey(leftType.kind, operatorKind, rightType.kind);
        const maybeResultTypeKind: Type.TypeKind | undefined = BinOpExpression.Lookup.get(key);
        if (maybeResultTypeKind === undefined) {
            return Type.NoneInstance;
        }
        const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

        // '[foo = 1] & [bar = 2]'
        if (
            operatorKind === Ast.ArithmeticOperatorKind.And &&
            (resultTypeKind === Type.TypeKind.Record || resultTypeKind === Type.TypeKind.Table)
        ) {
            return inspectRecordOrTableUnion(leftType as TRecordOrTable, rightType as TRecordOrTable);
        } else {
            return TypeUtils.primitiveTypeFactory(resultTypeKind, leftType.isNullable || rightType.isNullable);
        }
    }
}

function inspectConstant(xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.Constant,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const constant: Ast.TConstant = xorNode.node as Ast.TConstant;
    switch (constant.constantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Action, false);

        case Ast.PrimitiveTypeConstantKind.Any:
            return Type.AnyInstance;

        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.AnyNonNull, false);

        case Ast.PrimitiveTypeConstantKind.Binary:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Binary, false);

        case Ast.PrimitiveTypeConstantKind.Date:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Date, false);

        case Ast.PrimitiveTypeConstantKind.DateTime:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.DateTime, false);

        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.DateTimeZone, false);

        case Ast.PrimitiveTypeConstantKind.Duration:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Duration, false);

        case Ast.PrimitiveTypeConstantKind.Function:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Function, false);

        case Ast.PrimitiveTypeConstantKind.List:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.List, false);

        case Ast.PrimitiveTypeConstantKind.Logical:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Logical, false);

        case Ast.PrimitiveTypeConstantKind.None:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.None, false);

        case Ast.PrimitiveTypeConstantKind.Null:
            return Type.NoneInstance;

        case Ast.PrimitiveTypeConstantKind.Number:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Number, false);

        case Ast.PrimitiveTypeConstantKind.Record:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false);

        case Ast.PrimitiveTypeConstantKind.Table:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Table, false);

        case Ast.PrimitiveTypeConstantKind.Text:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Text, false);

        case Ast.PrimitiveTypeConstantKind.Time:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Time, false);

        case Ast.PrimitiveTypeConstantKind.Type:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Type, false);

        default:
            return Type.UnknownInstance;
    }
}

function inspectErrorHandlingExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.ErrorHandlingExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeOtherwiseExpression:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 2, [
        Ast.NodeKind.OtherwiseExpression,
    ]);

    return TypeUtils.anyUnionFactory([
        inspectFromChildAttributeIndex(state, xorNode, 1),
        maybeOtherwiseExpression !== undefined
            ? inspectXorNode(state, maybeOtherwiseExpression)
            : TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
    ]);
}

function inspectFieldProjection(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FieldProjection,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const projectedFieldNames: ReadonlyArray<string> = NodeIdMapIterator.fieldProjectionFieldNames(
        state.nodeIdMapCollection,
        xorNode,
    );
    const previousSibling: TXorNode = NodeIdMapUtils.expectRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXorNode(state, previousSibling);
    const isOptional: boolean =
        NodeIdMapUtils.maybeAstChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

    return inspectFieldProjectionHelper(previousSiblingType, projectedFieldNames, isOptional);
}

function inspectFieldProjectionHelper(
    previousSiblingType: Type.TType,
    projectedFieldNames: ReadonlyArray<string>,
    isOptional: boolean,
): Type.TType {
    switch (previousSiblingType.kind) {
        case Type.TypeKind.Any: {
            const newFields: Map<string, Type.Any> = new Map(
                projectedFieldNames.map((fieldName: string) => [fieldName, Type.AnyInstance]),
            );
            return {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: previousSiblingType.isNullable,
                unionedTypePairs: [
                    {
                        kind: Type.TypeKind.Record,
                        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                        isNullable: previousSiblingType.isNullable,
                        fields: newFields,
                        isOpen: false,
                    },
                    {
                        kind: Type.TypeKind.Table,
                        maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                        isNullable: previousSiblingType.isNullable,
                        fields: newFields,
                        isOpen: false,
                    },
                ],
            };
        }

        case Type.TypeKind.Record:
        case Type.TypeKind.Table: {
            // All we know is previousSibling was a Record/Table.
            // Create a DefinedRecord/DefinedTable with the projected fields.
            if (previousSiblingType.maybeExtendedKind === undefined) {
                const newFields: Map<string, Type.Any> = new Map(
                    projectedFieldNames.map((fieldName: string) => [fieldName, Type.AnyInstance]),
                );
                return previousSiblingType.kind === Type.TypeKind.Record
                    ? TypeUtils.definedRecordFactory(false, newFields, false)
                    : TypeUtils.definedTableFactory(false, newFields, false);
            }
            if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.PrimaryExpressionTable) {
                // Dereference PrimaryExpressionTable.type and call the helper again.
                return inspectFieldProjectionHelper(previousSiblingType.type, projectedFieldNames, isOptional);
            } else {
                return reducedFieldsToKeys(previousSiblingType, projectedFieldNames, isOptional);
            }
        }

        default:
            return Type.NoneInstance;
    }
}

function inspectFieldSelector(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FieldSelector,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeFieldName: Ast.TNode | undefined = NodeIdMapUtils.maybeWrappedContentAst(
        state.nodeIdMapCollection,
        xorNode,
        Ast.NodeKind.GeneralizedIdentifier,
    );
    if (maybeFieldName === undefined) {
        return Type.UnknownInstance;
    }
    const fieldName: string = (maybeFieldName as Ast.GeneralizedIdentifier).literal;

    const previousSibling: TXorNode = NodeIdMapUtils.expectRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXorNode(state, previousSibling);
    const isOptional: boolean =
        NodeIdMapUtils.maybeAstChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

    return helperForinspectFieldSelector(state, previousSiblingType, fieldName, isOptional);
}

function helperForinspectFieldSelector(
    state: TypeInspectionState,
    previousSiblingType: Type.TType,
    fieldName: string,
    isOptional: boolean,
): Type.TType {
    switch (previousSiblingType.kind) {
        case Type.TypeKind.Any:
            return Type.AnyInstance;

        case Type.TypeKind.Unknown:
            return Type.UnknownInstance;

        case Type.TypeKind.Record:
        case Type.TypeKind.Table:
            switch (previousSiblingType.maybeExtendedKind) {
                case undefined:
                    return Type.AnyInstance;

                case Type.ExtendedTypeKind.DefinedRecord:
                case Type.ExtendedTypeKind.DefinedTable: {
                    const maybeNamedField: Type.TType | undefined = previousSiblingType.fields.get(fieldName);
                    if (maybeNamedField !== undefined) {
                        return maybeNamedField;
                    } else if (previousSiblingType.isOpen) {
                        return Type.AnyInstance;
                    } else {
                        return isOptional ? Type.NullInstance : Type.NoneInstance;
                    }
                }

                case Type.ExtendedTypeKind.PrimaryExpressionTable:
                    return helperForinspectFieldSelector(state, previousSiblingType.type, fieldName, isOptional);

                default:
                    throw Assert.isNever(previousSiblingType);
            }

        default:
            return Type.NoneInstance;
    }
}

function inspectFieldSpecification(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FieldSpecification,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeFieldTypeSpecification: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
        undefined,
    );

    return maybeFieldTypeSpecification !== undefined
        ? inspectXorNode(state, maybeFieldTypeSpecification)
        : Type.AnyInstance;
}

function inspectFunctionExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const inspectedFunctionExpression: TypeInspector.InspectedFunctionExpression = TypeInspector.inspectFunctionExpression(
        state.nodeIdMapCollection,
        xorNode,
    );
    const inspectedReturnType: Type.TType = inspectedFunctionExpression.returnType;
    const expressionType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 3);

    // FunctionExpression.maybeFunctionReturnType doesn't always match FunctionExpression.expression.
    // By examining the expression we might get a more accurate return type (eg. Function vs DefinedFunction),
    // or discover an error (eg. maybeFunctionReturnType is Number but expression is Text).

    let returnType: Type.TType;
    // If the stated return type is Any,
    // then it might as well be the expression's type as it can't be any wider than Any.
    if (inspectedReturnType.kind === Type.TypeKind.Any) {
        returnType = expressionType;
    }
    // If the return type is Any then see if we can narrow it to the stated return type.
    else if (
        expressionType.kind === Type.TypeKind.Any &&
        expressionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
        allForAnyUnion(
            expressionType,
            (type: Type.TType) => type.kind === inspectedReturnType.kind || type.kind === Type.TypeKind.Any,
        )
    ) {
        returnType = expressionType;
    }
    // If the stated return type doesn't match the expression's type then it's None.
    else if (inspectedReturnType.kind !== expressionType.kind) {
        return Type.NoneInstance;
    }
    // If the expression's type can't be known, then assume it's the stated return type.
    else if (expressionType.kind === Type.TypeKind.Unknown) {
        returnType = inspectedReturnType;
    }
    // Else fallback to the expression's type.
    else {
        returnType = expressionType;
    }

    return {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable: false,
        // TODO: Maybe rework this to not use TypeInspector. This would save a map call at the cost of complexity.
        parameters: inspectedFunctionExpression.parameters.map(
            (parameter: TypeInspector.InspectedFunctionParameter) => {
                return {
                    isNullable: parameter.isNullable,
                    isOptional: parameter.isOptional,
                    maybeType: parameter.maybeType,
                };
            },
        ),
        returnType,
    };
}

function inspectFunctionType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.DefinedFunction> | Type.Unknown {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FunctionType,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeParameters:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
        Ast.NodeKind.ParameterList,
    ]);
    if (maybeParameters === undefined) {
        return Type.UnknownInstance;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeWrappedContent(
        state.nodeIdMapCollection,
        maybeParameters,
        Ast.NodeKind.ArrayWrapper,
    );
    if (maybeArrayWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const parameterTypes: ReadonlyArray<Type.FunctionParameter> = NodeIdMapIterator.arrayWrapperCsvXorNodes(
        state.nodeIdMapCollection,
        maybeArrayWrapper,
    )
        .map((parameter: TXorNode) => TypeUtils.inspectParameter(state.nodeIdMapCollection, parameter))
        .filter(TypeScriptUtils.isDefined);

    const returnType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 2);

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: false,
        primaryType: {
            kind: Type.TypeKind.Function,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
            isNullable: false,
            parameters: parameterTypes,
            returnType,
        },
    };
}

function inspectIdentifier(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.Identifier,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType !== undefined ? dereferencedType : Type.UnknownInstance;
}

function inspectIdentifierExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.IdentifierExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType !== undefined ? dereferencedType : Type.UnknownInstance;
}

function inspectIfExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.IfExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const conditionType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 1);
    if (conditionType.kind === Type.TypeKind.Unknown) {
        return Type.UnknownInstance;
    }
    // Any is allowed so long as AnyUnion only contains Any or Logical.
    else if (conditionType.kind === Type.TypeKind.Any) {
        if (
            conditionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
            !allForAnyUnion(
                conditionType,
                (type: Type.TType) => type.kind === Type.TypeKind.Logical || type.kind === Type.TypeKind.Any,
            )
        ) {
            return Type.NoneInstance;
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        return Type.NoneInstance;
    }

    const trueExprType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 5);

    return TypeUtils.anyUnionFactory([trueExprType, falseExprType]);
}

function inspectInvokeExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.InvokeExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const previousSibling: TXorNode = NodeIdMapUtils.expectRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXorNode(state, previousSibling);
    if (previousSiblingType.kind === Type.TypeKind.Any) {
        return Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        return Type.NoneInstance;
    } else if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        return previousSiblingType.returnType;
    } else {
        return Type.AnyInstance;
    }
}

function inspectListType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.ListType> | Type.Unknown {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.ListType,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeListItem: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeListItem === undefined) {
        return Type.UnknownInstance;
    }
    const itemType: Type.TType = inspectXorNode(state, maybeListItem);

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: false,
        primaryType: {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.ListType,
            isNullable: false,
            itemType,
        },
    };
}

function inspectLiteralExpression(xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.LiteralExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalKind: Ast.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
            const typeKind: Type.TypeKind = TypeUtils.typeKindFromLiteralKind(literalKind);
            return TypeUtils.primitiveTypeFactory(typeKind, literalKind === Ast.LiteralKind.Null);

        case XorNodeKind.Context:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}

function inspectParameter(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.Parameter,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeOptionalConstant:
        | Ast.TNode
        | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.Constant,
    ]);

    const maybeParameterType: Type.TType | undefined = inspectFromChildAttributeIndex(state, xorNode, 2);

    return {
        ...maybeParameterType,
        isNullable: maybeOptionalConstant !== undefined || maybeParameterType.isNullable,
    };
}

function inspectPrimitiveType(xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.PrimitiveType,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const kind: Type.TypeKind = TypeUtils.typeKindFromPrimitiveTypeConstantKind(
        (xorNode.node as Ast.PrimitiveType).primitiveType.constantKind,
    );
    return {
        kind,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

function inspectRangeExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.RangeExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeLeftType: Type.TType | undefined = inspectFromChildAttributeIndex(state, xorNode, 0);
    const maybeRightType: Type.TType | undefined = inspectFromChildAttributeIndex(state, xorNode, 2);

    if (maybeLeftType === undefined || maybeRightType === undefined) {
        return Type.UnknownInstance;
    } else if (maybeLeftType.kind === Type.TypeKind.Number && maybeRightType.kind === Type.TypeKind.Number) {
        // TODO: handle isNullable better
        if (maybeLeftType.isNullable === true || maybeRightType.isNullable === true) {
            return Type.NoneInstance;
        } else {
            return TypeUtils.primitiveTypeFactory(maybeLeftType.kind, maybeLeftType.isNullable);
        }
    } else if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return Type.NoneInstance;
    } else if (maybeLeftType.kind === Type.TypeKind.Unknown || maybeRightType.kind === Type.TypeKind.Unknown) {
        return Type.UnknownInstance;
    } else {
        return Type.NoneInstance;
    }
}

function inspectRecordType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.DefinedRecord> | Type.Unknown {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.RecordType,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeFields: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        [Ast.NodeKind.FieldSpecificationList],
    );
    if (maybeFields === undefined) {
        return Type.UnknownInstance;
    }

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: false,
        primaryType: {
            kind: Type.TypeKind.Record,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
            isNullable: false,
            ...examineFieldSpecificationList(state, maybeFields),
        },
    };
}

function inspectRecursivePrimaryExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.RecursivePrimaryExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeHead: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        undefined,
    );
    if (maybeHead === undefined) {
        return Type.UnknownInstance;
    }

    const headType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 0);
    if (headType.kind === Type.TypeKind.None || headType.kind === Type.TypeKind.Unknown) {
        return headType;
    }

    const maybeArrayWrapper:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeArrayWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const maybeExpressions: ReadonlyArray<TXorNode> | undefined = NodeIdMapIterator.expectXorChildren(
        state.nodeIdMapCollection,
        maybeArrayWrapper.node.id,
    );
    if (maybeExpressions === undefined) {
        return Type.UnknownInstance;
    }

    let leftType: Type.TType = headType;
    for (const right of maybeExpressions) {
        const rightType: Type.TType = inspectXorNode(state, right);
        leftType = rightType;
    }

    return leftType;
}

function inspectTableType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.DefinedTable | Type.PrimaryExpressionTable> | Type.Unknown {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.TableType,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeRowType: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeRowType === undefined) {
        return Type.UnknownInstance;
    }

    if (maybeRowType.node.kind === Ast.NodeKind.FieldSpecificationList) {
        return {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
            isNullable: false,
            primaryType: {
                kind: Type.TypeKind.Table,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                isNullable: false,
                ...examineFieldSpecificationList(state, maybeRowType),
            },
        };
    } else {
        return {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
            isNullable: false,
            primaryType: {
                kind: Type.TypeKind.Table,
                maybeExtendedKind: Type.ExtendedTypeKind.PrimaryExpressionTable,
                isNullable: false,
                type: inspectXorNode(state, maybeRowType),
            },
        };
    }
}

function inspectUnaryExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.UnaryExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeOperatorsWrapper:
        | undefined
        | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeOperatorsWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeExpression === undefined) {
        return Type.UnknownInstance;
    }

    // Only certain operators are allowed depending on the type.
    // Unlike BinOpExpression, it's easier to implement the check without a lookup table.
    let expectedUnaryOperatorKinds: ReadonlyArray<Ast.UnaryOperatorKind>;
    const expressionType: Type.TType = inspectXorNode(state, maybeExpression);
    if (expressionType.kind === Type.TypeKind.Number) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Positive, Ast.UnaryOperatorKind.Negative];
    } else if (expressionType.kind === Type.TypeKind.Logical) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Not];
    } else {
        return Type.NoneInstance;
    }

    const operators: ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>> = NodeIdMapIterator.maybeAstChildren(
        nodeIdMapCollection,
        maybeOperatorsWrapper.node.id,
    ) as ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>>;
    for (const operator of operators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return Type.NoneInstance;
        }
    }

    return expressionType;
}

function inspectList(state: TypeInspectionState, xorNode: TXorNode): Type.DefinedList {
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.listItems(state.nodeIdMapCollection, xorNode);
    const elements: ReadonlyArray<Type.TType> = items.map((item: TXorNode) => inspectXorNode(state, item));

    return {
        kind: Type.TypeKind.List,
        isNullable: false,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        elements,
    };
}

function inspectRecord(state: TypeInspectionState, xorNode: TXorNode): Type.DefinedRecord {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstAnyNodeKind(xorNode, [
        Ast.NodeKind.RecordExpression,
        Ast.NodeKind.RecordLiteral,
    ]);
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const fields: Map<string, Type.TType> = new Map();
    for (const keyValuePair of NodeIdMapIterator.recordKeyValuePairs(state.nodeIdMapCollection, xorNode)) {
        if (keyValuePair.maybeValue) {
            fields.set(keyValuePair.keyLiteral, inspectXorNode(state, keyValuePair.maybeValue));
        } else {
            fields.set(keyValuePair.keyLiteral, Type.UnknownInstance);
        }
    }

    return {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable: false,
        fields,
        isOpen: false,
    };
}

function inspectRecordOrTableUnion(leftType: TRecordOrTable, rightType: TRecordOrTable): Type.TType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []' or '#table() & #table()'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return TypeUtils.primitiveTypeFactory(leftType.kind, leftType.isNullable || rightType.isNullable);
    }
    // '[key=value] & []' or '#table(...) & #table()`
    // '[] & [key=value]' or `#table() & #table(...)`
    else if (
        (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind === undefined) ||
        (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind !== undefined)
    ) {
        // The 'rightType as (...)' isn't needed, except TypeScript's checker isn't smart enough to know it.
        const extendedType: Type.DefinedRecord | Type.DefinedTable =
            leftType.maybeExtendedKind !== undefined ? leftType : (rightType as Type.DefinedRecord | Type.DefinedTable);
        return {
            ...extendedType,
            isOpen: true,
        };
    }
    // '[foo=value] & [bar=value] or #table(...) & #table(...)'
    else if (
        leftType.maybeExtendedKind !== undefined &&
        rightType.maybeExtendedKind !== undefined &&
        leftType.maybeExtendedKind === rightType.maybeExtendedKind
    ) {
        // The cast should be safe since the first if statement tests their the same kind,
        // and the above checks if they're the same extended kind.
        return unionFields([leftType, rightType] as
            | [Type.DefinedRecord, Type.DefinedRecord]
            | [Type.DefinedTable, Type.DefinedTable]);
    } else {
        throw Assert.shouldNeverBeReachedTypescript();
    }
}

// Returns a subset of `current` using `keys`.
// If a mismatch is found it either returns Null if isOptional, else None.
function reducedFieldsToKeys(
    current: Type.DefinedRecord | Type.DefinedTable,
    keys: ReadonlyArray<string>,
    isOptional: boolean,
): Type.DefinedRecord | Type.DefinedTable | Type.None | Type.Null {
    const currentFields: Map<string, Type.TType> = current.fields;
    const currentFieldNames: ReadonlyArray<string> = [...current.fields.keys()];

    if (current.isOpen === false && ArrayUtils.isSubset(currentFieldNames, keys) === false) {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }

    return {
        ...current,
        fields: MapUtils.pick(currentFields, keys),
        isOpen: false,
    };
}

function unionFields([leftType, rightType]:
    | [Type.DefinedRecord, Type.DefinedRecord]
    | [Type.DefinedTable, Type.DefinedTable]): Type.DefinedRecord | Type.DefinedTable {
    const combinedFields: Map<string, Type.TType> = new Map(leftType.fields);
    for (const [key, value] of rightType.fields.entries()) {
        combinedFields.set(key, value);
    }

    return {
        ...leftType,
        fields: combinedFields,
        isNullable: leftType.isNullable && rightType.isNullable,
        isOpen: leftType.isOpen || rightType.isOpen,
    };
}

// Recursively flattens all AnyUnion.unionedTypePairs into a single array,
// maps each entry into a boolean,
// then calls all(...) on the mapped values.
function allForAnyUnion(anyUnion: Type.AnyUnion, conditionFn: (type: Type.TType) => boolean): boolean {
    return (
        anyUnion.unionedTypePairs
            .map((type: Type.TType) => {
                return type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion
                    ? allForAnyUnion(type, conditionFn)
                    : conditionFn(type);
            })
            .indexOf(false) === -1
    );
}

function examineFieldSpecificationList(state: TypeInspectionState, xorNode: TXorNode): ExaminedFieldSpecificationList {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FieldSpecificationList,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const fields: [string, Type.TType][] = [];

    for (const fieldSpecification of NodeIdMapIterator.fieldSpecificationListCsvXorNodes(
        nodeIdMapCollection,
        xorNode,
    )) {
        const maybeName: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            fieldSpecification.node.id,
            1,
            [Ast.NodeKind.GeneralizedIdentifier],
        );

        if (maybeName === undefined) {
            break;
        }
        const name: string = (maybeName as Ast.GeneralizedIdentifier).literal;
        const type: Type.TType = inspectFieldSpecification(state, fieldSpecification);
        fields.push([name, type]);
    }

    const isOpen: boolean =
        NodeIdMapUtils.maybeAstChildByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

    return {
        fields: new Map(fields),
        isOpen,
    };
}

function maybeDereferencedIdentifierType(state: TypeInspectionState, xorNode: TXorNode): undefined | Type.TType {
    const maybeDeferenced: TXorNode | undefined = maybeDereferencedIdentifier(state, xorNode);
    if (maybeDeferenced === undefined) {
        return undefined;
    } else if (maybeDeferenced.kind !== XorNodeKind.Ast) {
        throw new CommonError.InvariantError(`${maybeDereferencedIdentifier.name} should only return Ast identifiers`);
    }

    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstAnyNodeKind(maybeDeferenced, [
        Ast.NodeKind.Identifier,
        Ast.NodeKind.IdentifierExpression,
    ]);
    if (maybeErr) {
        throw maybeErr;
    }
    const deferenced: Ast.Identifier | Ast.IdentifierExpression = maybeDeferenced.node as
        | Ast.Identifier
        | Ast.IdentifierExpression;

    let identifierLiteral: string;
    let isIdentifierRecurisve: boolean;

    switch (deferenced.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = deferenced.literal;
            isIdentifierRecurisve = false;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = deferenced.identifier.literal;
            isIdentifierRecurisve = deferenced.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(deferenced);
    }

    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, deferenced.id);
    const maybeScopeItem: undefined | TScopeItem = scopeItemByKey.get(identifierLiteral);
    if (maybeScopeItem === undefined || (maybeScopeItem.isRecursive === true && isIdentifierRecurisve === false)) {
        return undefined;
    }
    const scopeItem: TScopeItem = maybeScopeItem;
    // TODO: handle recursive identifiers
    if (scopeItem.isRecursive === true) {
        return Type.AnyInstance;
    }

    let maybeNextXorNode: undefined | TXorNode;
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
            maybeNextXorNode = scopeItem.eachExpression;
            break;

        case ScopeItemKind.KeyValuePair:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.Parameter:
            return TypeUtils.parameterFactory(scopeItem);

        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.Undefined:
            return undefined;

        default:
            throw Assert.isNever(scopeItem);
    }

    if (maybeNextXorNode === undefined) {
        return undefined;
    }
    return inspectXorNode(state, maybeNextXorNode);
}

function maybeDereferencedIdentifier(state: TypeInspectionState, xorNode: TXorNode): TXorNode | undefined {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstAnyNodeKind(xorNode, [
        Ast.NodeKind.Identifier,
        Ast.NodeKind.IdentifierExpression,
    ]);
    if (maybeErr) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return undefined;
    }
    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node as
        | Ast.Identifier
        | Ast.IdentifierExpression;

    let identifierLiteral: string;
    let isIdentifierRecurisve: boolean;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isIdentifierRecurisve = false;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isIdentifierRecurisve = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, identifier.id);
    const maybeScopeItem: undefined | TScopeItem = scopeItemByKey.get(identifierLiteral);

    if (
        // If the identifier couldn't be found in the generated scope,
        // then either the scope generation is incorrect or it's an external identifier (eg. Odbc.Database).
        maybeScopeItem === undefined ||
        maybeScopeItem.isRecursive !== isIdentifierRecurisve
    ) {
        return undefined;
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: undefined | TXorNode;
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            break;

        case ScopeItemKind.KeyValuePair:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    if (maybeNextXorNode === undefined) {
        return xorNode;
    }

    if (
        maybeNextXorNode.kind !== XorNodeKind.Ast ||
        (maybeNextXorNode.node.kind !== Ast.NodeKind.Identifier &&
            maybeNextXorNode.node.kind !== Ast.NodeKind.IdentifierExpression)
    ) {
        return xorNode;
    } else {
        return maybeDereferencedIdentifier(state, maybeNextXorNode);
    }
}
