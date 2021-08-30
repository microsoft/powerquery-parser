// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext, ParseContextUtils } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { TXorNode, XorNode } from "../xorNode";

export function assertGetXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(maybeXor(nodeIdMapCollection, nodeId), undefined, { nodeId });
}

export function assertGetXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return Assert.asDefined(maybeXorChecked(nodeIdMapCollection, nodeId, expectedNodeKinds), undefined, {
        nodeId,
        expectedNodeKinds,
    });
}

export function assertUnboxAst(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    const node: Ast.TNode = Assert.asDefined(
        MapUtils.assertGet(astNodeById, nodeId, "failed to find the given ast node", { nodeId }),
    );

    return node;
}

export function assertUnboxAstChecked<T extends Ast.TNode>(
    astNodeById: AstNodeById,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    const astNode: Ast.TNode = assertUnboxAst(astNodeById, nodeId);
    AstUtils.assertIsNodeKind(astNode, expectedNodeKinds);
    return astNode;
}

export function assertUnboxContext(contextNodeById: ContextNodeById, nodeId: number): ParseContext.TNode {
    const node: ParseContext.TNode = Assert.asDefined(
        MapUtils.assertGet(contextNodeById, nodeId, "failed to find the given context node", { nodeId }),
    );

    return node;
}

export function assertUnboxContextChecked<T extends Ast.TNode>(
    contextNodeById: ContextNodeById,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    const contextNode: ParseContext.TNode = assertUnboxContext(contextNodeById, nodeId);
    ParseContextUtils.assertIsNodeKind(contextNode, expectedNodeKinds);
    return contextNode;
}

export function maybeXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode !== undefined) {
        return XorNodeUtils.boxAst(maybeAstNode);
    }

    const maybeContextNode: ParseContext.TNode | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode !== undefined) {
        return XorNodeUtils.boxContext(maybeContextNode);
    }

    return undefined;
}

export function maybeXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const maybeXorNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);
    return maybeXorNode && XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
}
