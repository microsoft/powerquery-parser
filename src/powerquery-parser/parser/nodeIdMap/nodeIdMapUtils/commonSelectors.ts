// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { AstXorNode, TXorNode, XorNode } from "../xorNode";
import { maybeNthChild, maybeNthChildChecked } from "./childSelectors";

export function assertUnwrapAst(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return MapUtils.assertGet(astNodeById, nodeId);
}

export function assertUnwrapAstChecked<T extends Ast.TNode>(
    astNodeById: AstNodeById,
    nodeId: number,
    nodeKind: T["kind"],
): Ast.TNode {
    const ast: Ast.TNode = MapUtils.assertGet(astNodeById, nodeId);
    AstUtils.assertHasNodeKind(ast, nodeKind);
    return ast;
}

export function assertUnwrapContext(contextNodeById: ContextNodeById, nodeId: number): ParseContext.Node {
    return MapUtils.assertGet(contextNodeById, nodeId);
}

export function assertGetXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(maybeXor(nodeIdMapCollection, nodeId), undefined, { nodeId });
}

export function assertGetXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKind: T["kind"],
): XorNode<T> {
    return Assert.asDefined(maybeXorChecked(nodeIdMapCollection, nodeId, expectedNodeKind), undefined, { nodeId });
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
    const maybeNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isXorChecked<T>(maybeNode, expectedNodeKind) ? maybeNode : undefined;
}

export function maybeWrappedContentAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    expectedNodeKind: T["kind"],
): AstXorNode<T> | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChildChecked(
        nodeIdMapCollection,
        wrapped.node.id,
        1,
        expectedNodeKind,
    );
    if (maybeNode === undefined) {
        return maybeNode;
    }

    return XorNodeUtils.isAstXorChecked(maybeNode, expectedNodeKind) ? maybeNode : undefined;
}

export function maybeCsv(nodeIdMapCollection: Collection, csv: TXorNode): TXorNode | undefined {
    return maybeNthChild(nodeIdMapCollection, csv.node.id, 0);
}

export function maybeArrayWrapperContent(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    return maybeNthChildChecked(nodeIdMapCollection, wrapped.node.id, 1, Ast.NodeKind.ArrayWrapper);
}

export function maybeWrappedContent<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: T["kind"],
): XorNode<T> | undefined {
    return maybeNthChildChecked(nodeIdMapCollection, wrapped.node.id, 1, maybeChildNodeKind);
}
