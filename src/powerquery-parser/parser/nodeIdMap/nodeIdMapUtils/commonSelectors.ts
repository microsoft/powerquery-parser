// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, CommonError, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { TXorNode, XorNode } from "../xorNode";
import { maybeNthChild } from "./childSelectors";

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
        assertNodeKind(node.kind, maybeExpectedNodeKinds);
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
        assertNodeKind(node.kind, maybeExpectedNodeKinds);
    }

    return node;
}

export function maybeArrayWrapper(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
): XorNode<Ast.TArrayWrapper> | undefined {
    return maybeNthChild(nodeIdMapCollection, wrapped.node.id, 1, Ast.NodeKind.ArrayWrapper);
}

export function maybeWrappedContent<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    return maybeNthChild(nodeIdMapCollection, wrapped.node.id, 1, maybeExpectedNodeKinds);
}

export function maybeUnwrapWrappedContentIfAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): T | undefined {
    const maybeNode: TXorNode | undefined = maybeWrappedContent(nodeIdMapCollection, wrapped, maybeExpectedNodeKinds);
    if (maybeNode === undefined) {
        return maybeNode;
    }

    return XorNodeUtils.isAstXor<T>(maybeNode, /* already checked in maybeNthChild */ undefined)
        ? maybeNode.node
        : undefined;
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
    nodeKind: Ast.NodeKind,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): void {
    if (expectedNodeKinds !== undefined && nodeKind !== expectedNodeKinds && !expectedNodeKinds.includes(nodeKind)) {
        throw new CommonError.InvariantError(`either failed to find the given node or it was an invalid node kind`, {
            actualNodeKind: nodeKind,
            maybeExpectedNodeKinds: expectedNodeKinds,
        });
    }
}
