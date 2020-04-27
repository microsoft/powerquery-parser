// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Result, ResultUtils } from "../common";
import { Ast, AstUtils } from "../language";
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

    return ResultUtils.ensureResult(settings.localizationTemplates, () => inspectScopeType(state));
}

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
    state.deltaTypeById.set(nodeId, scopeType);

    return scopeType;
}

function translateScopeItem(state: ScopeTypeInspectionState, scopeItem: TScopeItem): Type.TType {
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
            return translateXorNode(state, scopeItem.eachExpression);

        case ScopeItemKind.KeyValuePair:
            return scopeItem.maybeValue === undefined ? anyFactory() : translateXorNode(state, scopeItem.maybeValue);

        case ScopeItemKind.Parameter:
            return parameterFactory(scopeItem);

        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined ? anyFactory() : translateXorNode(state, scopeItem.maybeValue);

        case ScopeItemKind.Undefined:
            return unknownFactory();

        default:
            throw isNever(scopeItem);
    }
}

function translateXorNode(state: ScopeTypeInspectionState, xorNode: TXorNode): Type.TType {
    let result: Type.TType;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = translateBinOpExpression(state, xorNode);
            break;

        case Ast.NodeKind.AsExpression: {
            result = translateFromChildAttributeIndex(state, xorNode, 2);
            break;
        }

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

        case Ast.NodeKind.LetExpression:
            result = translateFromChildAttributeIndex(state, xorNode, 3);
            break;

        case Ast.NodeKind.ListExpression:
            result = genericFactory(Type.TypeKind.List, false);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = translateLiteralExpression(xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = translateRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
            result = genericFactory(Type.TypeKind.Record, false);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = translateUnaryExpression(state, xorNode);
            break;

        default:
            result = unknownFactory();
    }

    return result;
}

function genericFactory(typeKind: Type.TypeKind, isNullable: boolean): Type.TType {
    return {
        kind: typeKind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}

function anyFactory(): Type.TType {
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

function unknownFactory(): Type.TType {
    return {
        kind: Type.TypeKind.Unknown,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

function noneFactory(): Type.TType {
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
            return translateTableOrRecordUnion(leftType, rightType);
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
        returnType: inspectedFunctionExpression.returnType,
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

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(
        state,
        xorNode.node as Ast.Identifier,
        false,
    );
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

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(
        state,
        (xorNode.node as Ast.IdentifierExpression).identifier,
        false,
    );
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
        if (!recursiveAnyUnionCheck(conditionType, (type: Type.TType) => type.kind === Type.TypeKind.Logical)) {
            return unknownFactory();
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        return noneFactory();
    }

    const trueExprType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: Type.TType = translateFromChildAttributeIndex(state, xorNode, 5);

    return anyUnionFactory([trueExprType, falseExprType]);
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
            const typeKind: Exclude<Type.TypeKind, Type.TExtendedTypeKind> = TypeUtils.typeKindFromLiteralKind(
                literalKind,
            );
            return genericFactory(typeKind, literalKind === Ast.LiteralKind.Null);

        case XorNodeKind.Context:
            return unknownFactory();

        default:
            throw isNever(xorNode);
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

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalKind: Ast.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
            const typeKind: Exclude<Type.TypeKind, Type.TExtendedTypeKind> = TypeUtils.typeKindFromLiteralKind(
                literalKind,
            );
            return genericFactory(typeKind, literalKind === Ast.LiteralKind.Null);

        case XorNodeKind.Context:
            return unknownFactory();

        default:
            throw isNever(xorNode);
    }
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
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThan, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThanEqualTo, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThan, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThanEqualTo, typeKind), typeKind],
    ];
}

function createLookupsForEquality(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.EqualTo, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.NotEqualTo, typeKind), typeKind],
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

function translateTableOrRecordUnion(leftType: Type.TType, rightType: Type.TType): Type.TType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return genericFactory(leftType.kind, leftType.isNullable || rightType.isNullable);
    }
    // '[key=value] & []'
    else if (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind === undefined) {
        return leftType;
    }
    // '[] & [key=value]'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind !== undefined) {
        return rightType;
    } else {
        throw new Error("TODO");
    }
}

// recursively flattens all AnyUnion.unionedTypePairs into a single array,
// maps each entry into a boolean,
// then calls any(...) on the mapped values.
function recursiveAnyUnionCheck(anyUnion: Type.AnyUnion, conditionFn: (type: Type.TType) => boolean): boolean {
    return (
        anyUnion.unionedTypePairs
            .map((type: Type.TType) => {
                return type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion
                    ? recursiveAnyUnionCheck(type, conditionFn)
                    : conditionFn(type);
            })
            .indexOf(false) === -1
    );
}

function maybeDereferencedIdentifierType(
    state: ScopeTypeInspectionState,
    identifier: Ast.Identifier,
    isRecursive: boolean,
): undefined | Type.TType {
    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, identifier.id);

    const maybeScopeItem: undefined | TScopeItem = scopeItemByKey.get(identifier.literal);
    if (maybeScopeItem === undefined) {
        return undefined;
    }
    const scopeItem: TScopeItem = maybeScopeItem;
    if (scopeItem.recursive !== isRecursive) {
        return undefined;
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
    const nextXorNode: TXorNode = maybeNextXorNode;

    if (nextXorNode.node.kind === Ast.NodeKind.Identifier) {
        return nextXorNode.kind === XorNodeKind.Ast
            ? maybeDereferencedIdentifierType(state, nextXorNode.node, false)
            : undefined;
    } else if (nextXorNode.node.kind === Ast.NodeKind.IdentifierExpression) {
        if (nextXorNode.kind === XorNodeKind.Context) {
            return undefined;
        }
        return maybeDereferencedIdentifierType(
            state,
            nextXorNode.node.identifier,
            nextXorNode.node.maybeInclusiveConstant !== undefined,
        );
    } else {
        return translateXorNode(state, nextXorNode);
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
