// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils } from "../../../language";
import { ParseContext, ParseContextUtils } from "../../context";
import { TXorNode, XorNode } from "../xorNode";
import { Assert } from "../../../common";
import { Collection } from "../nodeIdMap";
import { XorNodeUtils } from "..";

export function assertXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(xor(nodeIdMapCollection, nodeId), "failed to find the expected node", { nodeId });
}

export function assertXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return XorNodeUtils.assertAsNodeKind<T>(assertXor(nodeIdMapCollection, nodeId), expectedNodeKinds);
}

export function assertAst(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode {
    return Assert.asDefined(ast(nodeIdMapCollection, nodeId), "failed to find the expected Ast node", {
        nodeId,
    });
}

export function assertAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    return AstUtils.assertAsNodeKind(assertAst(nodeIdMapCollection, nodeId), expectedNodeKinds);
}

export function assertContext(nodeIdMapCollection: Collection, nodeId: number): ParseContext.TNode {
    return Assert.asDefined(context(nodeIdMapCollection, nodeId), "failed to find the expected Context node", {
        nodeId,
    });
}

export function assertContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    return ParseContextUtils.assertAsNodeKind(assertContext(nodeIdMapCollection, nodeId), expectedNodeKinds);
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
    const astNode: Ast.TNode | undefined = ast(nodeIdMapCollection, nodeId);

    return astNode && AstUtils.isNodeKind(astNode, expectedNodeKinds) ? astNode : undefined;
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
    const contextNode: ParseContext.TNode | undefined = context(nodeIdMapCollection, nodeId);

    return contextNode && ParseContextUtils.isNodeKind(contextNode, expectedNodeKinds) ? contextNode : undefined;
}
