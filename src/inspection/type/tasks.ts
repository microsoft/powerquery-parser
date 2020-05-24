// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../../common";
import { getLocalizationTemplates } from "../../localization";
import { NodeIdMap, NodeIdMapUtils } from "../../parser";
import { CommonSettings } from "../../settings";
import { Type } from "../../type";
import { ScopeById, ScopeItemByKey } from "../scope";
import { getOrCreateScope, getOrCreateType, translateXorNode } from "./translate";
import { ScopeTypeById, ScopeTypeByKey, TypeInspectionState } from "./type";

export type TriedScopeType = Result<ScopeTypeByKey, CommonError.CommonError>;

export type TriedType = Result<Type.TType, CommonError.CommonError>;

export function tryScopeType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    maybeScopeById: ScopeById,
    maybeScopeTypeById: ScopeTypeById | undefined = new Map(),
): TriedScopeType {
    const state: TypeInspectionState = {
        settings,
        givenTypeById: maybeScopeTypeById !== undefined ? maybeScopeTypeById : new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        leafNodeIds,
        scopeById: maybeScopeById !== undefined ? maybeScopeById : new Map(),
    };

    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => inspectScopeType(state, nodeId));
}

export function tryType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    maybeScopeById: ScopeById | undefined,
    maybeScopeTypeById: ScopeTypeById | undefined = new Map(),
): TriedType {
    const state: TypeInspectionState = {
        settings,
        givenTypeById: maybeScopeTypeById !== undefined ? maybeScopeTypeById : new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        leafNodeIds,
        scopeById: maybeScopeById !== undefined ? maybeScopeById : new Map(),
    };

    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () =>
        translateXorNode(state, NodeIdMapUtils.expectXorNode(state.nodeIdMapCollection, nodeId)),
    );
}

function inspectScopeType(state: TypeInspectionState, nodeId: number): ScopeTypeByKey {
    const scopeItemByKey: ScopeItemByKey = getOrCreateScope(state, nodeId);

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
