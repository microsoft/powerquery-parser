// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapUtils } from ".";
import { Ast } from "..";
import { CommonError } from "../../common";
import { TXorNode } from "./xorNode";

export function expectPreviousXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybePreviousXorNode(ancestry, ancestryIndex, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no previous node");
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

export function maybePreviousXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeXorNode: TXorNode | undefined = ancestry[ancestryIndex - n];
    if (maybeXorNode !== undefined && maybeNodeKinds !== undefined) {
        return maybeNodeKinds.indexOf(maybeXorNode.node.kind) !== -1 ? maybeXorNode : undefined;
    } else {
        return maybeXorNode;
    }
}

export function expectNextXorNode(
    ancestry: ReadonlyArray<TXorNode>,
    ancestryIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeXorNode: TXorNode | undefined = maybeNextXorNode(ancestry, ancestryIndex, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no next node");
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

export function maybeNextXorNode(
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
