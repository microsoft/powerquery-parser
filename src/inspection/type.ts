// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, CommonError, isNever, MapUtils, Result, ResultUtils } from "../common";
import { Ast, AstUtils } from "../language";
import { getLocalizationTemplates } from "../localization";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeKind } from "../parser";
import { CommonSettings } from "../settings";
import { Type, TypeInspector, TypeUtils } from "../type";
import {
    ParameterScopeItem,
    ScopeById,
    ScopeItemByKey,
    ScopeItemKind,
    TriedScopeForRoot,
    tryScopeForRoot,
    TScopeItem,
} from "./scope";

export type TriedScopeType = Result<ScopeTypeByKey, CommonError.CommonError>;

export type ScopeTypeByKey = Map<string, Type.TType>;

export type ScopeTypeById = Map<number, Type.TType>;

export function tryScopeTypeForRoot(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    scopeById: ScopeById,
    ancestry: ReadonlyArray<TXorNode>,
    maybeScopeTypeById: undefined | ScopeTypeById,
): TriedScopeType {
    const state: ScopeTypeInspectionState = {
        settings,
        givenTypeById: maybeScopeTypeById !== undefined ? maybeScopeTypeById : new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        leafNodeIds,
        ancestry,
        scopeById,
    };

    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => inspectScopeType(state));
}

type TRecordOrTable =
    | Type.IPrimitiveType<Type.TypeKind.Record>
    | Type.IPrimitiveType<Type.TypeKind.Table>
    | Type.DefinedRecord
    | Type.DefinedTable;

interface ScopeTypeInspectionState {
    readonly settings: CommonSettings;
    readonly givenTypeById: ScopeTypeById;
    readonly deltaTypeById: ScopeTypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    readonly ancestry: ReadonlyArray<TXorNode>;
    scopeById: ScopeById;
}

function inspectScopeType(state: ScopeTypeInspectionState): ScopeTypeByKey {
    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, state.ancestry[0].node.id);

    for (const scopeItem of scopeItemByKey.values()) {
        if (!state.givenTypeById.has(scopeItem.id)) {
            state.deltaTypeById.set(scopeItem.id, getOrCreateType(state, scopeItem));
        }
    }

    for (const [key, value] of state.deltaTypeById.entries()) {
        state.givenTypeById.set(key, value);
    }

    const result: ScopeTypeByKey = new Map();
    for (const [key, scopeItem] of scopeItemByKey.entries()) {
        const maybeType: Type.TType | undefined = state.givenTypeById.get(scopeItem.id);
        if (maybeType === undefined) {
            const details: {} = { nodeId: scopeItem.id };
            throw new CommonError.InvariantError(`expected nodeId to be in givenTypeById`, details);
        }

        result.set(key, maybeType);
    }

    return result;
}

function getOrCreateType(state: ScopeTypeInspectionState, scopeItem: TScopeItem): Type.TType {
    const nodeId: number = scopeItem.id;

    const maybeGivenType: Type.TType | undefined = state.givenTypeById.get(nodeId);
    if (maybeGivenType !== undefined) {
        return maybeGivenType;
    }

    const maybeDeltaType: Type.TType | undefined = state.givenTypeById.get(nodeId);
    if (maybeDeltaType !== undefined) {
        return maybeDeltaType;
    }

    const scopeType: Type.TType = translateScopeItem(state, scopeItem);
    return scopeType;
}

function translateScopeItem(state: ScopeTypeInspectionState, scopeItem: TScopeItem): Type.TType {
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
            return translateXorNode(state, scopeItem.eachExpression);

        case ScopeItemKind.KeyValuePair:
            return scopeItem.maybeValue === undefined
                ? unknownFactory()
                : translateXorNode(state, scopeItem.maybeValue);

        case ScopeItemKind.Parameter:
            return parameterFactory(scopeItem);

        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined
                ? unknownFactory()
                : translateXorNode(state, scopeItem.maybeValue);

        case ScopeItemKind.Undefined:
            return unknownFactory();

        default:
            throw isNever(scopeItem);
    }
}

