// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultKind, Traverse } from "../common";
import { TriedTraverse } from "../common/traversal";
import { NodeIdMap } from "../parser";
import { tryFrom as identifierInspectedTryFrom } from "./identifier";
import { tryFrom as keywordInspectedTryFrom } from "./keyword";
import { Position } from "./position";
import { Inspected, InspectedIdentifier, InspectedKeyword } from "./state";

// An inspection is done by selecting a leaf node, then recursively traveling up the node's parents.
// If a leaf node doesn't exist at the given postion, then the closest node to the left is used (if one exists).
//
// There are three forms that the parent path can take:
//  * all nodes are Ast.TNode
//  * all nodes are ParserContext.Node
//  * nodes are initially Ast.TNode, then they become ParserContext.Node

export type TriedInspection = Traverse.TriedTraverse<Inspected>;

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const triedInspectedIdentifier: TriedTraverse<InspectedIdentifier> = identifierInspectedTryFrom(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (triedInspectedIdentifier.kind === ResultKind.Err) {
        return triedInspectedIdentifier;
    }

    const triedInspectedKeyword: TriedTraverse<InspectedKeyword> = keywordInspectedTryFrom(
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
