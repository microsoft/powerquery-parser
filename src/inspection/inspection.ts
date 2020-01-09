// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { TriedTraverse } from "../common/traversal";
import { NodeIdMap } from "../parser";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { AutocompleteInspected, tryFrom as autocompleteInspectedTryFrom } from "./autocomplete";
import { IdentifierInspected, tryFrom as identifierInspectedTryFrom } from "./identifier";
import { Position } from "./position";

// Inspection is designed to run sub-inspections,
// eg. one inspection for scope and one for keywords.
// Look in `state.ts` to see the traversal and return types for each sub-inspection.
// If any sub-inspection returns an Err, return the Err.
// If all sub-inspections succeed, return the union of all successful traversals.

export interface InspectedCommon {
    readonly maybeActiveNode: Option<ActiveNode>;
}
export type Inspected = InspectedCommon & IdentifierInspected & AutocompleteInspected;
export type TriedInspection = Result<Inspected, CommonError.CommonError>;

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const maybeActiveNode: Option<ActiveNode> = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );

    const triedInspectedIdentifier: TriedTraverse<IdentifierInspected> = identifierInspectedTryFrom(
        maybeActiveNode,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (triedInspectedIdentifier.kind === ResultKind.Err) {
        return triedInspectedIdentifier;
    }

    const triedInspectedKeyword: TriedTraverse<AutocompleteInspected> = autocompleteInspectedTryFrom(maybeActiveNode);
    if (triedInspectedKeyword.kind === ResultKind.Err) {
        return triedInspectedKeyword;
    }

    return {
        kind: ResultKind.Ok,
        value: {
            maybeActiveNode,
            ...triedInspectedIdentifier.value,
            ...triedInspectedKeyword.value,
        },
    };
}