function translateXorNode(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    const xorNodeId: number = xorNode.node.id;
    const maybeCached: Type.TType | undefined =
        state.givenTypeById.get(xorNodeId) || state.deltaTypeById.get(xorNodeId);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: Type.TType;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = translateBinOpExpression(state, xorNode);
            break;

        case Ast.NodeKind.ArrayWrapper:
            throw new CommonError.InvariantError(`this should never be a scope item`);

        // TODO: how should error handling be typed?
        case Ast.NodeKind.ErrorHandlingExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
            result = anyFactory();
            break;

        case Ast.NodeKind.AsExpression:
            result = translateFromChildAttributeIndex(state, xorNode, 2);
            break;

        case Ast.NodeKind.AsType:
            result = translateFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.AsNullablePrimitiveType:
            result = translateFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.Constant:
            result = translateConstant(xorNode);
            break;

        case Ast.NodeKind.Csv:
            result = translateFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.EachExpression:
            result = translateFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.FieldProjection:
            result = translateFieldProjection(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            result = translateFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            result = translateIdentifier(state, xorNode);
            break;

        case Ast.NodeKind.IdentifierExpression:
            result = translateIdentifierExpression(state, xorNode);
            break;

        case Ast.NodeKind.IfExpression:
            result = translateIfExpression(state, xorNode);
            break;

        case Ast.NodeKind.InvokeExpression:
            result = translateInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.LetExpression:
            result = translateFromChildAttributeIndex(state, xorNode, 3);
            break;

        case Ast.NodeKind.ListExpression:
            result = translateListExpression(state, xorNode);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = translateLiteralExpression(xorNode);
            break;

        case Ast.NodeKind.PrimitiveType:
            result = translatePrimitiveType(xorNode);
            break;

        case Ast.NodeKind.RangeExpression:
            result = translateRangeExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = translateRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
            result = translateRecordExpression(state, xorNode);
            break;

        case Ast.NodeKind.TypePrimaryType:
            result = translateTypePrimaryType(state, xorNode);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = translateUnaryExpression(state, xorNode);
            break;

        default:
            // throw isNever(xorNode.node.kind);
            result = unknownFactory();
    }

    state.deltaTypeById.set(xorNodeId, result);
    return result;
}

function genericFactory<T extends Type.TypeKind>(typeKind: T, isNullable: boolean): Type.IPrimitiveType<T> {
    return {
        kind: typeKind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}

function anyFactory(): Type.IPrimitiveType<Type.TypeKind.Any> {
    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: undefined,
        isNullable: true,
    };
}

function anyUnionFactory(unionedTypePairs: ReadonlyArray<Type.TType>): Type.AnyUnion {
    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.TType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs,
    };
}

