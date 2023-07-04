// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from "../../common";
import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { TXorNode, XorNode } from "./xorNode";
import { Ast } from "../../language";

// Builds up an TXorNode path starting from nodeId and goes up to the root of the Ast.
export function assertAncestry(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): ReadonlyArray<TXorNode> {
    const ancestryIds: number[] = [nodeId];

    let parentId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);

    while (parentId) {
        ancestryIds.push(parentId);
        parentId = nodeIdMapCollection.parentIdById.get(parentId);
    }

    return NodeIdMapIterator.assertIterXor(nodeIdMapCollection, ancestryIds);
}

export function assertNth(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode {
    return Assert.asDefined(nth(ancestry, ancestryIndex), "ancestryIndex was out of bounds", {
        ancestryLength: ancestry.length,
        ancestryIndex,
    });
}

export function assertNthChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    const xorNode: TXorNode = assertNth(ancestry, ancestryIndex);
    XorNodeUtils.assertIsNodeKind(xorNode, expectedNodeKinds);

    return xorNode;
}

export function findNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    for (const xorNode of ancestry) {
        if (XorNodeUtils.isNodeKind<T>(xorNode, expectedNodeKinds)) {
            return xorNode;
        }
    }

    return undefined;
}

export function indexOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): number | undefined {
    for (const [xorNode, index] of ArrayUtils.enumerate(ancestry)) {
        if (XorNodeUtils.isNodeKind<T>(xorNode, expectedNodeKinds)) {
            return index;
        }
    }

    return undefined;
}

export function nth(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return ancestry[ancestryIndex];
}

export function nthChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const xorNode: TXorNode | undefined = nth(ancestry, ancestryIndex);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}
