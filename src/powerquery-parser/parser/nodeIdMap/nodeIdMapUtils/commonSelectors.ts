// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, MapUtils } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";
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

export function maybeWrappedContentAst(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: Ast.NodeKind,
): Ast.TNode | undefined {
    const maybeAst: TXorNode | undefined = maybeNthChildChecked(
        nodeIdMapCollection,
        wrapped.node.id,
        1,
        maybeChildNodeKind,
    );
    return maybeAst?.kind === XorNodeKind.Ast ? maybeAst.node : undefined;
}

export function maybeCsv(nodeIdMapCollection: Collection, csv: TXorNode): TXorNode | undefined {
    return maybeNthChild(nodeIdMapCollection, csv.node.id, 0);
}

export function maybeArrayWrapperContent(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    return maybeNthChildChecked(nodeIdMapCollection, wrapped.node.id, 1, Ast.NodeKind.ArrayWrapper);
}

export function maybeWrappedContent(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: Ast.NodeKind,
): TXorNode | undefined {
    return maybeNthChildChecked(nodeIdMapCollection, wrapped.node.id, 1, maybeChildNodeKind);
}
