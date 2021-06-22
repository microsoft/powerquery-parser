// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator } from ".";
import { Assert, CommonError } from "../../common";
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
    return Assert.asDefined(ancestry[0], "ancestry[0]");
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
    return assertGetNthXor(ancestry, ancestryIndex + 1, maybeAllowedNodeKinds);
}

export function assertGetPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex - 1, maybeAllowedNodeKinds);
}

export function assertGetNthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex + offset, maybeAllowedNodeKinds);
}

export function assertGetNthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    return assertGetNthXor(ancestry, ancestryIndex - offset, maybeAllowedNodeKinds);
}

export function assertGetNthXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybeNthXor(ancestry, ancestryIndex, undefined);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError(`the given ancestryIndex is out of bounds`, { ancestryIndex });
    } else if (maybeAllowedNodeKinds !== undefined && !maybeAllowedNodeKinds.includes(maybeXorNode.node.kind)) {
        throw new CommonError.InvariantError(
            `a XorNode was found at the given ancestryIndex but it was the wrong NodeKind`,
            {
                ancestryIndex,
                nodeId: maybeXorNode.node.id,
                nodeKind: maybeXorNode.node.kind,
                allowedNodeKinds: maybeAllowedNodeKinds,
            },
        );
    } else {
        return maybeXorNode;
    }
}

export function maybeNthXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeXorNode: TXorNode | undefined = ancestry[ancestryIndex];
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
    return maybeNthXor(ancestry, ancestryIndex + 1, maybeAllowedNodeKinds);
}

export function maybePreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex - 1, maybeAllowedNodeKinds);
}

export function maybeNthNextXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex + offset, maybeAllowedNodeKinds);
}

export function maybeNthPreviousXor(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    offset: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    return maybeNthXor(ancestry, ancestryIndex - offset, maybeAllowedNodeKinds);
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
