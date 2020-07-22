// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils } from ".";
import { CommonError } from "../../common";
import { Ast } from "../../language";
import { TXorNode } from "./xorNode";

export function expectAncestry(nodeIdMapCollection: NodeIdMap.Collection, rootId: number): ReadonlyArray<TXorNode> {
    const ancestryIds: number[] = [rootId];

    let maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(rootId);
    while (maybeParentId) {
        const parentId: number = maybeParentId;
        ancestryIds.push(parentId);
        maybeParentId = nodeIdMapCollection.parentIdById.get(parentId);
    }

    return NodeIdMapIterator.expectXorNodes(nodeIdMapCollection, ancestryIds);
}

export function expectNthPreviousXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybeNthPreviousXorNode(ancestry, ancestryIndex, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError(`no previous node`);
    }
    const xorNode: TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined) {
        const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstAnyNodeKind(
            xorNode,
            maybeAllowedNodeKinds,
        );
        if (maybeErr) {
            throw maybeErr;
        }
    }

    return maybeXorNode;
}

export function maybeNthPreviousXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeXorNode: TXorNode | undefined = ancestry[ancestryIndex - n];
    if (maybeXorNode !== undefined && maybeAllowedNodeKinds !== undefined) {
        return maybeAllowedNodeKinds.indexOf(maybeXorNode.node.kind) !== -1 ? maybeXorNode : undefined;
    } else {
        return maybeXorNode;
    }
}

export function expectNthNextXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybeNthNextXorNode(ancestry, ancestryIndex, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError(`no next node`);
    }
    const xorNode: TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined) {
        const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstAnyNodeKind(
            xorNode,
            maybeAllowedNodeKinds,
        );
        if (maybeErr) {
            throw maybeErr;
        }
    }

    return maybeXorNode;
}

export function maybeNthNextXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
): TXorNode | undefined {
    return ancestry[ancestryIndex + n];
}

export function expectRoot(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    return ancestry[ancestry.length - 1];
}

export function expectLeaf(ancestry: ReadonlyArray<TXorNode>): TXorNode {
    return ancestry[0];
}
