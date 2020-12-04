// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from "../../..";
import { Assert, ResultUtils } from "../../../powerquery-parser/common";
import { Ast, Type, TypeUtils } from "../../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { CommonSettings } from "../../../settings";
import { NodeScope, ScopeById, ScopeItemKind, tryNodeScope, TScopeItem } from "../../scope";
import { TypeById } from "../commonTypes";
import { inspectTypeConstant } from "./inspectTypeConstant";
import { inspectTypeErrorHandlingExpression } from "./inspectTypeErrorHandlingExpression";
import { inspectTypeFieldProjection } from "./inspectTypeFieldProjection";
import { inspectTypeFieldSelector } from "./inspectTypeFieldSelector";
import { inspectTypeFieldSpecification } from "./inspectTypeFieldSpecification";
import { inspectTypeFunctionExpression } from "./inspectTypeFunctionExpression";
import { inspectTypeFunctionType } from "./inspectTypeFunctionType";
import { inspectTypeIdentifier } from "./inspectTypeIdentifier";
import { inspectTypeIdentifierExpression } from "./inspectTypeIdentifierExpression";
import { inspectTypeIfExpression } from "./inspectTypeIfExpression";
import { inspectTypeInvokeExpression } from "./inspectTypeInvokeExpression";
import { inspectTypeList } from "./inspectTypeList";
import { inspectTypeListType } from "./inspectTypeListType";
import { inspectTypeLiteralExpression } from "./inspectTypeLiteralExpression";
import { inspectTypeNullCoalescingExpression } from "./inspectTypeNullCoalescingExpression";
import { inspectTypeParameter } from "./inspectTypeParameter";
import { inspectTypePrimitiveType } from "./inspectTypePrimitiveType";
import { inspectTypeRangeExpression } from "./inspectTypeRangeExpression";
import { inspectTypeRecord } from "./inspectTypeRecord";
import { inspectTypeRecordType } from "./inspectTypeRecordType";
import { inspectTypeRecursivePrimaryExpression } from "./inspectTypeRecursivePrimaryExpression";
import { inspectTypeTableType } from "./inspectTypeTableType";
import { inspectTypeTBinOpExpression } from "./inspectTypeTBinOpExpression";
import { inspectTypeUnaryExpression } from "./inspectTypeUnaryExpression";

export interface InspectTypeState {
    readonly settings: CommonSettings;
    readonly givenTypeById: TypeById;
    readonly deltaTypeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    scopeById: ScopeById;
}

export function getOrFindScopeItemType(state: InspectTypeState, scopeItem: TScopeItem): Type.TType {
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

export function assertGetOrCreateNodeScope(state: InspectTypeState, nodeId: number): NodeScope {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const triedGetOrCreateScope: Inspection.TriedNodeScope = getOrCreateScope(state, nodeId);
    if (ResultUtils.isErr(triedGetOrCreateScope)) {
        throw triedGetOrCreateScope.error;
    }

    return Assert.asDefined(triedGetOrCreateScope.value);
}

export function getOrCreateScope(state: InspectTypeState, nodeId: number): Inspection.TriedNodeScope {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const maybeNodeScope: NodeScope | undefined = state.scopeById.get(nodeId);
    if (maybeNodeScope !== undefined) {
        return ResultUtils.okFactory(maybeNodeScope);
    }

    return tryNodeScope(state.settings, state.nodeIdMapCollection, state.leafNodeIds, nodeId, state.scopeById);
}

export function inspectScopeItem(state: InspectTypeState, scopeItem: TScopeItem): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
            return inspectXor(state, scopeItem.eachExpression);

        case ScopeItemKind.KeyValuePair:
            return scopeItem.maybeValue === undefined ? Type.UnknownInstance : inspectXor(state, scopeItem.maybeValue);

        case ScopeItemKind.Parameter:
            return TypeUtils.parameterFactory(scopeItem);

        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined ? Type.UnknownInstance : inspectXor(state, scopeItem.maybeValue);

        case ScopeItemKind.Undefined:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(scopeItem);
    }
}

export function inspectXor(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

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
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = inspectTypeTBinOpExpression(state, xorNode);
            break;

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.SectionMember:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
            break;

        case Ast.NodeKind.Csv:
        case Ast.NodeKind.MetadataExpression:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
            result = inspectTypeList(state, xorNode);
            break;

        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.NullablePrimitiveType:
            result = {
                ...inspectTypeFromChildAttributeIndex(state, xorNode, 1),
                isNullable: true,
            };
            break;

        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordExpression:
            result = inspectTypeRecord(state, xorNode);
            break;

        // TODO: how should error raising be typed?
        case Ast.NodeKind.ErrorRaisingExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.Constant:
            result = inspectTypeConstant(xorNode);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            result = inspectTypeErrorHandlingExpression(state, xorNode);
            break;

        case Ast.NodeKind.FieldProjection:
            result = inspectTypeFieldProjection(state, xorNode);
            break;

        case Ast.NodeKind.FieldSelector:
            result = inspectTypeFieldSelector(state, xorNode);
            break;

        case Ast.NodeKind.FieldSpecification:
            result = inspectTypeFieldSpecification(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            result = inspectTypeFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionType:
            result = inspectTypeFunctionType(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            result = inspectTypeIdentifier(state, xorNode);
            break;

        case Ast.NodeKind.IdentifierExpression:
            result = inspectTypeIdentifierExpression(state, xorNode);
            break;

        case Ast.NodeKind.IfExpression:
            result = inspectTypeIfExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsExpression:
            result = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            break;

        case Ast.NodeKind.InvokeExpression:
            result = inspectTypeInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsNullablePrimitiveType:
            result = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.LetExpression:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 3);
            break;

        case Ast.NodeKind.ListType:
            result = inspectTypeListType(state, xorNode);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = inspectTypeLiteralExpression(xorNode);
            break;

        case Ast.NodeKind.NotImplementedExpression:
            result = Type.NoneInstance;
            break;

        case Ast.NodeKind.NullCoalescingExpression:
            result = inspectTypeNullCoalescingExpression(state, xorNode);
            break;

        case Ast.NodeKind.Parameter:
            result = inspectTypeParameter(state, xorNode);
            break;

        case Ast.NodeKind.PrimitiveType:
            result = inspectTypePrimitiveType(xorNode);
            break;

        case Ast.NodeKind.RangeExpression:
            result = inspectTypeRangeExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordType:
            result = inspectTypeRecordType(state, xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = inspectTypeRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.TableType:
            result = inspectTypeTableType(state, xorNode);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = inspectTypeUnaryExpression(state, xorNode);
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    state.deltaTypeById.set(xorNodeId, result);
    return result;
}

export function inspectTypeFromChildAttributeIndex(
    state: InspectTypeState,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const maybeXorNode: TXorNode | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
        undefined,
    );
    return maybeXorNode !== undefined ? inspectXor(state, maybeXorNode) : Type.UnknownInstance;
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

export function maybeDereferencedIdentifierType(state: InspectTypeState, xorNode: TXorNode): undefined | Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

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

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, deferenced.id);
    const maybeScopeItem: undefined | TScopeItem = nodeScope.get(identifierLiteral);
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
    return inspectXor(state, maybeNextXorNode);
}

function maybeDereferencedIdentifier(state: InspectTypeState, xorNode: TXorNode): TXorNode | undefined {
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

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, identifier.id);
    const maybeScopeItem: undefined | TScopeItem = nodeScope.get(identifierLiteral);
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
