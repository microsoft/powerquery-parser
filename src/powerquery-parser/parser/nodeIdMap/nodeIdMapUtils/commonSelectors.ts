// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { ParseContext, ParseContextUtils } from "../../context";
import { TXorNode, XorNode } from "../xorNode";
import { XorNodeUtils } from "..";

export function assertGetXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(xor(nodeIdMapCollection, nodeId), undefined, { nodeId });
}

export function assertGetXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return Assert.asDefined(xorChecked(nodeIdMapCollection, nodeId, expectedNodeKinds), undefined, {
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

export function xor(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const astNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);

    if (astNode !== undefined) {
        return XorNodeUtils.boxAst(astNode);
    }

    const contextNode: ParseContext.TNode | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);

    if (contextNode !== undefined) {
        return XorNodeUtils.boxContext(contextNode);
    }

    return undefined;
}

export function xorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const xorNode: TXorNode | undefined = xor(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}

export function ast(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode | undefined {
    const xorNode: TXorNode | undefined = xor(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isAstXor(xorNode) ? xorNode.node : undefined;
}

export function astChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const xorNode: TXorNode | undefined = xor(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isAstXorChecked(xorNode, expectedNodeKinds) ? xorNode.node : undefined;
}

export function context(nodeIdMapCollection: Collection, nodeId: number): ParseContext.TNode | undefined {
    const xorNode: TXorNode | undefined = xor(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isContextXor(xorNode) ? xorNode.node : undefined;
}

export function contextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const xorNode: TXorNode | undefined = xorChecked(nodeIdMapCollection, nodeId, expectedNodeKinds);

    return xorNode && XorNodeUtils.isContextXorChecked(xorNode, expectedNodeKinds) ? xorNode.node : undefined;
}