function unknownFactory(): Type.IPrimitiveType<Type.TypeKind.Unknown> {
    return {
        kind: Type.TypeKind.Unknown,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

function noneFactory(): Type.IPrimitiveType<Type.TypeKind.None> {
    return {
        kind: Type.TypeKind.None,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

function parameterFactory(parameter: ParameterScopeItem): Type.TType {
    if (parameter.maybeType === undefined) {
        return unknownFactory();
    }

    return {
        kind: TypeUtils.typeKindFromPrimitiveTypeConstantKind(parameter.maybeType),
        maybeExtendedKind: undefined,
        isNullable: parameter.isNullable,
    };
}

function translateFromChildAttributeIndex(
    state: ScopeTypeInspectionState,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Type.TType {
    const maybeXorNode: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
        undefined,
    );
    return maybeXorNode !== undefined ? translateXorNode(state, maybeXorNode) : unknownFactory();
}

function translateBinOpExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
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
        return unknownFactory();
    }
    // '1'
    else if (maybeOperatorKind === undefined) {
        return translateXorNode(state, maybeLeft);
    }
    // '1 +'
    else if (maybeRight === undefined || maybeRight.kind === XorNodeKind.Context) {
        const leftType: Type.TType = translateXorNode(state, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;

        const partialLookupKey: string = binOpExpressionPartialLookupKey(leftType.kind, operatorKind);
        const maybeAllowedTypeKinds: ReadonlyArray<Type.TypeKind> | undefined = BinOpExpressionPartialLookup.get(
            partialLookupKey,
        );
        if (maybeAllowedTypeKinds === undefined) {
            return noneFactory();
        } else if (maybeAllowedTypeKinds.length === 1) {
            return genericFactory(maybeAllowedTypeKinds[0], leftType.isNullable);
        } else {
            const unionedTypePairs: ReadonlyArray<Type.TType> = maybeAllowedTypeKinds.map((kind: Type.TypeKind) => {
                return {
                    kind,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                };
            });
            return anyUnionFactory(unionedTypePairs);
        }
    }
    // '1 + 1'
    else {
        const leftType: Type.TType = translateXorNode(state, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;
        const rightType: Type.TType = translateXorNode(state, maybeRight);

        const key: string = binOpExpressionLookupKey(leftType.kind, operatorKind, rightType.kind);
        const maybeResultTypeKind: Type.TypeKind | undefined = BinOpExpressionLookup.get(key);
        if (maybeResultTypeKind === undefined) {
            return noneFactory();
        }
        const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

        // '[foo = 1] & [bar = 2]'
        if (
            operatorKind === Ast.ArithmeticOperatorKind.And &&
            (resultTypeKind === Type.TypeKind.Record || resultTypeKind === Type.TypeKind.Table)
        ) {
            return translateRecordOrTableUnion(leftType as TRecordOrTable, rightType as TRecordOrTable);
        } else {
            return genericFactory(resultTypeKind, leftType.isNullable || rightType.isNullable);
        }
    }
}

function translateConstant(xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.Constant,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return unknownFactory();
    }

    const constant: Ast.TConstant = xorNode.node as Ast.TConstant;
    switch (constant.constantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return genericFactory(Type.TypeKind.Action, false);
        case Ast.PrimitiveTypeConstantKind.Any:
            return genericFactory(Type.TypeKind.Any, true);
        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return genericFactory(Type.TypeKind.AnyNonNull, false);
        case Ast.PrimitiveTypeConstantKind.Binary:
            return genericFactory(Type.TypeKind.Binary, false);
        case Ast.PrimitiveTypeConstantKind.Date:
            return genericFactory(Type.TypeKind.Date, false);
        case Ast.PrimitiveTypeConstantKind.DateTime:
            return genericFactory(Type.TypeKind.DateTime, false);
        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return genericFactory(Type.TypeKind.DateTimeZone, false);
        case Ast.PrimitiveTypeConstantKind.Duration:
            return genericFactory(Type.TypeKind.Duration, false);
        case Ast.PrimitiveTypeConstantKind.Function:
            return genericFactory(Type.TypeKind.Function, false);
        case Ast.PrimitiveTypeConstantKind.List:
            return genericFactory(Type.TypeKind.List, false);
        case Ast.PrimitiveTypeConstantKind.Logical:
            return genericFactory(Type.TypeKind.Logical, false);
        case Ast.PrimitiveTypeConstantKind.None:
            return genericFactory(Type.TypeKind.None, false);
        case Ast.PrimitiveTypeConstantKind.Null:
            return genericFactory(Type.TypeKind.Null, true);
        case Ast.PrimitiveTypeConstantKind.Number:
            return genericFactory(Type.TypeKind.Number, false);
        case Ast.PrimitiveTypeConstantKind.Record:
            return genericFactory(Type.TypeKind.Record, false);
        case Ast.PrimitiveTypeConstantKind.Table:
            return genericFactory(Type.TypeKind.Table, false);
        case Ast.PrimitiveTypeConstantKind.Text:
            return genericFactory(Type.TypeKind.Text, false);
        case Ast.PrimitiveTypeConstantKind.Time:
            return genericFactory(Type.TypeKind.Time, false);
        case Ast.PrimitiveTypeConstantKind.Type:
            return genericFactory(Type.TypeKind.Type, false);

        default:
            return unknownFactory();
    }
}

function translateFieldProjection(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.FieldProjection,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const projectedFieldNames: ReadonlyArray<string> = NodeIdMapIterator.fieldProjectionGeneralizedIdentifiers(
        state.nodeIdMapCollection,
        xorNode,
    ).map((generalizedIdentifier: Ast.GeneralizedIdentifier) => generalizedIdentifier.literal);
    const previousSibling: TXorNode = NodeIdMapUtils.expectRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = translateXorNode(state, previousSibling);

    if (previousSiblingType.kind !== Type.TypeKind.Record && previousSiblingType.kind !== Type.TypeKind.Table) {
        return noneFactory();
    } else if (previousSiblingType.maybeExtendedKind === undefined) {
        const newFields: Map<string, Type.IPrimitiveType<Type.TypeKind.Any>> = new Map(
            projectedFieldNames.map((key: string) => [key, anyFactory()]),
        );

        switch (previousSiblingType.kind) {
            case Type.TypeKind.Record:
                return {
                    kind: previousSiblingType.kind,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                    isNullable: false,
                    fields: newFields,
                    isOpen: false,
                };

            case Type.TypeKind.Table:
                return {
                    kind: previousSiblingType.kind,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                    isNullable: false,
                    fields: newFields,
                    isOpen: false,
                };

            default:
                throw isNever(previousSiblingType.kind);
        }
    } else {
        return reducedFieldsToKeys(previousSiblingType, projectedFieldNames);
    }
}

function reducedFieldsToKeys(
    current: Type.DefinedRecord | Type.DefinedTable,
    keys: ReadonlyArray<string>,
): Type.DefinedRecord | Type.DefinedTable | Type.IPrimitiveType<Type.TypeKind.None> {
    const currentFields: Map<string, Type.TType> = current.fields;
    const currentFieldNames: ReadonlyArray<string> = [...current.fields.keys()];
    if (ArrayUtils.isSubset(currentFieldNames, keys) === false) {
        return noneFactory();
    }

    return {
        ...current,
        fields: MapUtils.pick(currentFields, keys),
    };
}

function translateFunctionExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
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
    const expressionType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 3);

    // FunctionExpression.maybeFunctionReturnType doesn't always match FunctionExpression.expression.
    // By examining the expression we might get a more accurate return type (eg. Function vs DefinedFunction),
    // or discover an error (eg. maybeFunctionReturnType is Number but expression is Text).
    let returnType: Type.TType;
    if (inspectedReturnType.kind === Type.TypeKind.Any) {
        returnType = expressionType;
    } else if (
        expressionType.kind === Type.TypeKind.Any &&
        expressionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
        allForAnyUnion(
            expressionType,
            (type: Type.TType) => type.kind === inspectedReturnType.kind || type.kind === Type.TypeKind.Any,
        )
    ) {
        returnType = expressionType;
    } else if (inspectedReturnType.kind !== expressionType.kind) {
        return noneFactory();
    } else if (expressionType.kind !== Type.TypeKind.Unknown) {
        returnType = expressionType;
    } else {
        returnType = inspectedReturnType;
    }

    return {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable: false,
        parameterTypes: inspectedFunctionExpression.parameters.map(
            (parameter: TypeInspector.InspectedFunctionParameter) => {
                return genericFactory(
                    parameter.maybeType !== undefined ? parameter.maybeType : Type.TypeKind.Unknown,
                    parameter.isNullable,
                );
            },
        ),
        returnType,
    };
}

function translateIdentifier(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.Identifier,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return unknownFactory();
    }

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType !== undefined ? dereferencedType : unknownFactory();
}

function translateIdentifierExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.IdentifierExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return unknownFactory();
    }

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType !== undefined ? dereferencedType : unknownFactory();
}

function translateIfExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.IfExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const conditionType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 1);
    // Ensure unions are unions of only logicals
    if (conditionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
        if (!allForAnyUnion(conditionType, (type: Type.TType) => type.kind === Type.TypeKind.Logical)) {
            return unknownFactory();
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        return noneFactory();
    }

    const trueExprType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 5);

    return anyUnionFactory([trueExprType, falseExprType]);
}

function translateInvokeExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
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
    // const deferenced = previousSibling.node.kind === Ast.NodeKind.IdentifierExpression ? deference
    const previousSiblingType: Type.TType = translateXorNode(state, previousSibling);

    if (previousSiblingType.kind !== Type.TypeKind.Function) {
        return noneFactory();
    } else if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        const maybePreviousSiblingExpression: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            state.nodeIdMapCollection,
            previousSibling.node.id,
            3,
            undefined,
        );
        if (maybePreviousSiblingExpression === undefined) {
            return previousSiblingType.returnType;
        }

        return translateXorNode(state, maybePreviousSiblingExpression);
    } else {
        return anyFactory();
    }
}

function translateListExpression(
    state: ScopeTypeInspectionState,
    xorNode: TXorNode,
): Type.IPrimitiveType<Type.TypeKind.List> | Type.DefinedList {
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.listItems(state.nodeIdMapCollection, xorNode);
    if (items.length === 0) {
        return genericFactory(Type.TypeKind.List, false);
    }

    const itemTypes: ReadonlyArray<Type.TType> = items.map((item: TXorNode) => translateXorNode(state, item));
    const firstType: Type.TType = itemTypes[0];
    const equalityComparisons: ReadonlyArray<boolean> = itemTypes.map((iterType: Type.TType) =>
        TypeUtils.equalType(firstType, iterType),
    );
    const allSameTypes: boolean = equalityComparisons.indexOf(false) === -1;

    if (allSameTypes === true) {
        return {
            kind: Type.TypeKind.List,
            isNullable: false,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
            itemType: firstType,
        };
    } else {
        return genericFactory(Type.TypeKind.List, false);
    }
}

