// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { TXorNode, XorNode } from "./xorNode";
import { Assert } from "../../common";
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

export function assertFirst(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    return assertNth(ancestry, 0);
}

export function assertFirstChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    const xorNode: TXorNode = assertFirst(ancestry);
    XorNodeUtils.assertIsNodeKind(xorNode, expectedNodeKinds);

    return xorNode;
}

export function assertLast(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    Assert.isTrue(ancestry.length > 0, "ancestry.length > 0");

    return assertNth(ancestry, ancestry.length - 1);
}

export function assertLastChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertNthChecked(ancestry, ancestry.length - 1, expectedNodeKinds);
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
    nodeKind: T["kind"],
): XorNode<T> | undefined {
    const node: TXorNode | undefined = ancestry.find((xorNode: TXorNode) => xorNode.node.kind === nodeKind);

    if (node === undefined || !XorNodeUtils.isNodeKind(node, nodeKind)) {
        return undefined;
    }

    return node;
}

export function indexOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): number | undefined {
    const index: number = ancestry.findIndex((xorNode: TXorNode) => XorNodeUtils.isNodeKind(xorNode, nodeKind));

    return index !== -1 ? index : undefined;
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
