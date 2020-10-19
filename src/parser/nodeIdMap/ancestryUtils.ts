// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { Assert } from "../../common";
import { Ast } from "../../language";
import { TXorNode } from "./xorNode";

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
    const maybeLeaf: TXorNode | undefined = ancestry[0];
    Assert.isDefined(maybeLeaf);
    return maybeLeaf;
}

export function assertGetRoot(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    Assert.isTrue(ancestry.length > 0, "ancestry.length > 0");
    return ancestry[ancestry.length - 1];
}

export function assertGetNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    return assertGetNthNextXor(ancestry, ancestryIndex, 1, maybeAllowedNodeKinds);
}

export function assertGetNthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybeNthNextXor(ancestry, ancestryIndex, n, maybeAllowedNodeKinds);
    Assert.isDefined(maybeXorNode, `no next node`, { ancestryIndex, n });

    return maybeXorNode;
}

export function assertGetNthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybeNthPreviousXor(ancestry, ancestryIndex, n);
    Assert.isDefined(maybeXorNode, `no previous node`, { ancestryIndex, n });

    if (maybeAllowedNodeKinds !== undefined) {
        XorNodeUtils.assertAnyAstNodeKind(maybeXorNode, maybeAllowedNodeKinds);
    }

    return maybeXorNode;
}

export function assertGetPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    return assertGetNthPreviousXor(ancestry, ancestryIndex, 1, maybeAllowedNodeKinds);
}

export function maybeNthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeXorNode: TXorNode | undefined = ancestry[ancestryIndex - n];
    if (maybeXorNode !== undefined && maybeAllowedNodeKinds !== undefined) {
        return maybeAllowedNodeKinds.includes(maybeXorNode.node.kind) ? maybeXorNode : undefined;
    }

    return maybeXorNode;
}

export function maybeNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    return maybeNthNextXor(ancestry, ancestryIndex, 1, maybeAllowedNodeKinds);
}

export function maybeNthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeXorNode: TXorNode | undefined = ancestry[ancestryIndex + n];
    if (maybeXorNode !== undefined && maybeAllowedNodeKinds !== undefined) {
        return maybeAllowedNodeKinds.includes(maybeXorNode.node.kind) ? maybeXorNode : undefined;
    }

    return maybeXorNode;
}

export function maybePreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    return maybeNthPreviousXor(ancestry, ancestryIndex, 1, maybeAllowedNodeKinds);
}

export function maybeFirstXorWhere(
    ancestry: ReadonlyArray<TXorNode>,
    predicateFn: (xorNode: TXorNode, index?: number, array?: ReadonlyArray<TXorNode>) => boolean,
): TXorNode | undefined {
    return ancestry.find(predicateFn);
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

export function maybeFirstXorOfNodeKind(
    ancestry: ReadonlyArray<TXorNode>,
    nodeKind: Ast.NodeKind,
): TXorNode | undefined {
    return maybeFirstXorWhere(ancestry, (xorNode: TXorNode) => xorNode.node.kind === nodeKind);
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