function translateLiteralExpression(xorNode: TXorNode): Type.TType {
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
            return genericFactory(typeKind, literalKind === Ast.LiteralKind.Null);

        case XorNodeKind.Context:
            return unknownFactory();

        default:
            throw isNever(xorNode);
    }
}

function translatePrimitiveType(xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.PrimitiveType,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return unknownFactory();
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

function translateRangeExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.RangeExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeLeftType: Type.TType | undefined = translateFromChildAttributeIndex(state, xorNode, 0);
    const maybeRightType: Type.TType | undefined = translateFromChildAttributeIndex(state, xorNode, 2);

    if (maybeLeftType === undefined || maybeRightType === undefined) {
        return unknownFactory();
    } else if (maybeLeftType.kind === Type.TypeKind.Number && maybeRightType.kind === Type.TypeKind.Number) {
        // TODO: handle isNullable better
        if (maybeLeftType.isNullable === true || maybeRightType.isNullable === true) {
            return noneFactory();
        } else {
            return genericFactory(maybeLeftType.kind, maybeLeftType.isNullable);
        }
    } else if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return noneFactory();
    } else if (maybeLeftType.kind === Type.TypeKind.Unknown || maybeRightType.kind === Type.TypeKind.Unknown) {
        return unknownFactory();
    } else {
        return noneFactory();
    }
}

function translateRecursivePrimaryExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
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
        return unknownFactory();
    }

    const headType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 0);
    if (
        headType.kind === Type.TypeKind.Any ||
        headType.kind === Type.TypeKind.None ||
        headType.kind === Type.TypeKind.Unknown
    ) {
        return headType;
    }

    const maybeArrayWrapper:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeArrayWrapper === undefined) {
        return unknownFactory();
    }

    const maybeExpressions: ReadonlyArray<TXorNode> | undefined = NodeIdMapIterator.expectXorChildren(
        state.nodeIdMapCollection,
        maybeArrayWrapper.node.id,
    );
    if (maybeExpressions === undefined) {
        return unknownFactory();
    }

    let leftType: Type.TType = headType;
    // let left: TXorNode = maybeHead;
    for (const right of maybeExpressions) {
        const rightType: Type.TType = translateXorNode(state, right);
        leftType = rightType;
        // left = right;
    }

    return leftType;
}

function translateRecordExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.DefinedRecord {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.RecordExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const fields: Map<string, Type.TType> = new Map();
    for (const keyValuePair of NodeIdMapIterator.recordKeyValuePairs(state.nodeIdMapCollection, xorNode)) {
        if (keyValuePair.maybeValue) {
            fields.set(keyValuePair.keyLiteral, translateXorNode(state, keyValuePair.maybeValue));
        } else {
            fields.set(keyValuePair.keyLiteral, unknownFactory());
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

function translateTypePrimaryType(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.DefinedType {
    const primaryType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 1);
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: primaryType.isNullable,
        primaryType,
    };
}

function translateUnaryExpression(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
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
        return unknownFactory();
    }

    const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeExpression === undefined) {
        return unknownFactory();
    }

    // Only certain operators are allowed depending on the type.
    // Unlike BinOpExpression, it's easier to implement the check without a lookup table.
    let expectedUnaryOperatorKinds: ReadonlyArray<Ast.UnaryOperatorKind>;
    const expressionType: Type.TType = translateXorNode(state, maybeExpression);
    if (expressionType.kind === Type.TypeKind.Number) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Positive, Ast.UnaryOperatorKind.Negative];
    } else if (expressionType.kind === Type.TypeKind.Logical) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Not];
    } else {
        return noneFactory();
    }

    const operators: ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>> = NodeIdMapIterator.maybeAstChildren(
        nodeIdMapCollection,
        maybeOperatorsWrapper.node.id,
    ) as ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>>;
    for (const operator of operators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return noneFactory();
        }
    }

    return expressionType;
}

const BinOpExpressionLookup: ReadonlyMap<string, Type.TypeKind> = new Map([
    ...createLookupsForRelational(Type.TypeKind.Null),
    ...createLookupsForEquality(Type.TypeKind.Null),

    ...createLookupsForRelational(Type.TypeKind.Logical),
    ...createLookupsForEquality(Type.TypeKind.Logical),
    ...createLookupsForLogical(Type.TypeKind.Logical),

    ...createLookupsForRelational(Type.TypeKind.Number),
    ...createLookupsForEquality(Type.TypeKind.Number),
    ...createLookupsForArithmetic(Type.TypeKind.Number),

    ...createLookupsForRelational(Type.TypeKind.Time),
    ...createLookupsForEquality(Type.TypeKind.Time),
    ...createLookupsForClockKind(Type.TypeKind.Time),
    [
        binOpExpressionLookupKey(Type.TypeKind.Date, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Time),
        Type.TypeKind.DateTime,
    ],

    ...createLookupsForRelational(Type.TypeKind.Date),
    ...createLookupsForEquality(Type.TypeKind.Date),
    ...createLookupsForClockKind(Type.TypeKind.Date),
    [
        binOpExpressionLookupKey(Type.TypeKind.Date, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Time),
        Type.TypeKind.DateTime,
    ],

    ...createLookupsForRelational(Type.TypeKind.DateTime),
    ...createLookupsForEquality(Type.TypeKind.DateTime),
    ...createLookupsForClockKind(Type.TypeKind.DateTime),

    ...createLookupsForRelational(Type.TypeKind.DateTimeZone),
    ...createLookupsForEquality(Type.TypeKind.DateTimeZone),
    ...createLookupsForClockKind(Type.TypeKind.DateTimeZone),

    ...createLookupsForRelational(Type.TypeKind.Duration),
    ...createLookupsForEquality(Type.TypeKind.Duration),
    [
        binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Duration,
            Ast.ArithmeticOperatorKind.Subtraction,
            Type.TypeKind.Duration,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Duration,
            Ast.ArithmeticOperatorKind.Multiplication,
            Type.TypeKind.Number,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Number,
            Ast.ArithmeticOperatorKind.Multiplication,
            Type.TypeKind.Duration,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Division, Type.TypeKind.Number),
        Type.TypeKind.Duration,
    ],

    ...createLookupsForRelational(Type.TypeKind.Text),
    ...createLookupsForEquality(Type.TypeKind.Text),
    [
        binOpExpressionLookupKey(Type.TypeKind.Text, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Text),
        Type.TypeKind.Text,
    ],

    ...createLookupsForRelational(Type.TypeKind.Binary),
    ...createLookupsForEquality(Type.TypeKind.Binary),

    ...createLookupsForEquality(Type.TypeKind.List),
    [
        binOpExpressionLookupKey(Type.TypeKind.List, Ast.ArithmeticOperatorKind.And, Type.TypeKind.List),
        Type.TypeKind.List,
    ],

    ...createLookupsForEquality(Type.TypeKind.Record),
    [
        binOpExpressionLookupKey(Type.TypeKind.Record, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Record),
        Type.TypeKind.Record,
    ],

    ...createLookupsForEquality(Type.TypeKind.Table),
    [
        binOpExpressionLookupKey(Type.TypeKind.Table, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Table),
        Type.TypeKind.Table,
    ],
]);

