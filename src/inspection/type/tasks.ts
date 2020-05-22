// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../../common";
import { getLocalizationTemplates } from "../../localization";
import { NodeIdMap, TXorNode } from "../../parser";
import { CommonSettings } from "../../settings";
import { Type } from "../../type";
import { ScopeById, ScopeItemByKey } from "../scope";
import { getOrCreateScope, getOrCreateType } from "./translate";
import { ScopeTypeById, ScopeTypeByKey, ScopeTypeInspectionState } from "./type";

export type TriedScopeType = Result<ScopeTypeByKey, CommonError.CommonError>;

export function tryScopeTypeForRoot(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    scopeById: ScopeById,
    ancestry: ReadonlyArray<TXorNode>,
    maybeScopeTypeById: ScopeTypeById | undefined = new Map(),
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
