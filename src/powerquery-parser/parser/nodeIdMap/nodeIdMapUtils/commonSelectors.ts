// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, CommonError, MapUtils } from "../../../common";
import { Ast } from "../../../language";
import { ParseContext, ParseContextUtils } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { XorNode } from "../xorNode";

export function assertGetXor<T extends Ast.TNode>(nodeIdMapCollection: Collection, nodeId: number): XorNode<T> {
    return Assert.asDefined(maybeXor(nodeIdMapCollection, nodeId), undefined, { nodeId });
}

export function assertGetXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return Assert.asDefined(maybeXorChecked(nodeIdMapCollection, nodeId, expectedNodeKinds), undefined, { nodeId });
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

export function assertUnwrapContext(contextNodeById: ContextNodeById, nodeId: number): ParseContext.Node {
    const node: ParseContext.Node = Assert.asDefined(
        MapUtils.assertGet(contextNodeById, nodeId, "failed to find the given context node", { nodeId }),
    );

    return node;
}

export function assertUnwrapContextChecked<T extends Ast.TNode>(
    contextNodeById: ContextNodeById,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node {
    const contextNode: ParseContext.Node = assertUnwrapContext(contextNodeById, nodeId);
    ParseContextUtils.assertIsNodeKind(contextNode, expectedNodeKinds);
    return contextNode;
}

export function maybeXor<T extends Ast.TNode>(nodeIdMapCollection: Collection, nodeId: number): XorNode<T> | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode !== undefined) {
        return XorNodeUtils.createAstNode(maybeAstNode as T);
    }

    const maybeContextNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode !== undefined) {
        return XorNodeUtils.createContextNode(maybeContextNode);
    }

    return undefined;
}

export function maybeXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const maybeXorNode: XorNode<T> | undefined = maybeXor(nodeIdMapCollection, nodeId);
    if (maybeXorNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
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