// Creates a lookup of what types are accepted in a BinOpExpression which hasn't parsed its second operand.
// Eg. '1 + ' and 'true and '
//
// Created by processing BinOpExpressionLookup's keys, which are in the form of:
// <first operand> , <operator> , <second operand>
// The partial lookup key is the first two components (first operand, operator),
// and the value is the set of (second operand).
const BinOpExpressionPartialLookup: ReadonlyMap<string, ReadonlyArray<Type.TypeKind>> = new Map(
    // Grab the keys
    [...BinOpExpressionLookup.keys()]
        .reduce(
            (
                binaryExpressionPartialLookup: Map<string, ReadonlyArray<Type.TypeKind>>,
                key: string,
                _currentIndex,
                _array,
            ): Map<string, ReadonlyArray<Type.TypeKind>> => {
                const lastDeliminatorIndex: number = key.lastIndexOf(",");
                // Grab '<first operand> , <operator>'.
                const partialKey: string = key.slice(0, lastDeliminatorIndex);
                // Grab '<second operand>'.
                const potentialNewValue: Type.TypeKind = key.slice(lastDeliminatorIndex + 1) as Type.TypeKind;

                // Add the potentialNewValue if it's a new type.
                const maybeValues: ReadonlyArray<Type.TypeKind> | undefined = binaryExpressionPartialLookup.get(
                    partialKey,
                );
                // First occurance of '<first operand> , <operator>'
                if (maybeValues === undefined) {
                    binaryExpressionPartialLookup.set(partialKey, [potentialNewValue]);
                }
                // First occurance of '<second operand>' in '<first operand> , <operator>'
                else if (maybeValues.indexOf(potentialNewValue) !== -1) {
                    binaryExpressionPartialLookup.set(partialKey, [...maybeValues, potentialNewValue]);
                }

                return binaryExpressionPartialLookup;
            },
            new Map(),
        )
        .entries(),
);

function binOpExpressionPartialLookupKey(
    leftTypeKind: Type.TypeKind,
    operatorKind: Ast.TBinOpExpressionOperator,
): string {
    return `${leftTypeKind},${operatorKind}`;
}

function binOpExpressionLookupKey(
    leftTypeKind: Type.TypeKind,
    operatorKind: Ast.TBinOpExpressionOperator,
    rightTypeKind: Type.TypeKind,
): string {
    return `${leftTypeKind},${operatorKind},${rightTypeKind}`;
}

function createLookupsForRelational(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThan, typeKind), Type.TypeKind.Logical],
        [
            binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThanEqualTo, typeKind),
            Type.TypeKind.Logical,
        ],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThan, typeKind), Type.TypeKind.Logical],
        [
            binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThanEqualTo, typeKind),
            Type.TypeKind.Logical,
        ],
    ];
}

function createLookupsForEquality(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.EqualTo, typeKind), Type.TypeKind.Logical],
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.NotEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

