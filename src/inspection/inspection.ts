// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { NodeIdMap, ParseError } from "../parser";
import { InspectionSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { InspectedAutocomplete, tryFrom as autocompleteInspectedTryFrom } from "./autocomplete";
import { Position } from "./position";
import { InspectedScope, tryFrom as scopeInspectedTryFrom } from "./scope";

// Inspection is designed to run sub-inspections,
// eg. one inspection for scope and one for keywords.
// Look in `state.ts` to see the traversal and return types for each sub-inspection.
// If any sub-inspection returns an Err, return the Err.
// If all sub-inspections succeed, return the union of all successful traversals.

export interface InspectedCommon {
    readonly maybeActiveNode: ActiveNode | undefined;
}
export type Inspected = InspectedCommon & InspectedScope & InspectedAutocomplete;
export type TriedInspection = Result<Inspected, CommonError.CommonError>;

export function tryFrom(
    settings: InspectionSettings,
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeParseError: ParseError.ParseError | undefined,
): TriedInspection {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );

    const triedInspectedScope: TriedTraverse<InspectedScope> = scopeInspectedTryFrom(
        settings,
        maybeActiveNode,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (ResultUtils.isErr(triedInspectedScope)) {
        return triedInspectedScope;
    }

    const triedInspectedKeyword: TriedTraverse<InspectedAutocomplete> = autocompleteInspectedTryFrom(
        settings,
        maybeActiveNode,
        nodeIdMapCollection,
        maybeParseError,
    );
    if (ResultUtils.isErr(triedInspectedKeyword)) {
        return triedInspectedKeyword;
    }

    return ResultUtils.okFactory({
        maybeActiveNode,
        ...triedInspectedScope.value,
        ...triedInspectedKeyword.value,
    });
}
