// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from "../../..";
import { Assert, ResultUtils } from "../../../common";
import { Ast, ExternalType, ExternalTypeUtils, Type, TypeUtils } from "../../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { InspectionSettings } from "../../../settings";
import { NodeScope, ScopeById, ScopeItemKind, tryNodeScope, TScopeItem } from "../../scope";
import { TypeById } from "../../typeCache";
import { inspectTypeConstant } from "./inspectTypeConstant";
import { inspectTypeEachExpression } from "./inspectTypeEachExpression";
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
    readonly settings: InspectionSettings;
    readonly givenTypeById: TypeById;
    readonly deltaTypeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    scopeById: ScopeById;
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

export function getOrCreateScopeItemType(state: InspectTypeState, scopeItem: TScopeItem): Type.TType {
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

export function inspectScopeItem(state: InspectTypeState, scopeItem: TScopeItem): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined ? Type.UnknownInstance : inspectXor(state, scopeItem.maybeValue);

        case ScopeItemKind.Each:
            return inspectXor(state, scopeItem.eachExpression);

        case ScopeItemKind.Parameter:
            return TypeUtils.parameterFactory(scopeItem);

        case ScopeItemKind.Undefined:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(scopeItem);
    }
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

        case Ast.NodeKind.EachExpression:
            result = inspectTypeEachExpression(state, xorNode);
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

export function maybeDereferencedIdentifierType(state: InspectTypeState, xorNode: TXorNode): Type.TType | undefined {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const deferenced: TXorNode = recursiveIdentifierDereference(state, xorNode);

    const maybeDereferencedLiteral: string | undefined = XorNodeUtils.maybeIdentifierExpressionLiteral(deferenced);
    if (maybeDereferencedLiteral === undefined) {
        return undefined;
    }
    const deferencedLiteral: string = maybeDereferencedLiteral;

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, deferenced.node.id);
    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(deferencedLiteral);
    // The deferenced identifier can't be resolved within the local scope.
    // It either is either an invalid identifier or an external identifier (e.g `Odbc.Database`).
    if (maybeScopeItem === undefined) {
        const maybeResolver: ExternalType.TExternalTypeResolverFn | undefined =
            state.settings.maybeExternalTypeResolver;

        if (maybeResolver === undefined) {
            return undefined;
        }

        const request: ExternalType.ExternalValueTypeRequest = ExternalTypeUtils.valueTypeRequestFactory(
            deferencedLiteral,
        );
        return maybeResolver(request);
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: TXorNode | undefined;
    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.Each:
            maybeNextXorNode = scopeItem.eachExpression;
            break;

        case ScopeItemKind.Parameter:
            return TypeUtils.parameterFactory(scopeItem);

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

// Recursively derefence an identifier if it points to another identifier.
export function recursiveIdentifierDereference(state: InspectTypeState, xorNode: TXorNode): TXorNode {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsIdentifier(xorNode);

    return Assert.asDefined(recursiveIdentifierDereferenceHelper(state, xorNode));
}

// Recursively derefence an identifier if it points to another identifier.
function recursiveIdentifierDereferenceHelper(state: InspectTypeState, xorNode: TXorNode): TXorNode | undefined {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsIdentifier(xorNode);

    if (xorNode.kind === XorNodeKind.Context) {
        return undefined;
    }
    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node as
        | Ast.Identifier
        | Ast.IdentifierExpression;
    const identifierId: number = identifier.id;

    let identifierLiteral: string;
    let isRecursiveIdentifier: boolean;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isRecursiveIdentifier = false;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isRecursiveIdentifier = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    // TODO: handle recursive identifiers
    if (isRecursiveIdentifier === true) {
        return xorNode;
    }

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, identifierId);

    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);
    if (maybeScopeItem === undefined) {
        return xorNode;
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: TXorNode | undefined;
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            return xorNode;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    return maybeNextXorNode !== undefined &&
        maybeNextXorNode.kind !== XorNodeKind.Context &&
        (maybeNextXorNode.node.kind === Ast.NodeKind.Identifier ||
            maybeNextXorNode.node.kind === Ast.NodeKind.IdentifierExpression)
        ? recursiveIdentifierDereferenceHelper(state, maybeNextXorNode)
        : xorNode;
}
