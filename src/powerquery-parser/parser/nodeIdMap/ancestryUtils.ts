// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { Assert } from "../../common";
import { Ast } from "../../language";
import { TXorNode, XorNode } from "./xorNode";

export function assertGetAncestry(nodeIdMapCollection: NodeIdMap.Collection, rootId: number): ReadonlyArray<TXorNode> {
    const ancestryIds: number[] = [rootId];

    let maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(rootId);
    while (maybeParentId) {
        const parentId: number = maybeParentId;
        ancestryIds.push(parentId);
        maybeParentId = nodeIdMapCollection.parentIdById.get(parentId);
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
    return Assert.asDefined(maybeNthXor(ancestry, ancestryIndex), "ancestryIndex is out of bounds", {
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

export function maybeNthXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return ancestry[ancestryIndex];
}

export function maybeNthXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const maybeXorNode: TXorNode | undefined = maybeNthXor(ancestry, ancestryIndex);
    return maybeXorNode && XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
}

export function maybeNextXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex + 1);
}

export function maybeNextXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return maybeNthXorChecked(ancestry, ancestryIndex + 1, expectedNodeKinds);
}

export function maybePreviousXor(ancestry: ReadonlyArray<TXorNode>, ancestryIndex: number): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex - 1);
}

export function maybePreviousXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return maybeNthXorChecked(ancestry, ancestryIndex - 1, expectedNodeKinds);
}

export function maybeNthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex + offset);
}

export function maybeNthNextXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return maybeNthXorChecked(ancestry, ancestryIndex + offset, expectedNodeKinds);
}

export function maybeNthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex - offset);
}

export function maybeNthPreviousXorChecked<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    return maybeNthXorChecked(ancestry, ancestryIndex - offset, expectedNodeKinds);
}

export function maybeFirstXorOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): XorNode<T> | undefined {
    const maybeNode: TXorNode | undefined = ancestry.find((xorNode: TXorNode) => xorNode.node.kind === nodeKind);
    if (maybeNode === undefined || !XorNodeUtils.isNodeKind(maybeNode, nodeKind)) {
        return undefined;
    }

    return maybeNode;
}

export function maybeFirstIndexOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): number | undefined {
    const maybeIndex: number = ancestry.findIndex((xorNode: TXorNode) => XorNodeUtils.isNodeKind(xorNode, nodeKind));
    return maybeIndex !== -1 ? maybeIndex : undefined;
}

export function maybeFirstXorAndIndexOfNodeKind<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: T["kind"],
): [XorNode<T>, number] | undefined {
    const maybeIndex: number | undefined = maybeFirstIndexOfNodeKind(ancestry, nodeKind);
    return maybeIndex !== undefined
        ? [XorNodeUtils.assertAsNodeKind(Assert.asDefined(ancestry[maybeIndex]), nodeKind), maybeIndex]
        : undefined;
}
