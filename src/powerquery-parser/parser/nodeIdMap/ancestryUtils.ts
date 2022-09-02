// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { TXorNode, XorNode } from "./xorNode";
import { Assert } from "../../common";
import { Ast } from "../../language";

// Builds up an TXorNode path starting from nodeId and goes up to the root of the Ast.
export function assertGetAncestry(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): ReadonlyArray<TXorNode> {
    const ancestryIds: number[] = [nodeId];

    let parentId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);

    while (parentId) {
        ancestryIds.push(parentId);
        parentId = nodeIdMapCollection.parentIdById.get(parentId);
    }

    return NodeIdMapIterator.assertIterXor(nodeIdMapCollection, ancestryIds);
}

export function assertGetLeaf(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    return assertGetNthXor(ancestry, 0);
}

export function assertGetLeafChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    const xorNode: TXorNode = assertGetLeaf(ancestry);
    XorNodeUtils.assertIsNodeKind(xorNode, expectedNodeKinds);

    return xorNode;
}

export function assertGetRoot(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    Assert.isTrue(ancestry.length > 0, "ancestry.length > 0");

    return assertGetNthXor(ancestry, ancestry.length - 1);
}

export function assertGetRootChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertGetNthXorChecked(ancestry, ancestry.length - 1, expectedNodeKinds);
}

export function assertGetNextXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex + 1);
}

export function assertGetNextXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertGetNthXorChecked(ancestry, ancestryIndex + 1, expectedNodeKinds);
}

export function assertGetPreviousXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex - 1);
}

export function assertGetPreviousXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertGetNthXorChecked(ancestry, ancestryIndex - 1, expectedNodeKinds);
}

export function assertGetNthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex + offset);
}

export function assertGetNthNextXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertGetNthXorChecked(ancestry, ancestryIndex + offset, expectedNodeKinds);
}

export function assertGetNthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex - offset);
}

export function assertGetNthPreviousXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertGetNthXorChecked(ancestry, ancestryIndex - offset, expectedNodeKinds);
}

export function assertGetNthXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode {
    return Assert.asDefined(nthXor(ancestry, ancestryIndex), "ancestryIndex is out of bounds", {
        ancestryLength: ancestry.length,
        ancestryIndex,
    });
}

export function assertGetNthXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return assertGetNthXorChecked(ancestry, ancestryIndex, expectedNodeKinds);
}

export function nthXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return ancestry[ancestryIndex];
}

export function nthXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const xorNode: TXorNode | undefined = nthXor(ancestry, ancestryIndex);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}

export function nextXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return nthXor(ancestry, ancestryIndex + 1);
}

export function nextXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return nthXorChecked(ancestry, ancestryIndex + 1, expectedNodeKinds);
}

export function previousXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return nthXor(ancestry, ancestryIndex - 1);
}

export function previousXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return nthXorChecked(ancestry, ancestryIndex - 1, expectedNodeKinds);
}

export function nthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
): TXorNode | undefined {
    return nthXor(ancestry, ancestryIndex + offset);
}

export function nthNextXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return nthXorChecked(ancestry, ancestryIndex + offset, expectedNodeKinds);
}

export function nthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
): TXorNode | undefined {
    return nthXor(ancestry, ancestryIndex - offset);
}

export function nthPreviousXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return nthXorChecked(ancestry, ancestryIndex - offset, expectedNodeKinds);
}

export function findXorOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): XorNode<T> | undefined {
    const node: TXorNode | undefined = ancestry.find((xorNode: TXorNode) => xorNode.node.kind === nodeKind);

    if (node === undefined || !XorNodeUtils.isNodeKind(node, nodeKind)) {
        return undefined;
    }

    return node;
}

export function findIndexOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): number | undefined {
    const index: number = ancestry.findIndex((xorNode: TXorNode) => XorNodeUtils.isNodeKind(xorNode, nodeKind));

    return index !== -1 ? index : undefined;
}

export function findXorAndIndexOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): [XorNode<T>, number] | undefined {
    const index: number | undefined = findIndexOfNodeKind(ancestry, nodeKind);

    return index !== undefined
        ? [XorNodeUtils.assertAsNodeKind(Assert.asDefined(ancestry[index]), nodeKind), index]
        : undefined;
}
