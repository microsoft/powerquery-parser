// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { Assert, CommonError } from "../../common";
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

export function assertGetLeaf<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    return assertGetNthXor(ancestry, 0, expectedNodeKinds);
}

export function assertGetRoot<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    Assert.isTrue(ancestry.length > 0, "ancestry.length > 0");
    return assertGetNthXor(ancestry, ancestry.length - 1, expectedNodeKinds);
}

export function assertGetNextXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    return assertGetNthXor(ancestry, ancestryIndex + 1, expectedNodeKinds);
}

export function assertGetPreviousXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    return assertGetNthXor(ancestry, ancestryIndex - 1, expectedNodeKinds);
}

export function assertGetNthNextXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    return assertGetNthXor(ancestry, ancestryIndex + offset, expectedNodeKinds);
}

export function assertGetNthPreviousXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    return assertGetNthXor(ancestry, ancestryIndex - offset, expectedNodeKinds);
}

export function assertGetNthXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    const maybeXorNode: XorNode<T> | undefined = maybeNthXor(ancestry, ancestryIndex, expectedNodeKinds);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError(`couldn't find the nth node or it had the incorrect node type`, {
            ancestryIndex,
            expectedNodeKinds,
            leafNodeId: assertGetLeaf(ancestry, undefined).node.id,
        });
    }

    return maybeXorNode;
}

export function maybeNthXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    const maybeNode: TXorNode | undefined = ancestry[ancestryIndex];
    if (maybeNode === undefined || (expectedNodeKinds && !XorNodeUtils.isNodeKind(maybeNode, expectedNodeKinds))) {
        return undefined;
    }

    return maybeNode as XorNode<T>;
}

export function maybeNextXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    return maybeNthXor(ancestry, ancestryIndex + 1, expectedNodeKinds);
}

export function maybePreviousXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    return maybeNthXor(ancestry, ancestryIndex - 1, expectedNodeKinds);
}

export function maybeNthNextXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    return maybeNthXor(ancestry, ancestryIndex + offset, expectedNodeKinds);
}

export function maybeNthPreviousXor<T extends Ast.TNode>(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    expectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    return maybeNthXor(ancestry, ancestryIndex - offset, expectedNodeKinds);
}

export function maybeFirstXorAndIndexWhere(
    ancestry: ReadonlyArray<TXorNode>,
    predicateFn: (xorNode: TXorNode) => boolean,
): [TXorNode, number] | undefined {
    const numNodes: number = ancestry.length;
    for (let index: number = 0; index < numNodes; index += 1) {
        const xorNode: TXorNode = ancestry[index];
        if (predicateFn(xorNode)) {
            return [xorNode, index];
        }
    }

    return undefined;
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

export function maybeFirstIndexOfNodeKind(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: Ast.NodeKind,
): number | undefined {
    const maybeIndex: number = ancestry.findIndex((xorNode: TXorNode) => xorNode.node.kind === nodeKind);
    return maybeIndex !== -1 ? maybeIndex : undefined;
}

export function maybeFirstXorAndIndexOfNodeKind(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: Ast.NodeKind,
): [TXorNode, number] | undefined {
    return maybeFirstXorAndIndexWhere(ancestry, (xorNode: TXorNode) => xorNode.node.kind === nodeKind);
}
