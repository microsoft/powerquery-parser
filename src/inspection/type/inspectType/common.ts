// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../../../common";
import { Ast } from "../../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { CommonSettings } from "../../../settings";
import { Type, TypeUtils } from "../../../type";
import { ScopeById, ScopeItemByKey, ScopeItemKind, tryScopeItems, TScopeItem } from "../../scope";
import { TypeById } from "../common";
import { inspectConstant } from "./inspectConstant";
import { inspectErrorHandlingExpression } from "./inspectErrorHandlingExpression";
import { inspectFieldProjection } from "./inspectFieldProjection";
import { inspectFieldSelector } from "./inspectFieldSelector";
import { inspectFieldSpecification } from "./inspectFieldSpecification";
import { inspectFunctionExpression } from "./inspectFunctionExpression";
import { inspectFunctionType } from "./inspectFunctionType";
import { inspectIdentifier } from "./inspectIdentifier";
import { inspectIdentifierExpression } from "./inspectIdentifierExpression";
import { inspectIfExpression } from "./inspectIfExpression";
import { inspectInvokeExpression } from "./inspectInvokeExpression";
import { inspectList } from "./inspectList";
import { inspectListType } from "./inspectListType";
import { inspectLiteralExpression } from "./inspectLiteralExpression";
import { inspectParameter } from "./inspectParameter";
import { inspectPrimitiveType } from "./inspectPrimitiveType";
import { inspectRangeExpression } from "./inspectRangeExpression";
import { inspectRecord } from "./inspectRecord";
import { inspectRecordType } from "./inspectRecordType";
import { inspectRecursivePrimaryExpression } from "./inspectRecursivePrimaryExpression";
import { inspectTableType } from "./inspectTableType";
import { inspectTBinOpExpression } from "./inspectTBinOpExpression";
import { inspectUnaryExpression } from "./inspectUnaryExpression";

export interface TypeInspectionState {
    readonly settings: CommonSettings;
    readonly givenTypeById: TypeById;
    readonly deltaTypeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    scopeById: ScopeById;
}

export function getOrFindScopeItemType(state: TypeInspectionState, scopeItem: TScopeItem): Type.TType {
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

export function expectGetOrCreateScope(state: TypeInspectionState, nodeId: number): ScopeItemByKey {
    const triedGetOrCreateScope: Result<ScopeItemByKey, CommonError.CommonError> = getOrCreateScope(state, nodeId);
    if (ResultUtils.isErr(triedGetOrCreateScope)) {
        throw triedGetOrCreateScope.error;
    }

    return triedGetOrCreateScope.value;
}

export function getOrCreateScope(
    state: TypeInspectionState,
    nodeId: number,
): Result<ScopeItemByKey, CommonError.CommonError> {
    const maybeScope: ScopeItemByKey | undefined = state.scopeById.get(nodeId);
    if (maybeScope !== undefined) {
        return ResultUtils.okFactory(maybeScope);
    }

    return tryScopeItems(state.settings, state.nodeIdMapCollection, state.leafNodeIds, nodeId, state.scopeById);
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
            return Type.NotApplicableInstance;

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
            result = inspectTBinOpExpression(state, xorNode);
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

export function inspectFromChildAttributeIndex(
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

// Recursively flattens all AnyUnion.unionedTypePairs into a single array,
// maps each entry into a boolean,
// then calls all(...) on the mapped values.
export function allForAnyUnion(anyUnion: Type.AnyUnion, conditionFn: (type: Type.TType) => boolean): boolean {
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

export function maybeDereferencedIdentifierType(state: TypeInspectionState, xorNode: TXorNode): undefined | Type.TType {
    const maybeDeferenced: TXorNode | undefined = maybeDereferencedIdentifier(state, xorNode);
    if (maybeDeferenced === undefined) {
        return undefined;
    }
    XorNodeUtils.assertAnyAstNodeKind(maybeDeferenced, [Ast.NodeKind.Identifier, Ast.NodeKind.IdentifierExpression]);
    Assert.isTrue(maybeDeferenced.kind === XorNodeKind.Ast, `deferencedIdentifier should only return Ast nodes`, {
        deferencedNodeId: maybeDeferenced.node.id,
        deferencedNodeKind: maybeDeferenced.node.kind,
    });

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

    const scopeItemByKey: ScopeItemByKey = expectGetOrCreateScope(state, deferenced.id);
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
    XorNodeUtils.assertAnyAstNodeKind(xorNode, [Ast.NodeKind.Identifier, Ast.NodeKind.IdentifierExpression]);

    if (xorNode.kind === XorNodeKind.Context) {
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

    const scopeItemByKey: ScopeItemByKey = expectGetOrCreateScope(state, identifier.id);
    const maybeScopeItem: undefined | TScopeItem = scopeItemByKey.get(identifierLiteral);

    if (
        // If the identifier couldn't be found in the generated scope,
        // then either the scope generation is incorrect or it's an external identifier (eg. Odbc.Database).
        maybeScopeItem?.isRecursive !== isIdentifierRecurisve
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