// Note: does not include the and <'&'> operator.
function createLookupsForArithmetic(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Division, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Multiplication, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), typeKind],
    ];
}

function createLookupsForLogical(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.LogicalOperatorKind.And, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.LogicalOperatorKind.Or, typeKind), typeKind],
    ];
}

function createLookupsForClockKind(
    typeKind: Type.TypeKind.Date | Type.TypeKind.DateTime | Type.TypeKind.DateTimeZone | Type.TypeKind.Time,
): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, Type.TypeKind.Duration), typeKind],
        [binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, Type.TypeKind.Duration), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), Type.TypeKind.Duration],
    ];
}

function translateRecordOrTableUnion(leftType: TRecordOrTable, rightType: TRecordOrTable): Type.TType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []' or '#table() & #table()'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return genericFactory(leftType.kind, leftType.isNullable || rightType.isNullable);
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
    else if (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind !== undefined) {
        return unionFields(leftType, rightType);
    } else {
        throw new CommonError.InvariantError(`this should never be reached, but TypeScript can't tell that`);
    }
}

function unionFields(
    leftType: Type.DefinedRecord | Type.DefinedTable,
    rightType: Type.DefinedRecord | Type.DefinedTable,
): Type.DefinedRecord {
    const combinedFields: Map<string, Type.TType> = new Map(leftType.fields);
    for (const [key, value] of rightType.fields.entries()) {
        combinedFields.set(key, value);
    }

    return {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        fields: combinedFields,
        isNullable: leftType.isNullable && rightType.isNullable,
        isOpen: leftType.isOpen || rightType.isOpen,
    };
}

// recursively flattens all AnyUnion.unionedTypePairs into a single array,
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

function maybeDereferencedIdentifierType(state: ScopeTypeInspectionState, xorNode: TXorNode): undefined | Type.TType {
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
            throw isNever(deferenced);
    }

    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, deferenced.id);
    const maybeScopeItem: undefined | TScopeItem = scopeItemByKey.get(identifierLiteral);
    if (maybeScopeItem === undefined || (maybeScopeItem.isRecursive === true && isIdentifierRecurisve === false)) {
        return undefined;
    }
    const scopeItem: TScopeItem = maybeScopeItem;
    // TODO: handle recursive identifiers
    if (scopeItem.isRecursive === true) {
        return anyFactory();
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
            return parameterFactory(scopeItem);

        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.Undefined:
            return undefined;

        default:
            throw isNever(scopeItem);
    }

    if (maybeNextXorNode === undefined) {
        return undefined;
    }
    return translateXorNode(state, maybeNextXorNode);
}

function maybeDereferencedIdentifier(state: ScopeTypeInspectionState, xorNode: TXorNode): TXorNode | undefined {
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
            throw isNever(identifier);
    }

    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, identifier.id);
    const maybeScopeItem: undefined | TScopeItem = scopeItemByKey.get(identifierLiteral);
    if (maybeScopeItem === undefined) {
        throw new CommonError.InvariantError(`maybeScopeItem should be at least an instance of Undefined`);
    }
    const scopeItem: TScopeItem = maybeScopeItem;
    if (scopeItem.isRecursive !== isIdentifierRecurisve) {
        return undefined;
    }

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
            throw isNever(scopeItem);
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

function getOrCreateScope(state: ScopeTypeInspectionState, nodeId: number): ScopeItemByKey {
    const maybeScope: ScopeItemByKey | undefined = state.scopeById.get(nodeId);
    if (maybeScope !== undefined) {
        return maybeScope;
    }

    const ancestry: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectAncestry(state.nodeIdMapCollection, nodeId);
    const triedScope: TriedScopeForRoot = tryScopeForRoot(
        state.settings,
        state.nodeIdMapCollection,
        state.leafNodeIds,
        ancestry,
        state.scopeById,
    );
    if (ResultUtils.isErr(triedScope)) {
        throw triedScope.error;
    }

    return triedScope.value;
}
