// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { TXorNode, XorNode } from "../xorNode";
import { maybeNthChild, maybeNthChildChecked } from "./childSelectors";

export function assertGetXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(maybeXor(nodeIdMapCollection, nodeId), undefined, { nodeId });
}

export function assertGetXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKind: T["kind"],
): XorNode<T> {
    return assertGetXorCheckedMany(nodeIdMapCollection, nodeId, [expectedNodeKind]);
}

export function assertGetXorCheckedMany<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]>,
): XorNode<T> {
    return Assert.asDefined(maybeXorCheckedMany(nodeIdMapCollection, nodeId, expectedNodeKinds), undefined, { nodeId });
}

export function assertAst(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return MapUtils.assertGet(astNodeById, nodeId);
}

export function assertAstChecked<T extends Ast.TNode>(
    astNodeById: AstNodeById,
    nodeId: number,
    expectedNodeKind: T["kind"],
): T {
    return assertAstCheckedMany(astNodeById, nodeId, [expectedNodeKind]);
}

export function assertAstCheckedMany<T extends Ast.TNode>(
    astNodeById: AstNodeById,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]>,
): T {
    const ast: Ast.TNode = assertAst(astNodeById, nodeId);
    AstUtils.assertHasAnyNodeKind(ast, expectedNodeKinds);
    return ast;
}

export function assertContext(contextNodeById: ContextNodeById, nodeId: number): ParseContext.Node {
    return MapUtils.assertGet(contextNodeById, nodeId);
}

export function maybeArrayWrapper(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
): XorNode<Ast.TArrayWrapper> | undefined {
    return maybeNthChildChecked(nodeIdMapCollection, wrapped.node.id, 1, Ast.NodeKind.ArrayWrapper);
}

export function maybeWrappedContent(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    return maybeNthChild(nodeIdMapCollection, wrapped.node.id, 1);
}

export function maybeWrappedContentChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    expectedNodeKind: T["kind"],
): XorNode<T> | undefined {
    return maybeNthChildChecked(nodeIdMapCollection, wrapped.node.id, 1, expectedNodeKind);
}

export function maybeWrappedContentIfAst(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, wrapped.node.id, 1);
    if (maybeNode === undefined) {
        return maybeNode;
    }

    return XorNodeUtils.isAstXor(maybeNode) ? maybeNode : undefined;
}

export function maybeWrappedContentIfAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    expectedNodeKind: T["kind"],
): T | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChildChecked(
        nodeIdMapCollection,
        wrapped.node.id,
        1,
        expectedNodeKind,
    );
    if (maybeNode === undefined) {
        return maybeNode;
    }

    return XorNodeUtils.isAstXorChecked(maybeNode, expectedNodeKind) ? maybeNode.node : undefined;
}

export function maybeXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode) {
        return XorNodeUtils.createAstNode(maybeAstNode);
    }

    const maybeContextNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode) {
        return XorNodeUtils.createContextNode(maybeContextNode);
    }

    return undefined;
}

export function maybeXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKind: T["kind"],
): XorNode<T> | undefined {
    return maybeXorCheckedMany(nodeIdMapCollection, nodeId, [expectedNodeKind]);
}

export function maybeXorCheckedMany<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]>,
): XorNode<T> | undefined {
    const maybeNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isXorCheckedMany(maybeNode, expectedNodeKinds) ? maybeNode : undefined;
}
