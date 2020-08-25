// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, MapUtils } from "../../../common";
import { Ast } from "../../../language";
import { ParseContext } from "../../context";
import { AstNodeById, Collection, ContextNodeById } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";
import { maybeChildXorByAttributeIndex } from "./childSelectors";

export function assertAst(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return MapUtils.assertGet(astNodeById, nodeId);
}

export function assertContext(contextNodeById: ContextNodeById, nodeId: number): ParseContext.Node {
    return MapUtils.assertGet(contextNodeById, nodeId);
}

export function assertXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);
    Assert.isDefined(maybeNode, undefined, { nodeId });

    return maybeNode;
}

export function maybeXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode) {
        return XorNodeUtils.astFactory(maybeAstNode);
    }

    const maybeContextNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode) {
        return XorNodeUtils.contextFactory(maybeContextNode);
    }

    return undefined;
}

export function maybeWrappedContentAst(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: Ast.NodeKind,
): Ast.TNode | undefined {
    const maybeAst: TXorNode | undefined = maybeChildXorByAttributeIndex(nodeIdMapCollection, wrapped.node.id, 1, [
        maybeChildNodeKind,
    ]);
    return maybeAst?.kind === XorNodeKind.Ast ? maybeAst.node : undefined;
}

export function maybeCsv(nodeIdMapCollection: Collection, csv: TXorNode): TXorNode | undefined {
    return maybeChildXorByAttributeIndex(nodeIdMapCollection, csv.node.id, 0, undefined);
}

export function maybeArrayWrapperContent(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    return maybeChildXorByAttributeIndex(nodeIdMapCollection, wrapped.node.id, 1, [Ast.NodeKind.ArrayWrapper]);
}

export function maybeWrappedContent(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: Ast.NodeKind,
): TXorNode | undefined {
    return maybeChildXorByAttributeIndex(nodeIdMapCollection, wrapped.node.id, 1, [maybeChildNodeKind]);
}
