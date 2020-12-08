// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../../common";
import { Type } from "../../language";
import { NodeIdMap, NodeIdMapUtils } from "../../parser";
import { CommonSettings } from "../../settings";
import { NodeScope } from "../scope";
import { ScopeTypeByKey } from "../scope";
import { TypeCache } from "./commonTypes";
import { assertGetOrCreateNodeScope, getOrFindScopeItemType, InspectTypeState, inspectXor } from "./inspectType";

export type TriedScopeType = Result<ScopeTypeByKey, CommonError.CommonError>;

export type TriedType = Result<Type.TType, CommonError.CommonError>;

export function tryScopeType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedScopeType {
    const state: InspectTypeState = {
        settings,
        givenTypeById: maybeTypeCache?.typeById ?? new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        leafNodeIds,
        scopeById: maybeTypeCache?.scopeById ?? new Map(),
    };

    return ResultUtils.ensureResult(settings.locale, () => inspectScopeType(state, nodeId));
}

export function tryType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedType {
    const state: InspectTypeState = {
        settings,
        givenTypeById: maybeTypeCache?.scopeById ?? new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        leafNodeIds,
        scopeById: maybeTypeCache?.typeById ?? new Map(),
    };

    return ResultUtils.ensureResult(settings.locale, () =>
        inspectXor(state, NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId)),
    );
}

function inspectScopeType(state: InspectTypeState, nodeId: number): ScopeTypeByKey {
    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, nodeId);

    for (const scopeItem of nodeScope.values()) {
        if (!state.givenTypeById.has(scopeItem.id)) {
            state.deltaTypeById.set(scopeItem.id, getOrFindScopeItemType(state, scopeItem));
        }
    }

    for (const [key, value] of state.deltaTypeById.entries()) {
        state.givenTypeById.set(key, value);
    }

    const result: ScopeTypeByKey = new Map();
    for (const [key, scopeItem] of nodeScope.entries()) {
        const type: Type.TType = Assert.asDefined(
            state.givenTypeById.get(scopeItem.id),
            `expected nodeId to be in givenTypeById`,
            { nodeId: scopeItem.id },
        );
        result.set(key, type);
    }

    return result;
}
