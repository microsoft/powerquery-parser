// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultKind, Traverse } from "../common";
import { TriedTraverse } from "../common/traversal";
import { NodeIdMap } from "../parser";
import { tryFrom as identifierInspectedTryFrom } from "./identifier";
import { tryFrom as keywordInspectedTryFrom } from "./keyword";
import { Position } from "./position";
import { IdentifierInspected, Inspected, KeywordInspected } from "./state";

// Inspection is designed to run sub-inspections,
// eg. one inspection for scope and one for keywords.
// Look in `state.ts` to see the traversal and return types for each sub-inspection.
// If any sub-inspection returns an Err, return the Err.
// If all sub-inspections succeed, return the union of all successful traversals.

export type TriedInspection = Traverse.TriedTraverse<Inspected>;

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const triedInspectedIdentifier: TriedTraverse<IdentifierInspected> = identifierInspectedTryFrom(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (triedInspectedIdentifier.kind === ResultKind.Err) {
        return triedInspectedIdentifier;
    }

    const triedInspectedKeyword: TriedTraverse<KeywordInspected> = keywordInspectedTryFrom(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (triedInspectedKeyword.kind === ResultKind.Err) {
        return triedInspectedKeyword;
    }

    return {
        kind: ResultKind.Ok,
        value: {
            ...triedInspectedIdentifier.value,
            ...triedInspectedKeyword.value,
        },
    };
}
