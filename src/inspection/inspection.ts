// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, ResultKind, Traverse } from "../common";
import { TriedTraverse } from "../common/traversal";
import { NodeIdMap, NodeIdMapUtils } from "../parser";
import { tryFrom as autocompleteInspectedTryFrom } from "./autocomplete";
import { tryFrom as identifierInspectedTryFrom } from "./identifier";
import { Position, PositionUtils } from "./position";
import { AutocompleteInspected, IdentifierInspected, Inspected } from "./state";

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
    const maybeActiveXorNode: Option<NodeIdMap.TXorNode> = PositionUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    const activeXorNodeAncestry: ReadonlyArray<NodeIdMap.TXorNode> =
        maybeActiveXorNode !== undefined
            ? NodeIdMapUtils.expectAncestry(nodeIdMapCollection, maybeActiveXorNode.node.id)
            : [];

    const triedInspectedIdentifier: TriedTraverse<IdentifierInspected> = identifierInspectedTryFrom(
        activeXorNodeAncestry,
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (triedInspectedIdentifier.kind === ResultKind.Err) {
        return triedInspectedIdentifier;
    }

    const triedInspectedKeyword: TriedTraverse<AutocompleteInspected> = autocompleteInspectedTryFrom(
        nodeIdMapCollection,
        leafNodeIds,
        position,
        triedInspectedIdentifier.value.maybeIdentifierUnderPosition,
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
