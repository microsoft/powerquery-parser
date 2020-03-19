// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../common";
import { IParserState, NodeIdMap, ParseError } from "../parser";
import { InspectionSettings } from "../settings";
import { tryInspectAutocomplete, tryInspectScope, tryInspectScopeType } from "./";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { InspectedAutocomplete, TriedAutocomplete as TriedInspectAutocomplete } from "./autocomplete";
import { Position } from "./position";
import { InspectedScope, TriedInspectScope } from "./scope";
import { InspectedType, TriedType as TriedInspectType } from "./type";

// Inspection is designed to run sub-inspections,
// eg. one inspection for scope and one for keywords.
// Look in `state.ts` to see the traversal and return types for each sub-inspection.
// If any sub-inspection returns an Err, return the Err.
// If all sub-inspections succeed, return the union of all successful traversals.

export interface InspectedCommon {
    readonly maybeActiveNode: ActiveNode | undefined;
}
export type Inspected = InspectedCommon & InspectedScope & InspectedAutocomplete & InspectedType;
export type TriedInspection = Result<Inspected, CommonError.CommonError>;

export function tryFrom<S = IParserState>(
    settings: InspectionSettings,
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeParseError: ParseError.ParseError<S> | undefined,
): TriedInspection {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );

    const triedInspectScope: TriedInspectScope = tryInspectScope(
        settings,
        maybeActiveNode,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (ResultUtils.isErr(triedInspectScope)) {
        return triedInspectScope;
    }

    const triedInspectType: TriedInspectType = tryInspectScopeType(maybeActiveNode, nodeIdMapCollection);
    if (ResultUtils.isErr(triedInspectType)) {
        return triedInspectType;
    }

    const triedInspectAutocomplete: TriedInspectAutocomplete = tryInspectAutocomplete(
        settings,
        maybeActiveNode,
        nodeIdMapCollection,
        maybeParseError,
    );
    if (ResultUtils.isErr(triedInspectAutocomplete)) {
        return triedInspectAutocomplete;
    }

    return ResultUtils.okFactory({
        maybeActiveNode,
        ...triedInspectScope.value,
        ...triedInspectAutocomplete.value,
        ...triedInspectType.value,
    });
}
