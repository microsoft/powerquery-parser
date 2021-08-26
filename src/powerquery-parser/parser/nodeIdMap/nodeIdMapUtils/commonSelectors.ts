// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, CommonError, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { XorNode } from "../xorNode";

export function assertGetXor<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> {
    return Assert.asDefined(maybeXor(nodeIdMapCollection, nodeId, maybeExpectedNodeKinds), undefined, { nodeId });
}

export function assertUnwrapAst<T extends Ast.TNode>(
    astNodeById: AstNodeById,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): Ast.TNode {
    const node: Ast.TNode = Assert.asDefined(
        MapUtils.assertGet(astNodeById, nodeId, "failed to find the given ast node", { nodeId }),
    );

    if (maybeExpectedNodeKinds !== undefined) {
        assertNodeKind(nodeId, node.kind, maybeExpectedNodeKinds);
    }

    return node;
}

export function assertUnwrapContext<T extends Ast.TNode>(
    contextNodeById: ContextNodeById,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): ParseContext.Node {
    const node: ParseContext.Node = Assert.asDefined(
        MapUtils.assertGet(contextNodeById, nodeId, "failed to find the given context node", { nodeId }),
    );

    if (maybeExpectedNodeKinds !== undefined) {
        assertNodeKind(nodeId, node.kind, maybeExpectedNodeKinds);
    }

    return node;
}

export function maybeXor<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode !== undefined) {
        return !maybeExpectedNodeKinds || AstUtils.isNodeKind(maybeAstNode, maybeExpectedNodeKinds)
            ? XorNodeUtils.createAstNode(maybeAstNode as T)
            : undefined;
    }

    const maybeContextNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode !== undefined) {
        return !maybeExpectedNodeKinds ||
            maybeContextNode.kind === maybeExpectedNodeKinds ||
            maybeExpectedNodeKinds.includes(maybeContextNode.kind)
            ? XorNodeUtils.createContextNode(maybeContextNode)
            : undefined;
    }

    return undefined;
}

function assertNodeKind<T extends Ast.TNode>(
    nodeId: number,
    nodeKind: Ast.NodeKind,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): void {
    if (expectedNodeKinds !== undefined && nodeKind !== expectedNodeKinds && !expectedNodeKinds.includes(nodeKind)) {
        throw new CommonError.InvariantError(`found the node but it was an invalid node kind`, {
            nodeId,
            nodeKind,
            maybeExpectedNodeKinds: expectedNodeKinds,
        });
    }
}
