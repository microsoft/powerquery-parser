// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext } from ".";
import { CommonError, Option } from "../common";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type AstNodeById = NumberMap<Ast.TNode>;

export type ContextNodeById = NumberMap<ParserContext.Node>;

export type ParentIdById = NumberMap<number>;

export type ChildIdsById = NumberMap<ReadonlyArray<number>>;

export type TXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode> | IXorNode<XorNodeKind.Context, ParserContext.Node>;

export interface IXorNode<Kind, T> {
    readonly xorKind: Kind & XorNodeKind;
    readonly nodeKind: Ast.NodeKind;
    readonly node: T;
}

export interface Collection {
    readonly astNodeById: AstNodeById;
    readonly contextNodeById: ContextNodeById;
    readonly parentIdById: ParentIdById;
    readonly childIdsById: ChildIdsById;
}

export function expectAstNode(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return expectInMap<Ast.TNode>(astNodeById, nodeId, "astNodeById");
}

export function expectContextNode(contextNodeById: ContextNodeById, nodeId: number): ParserContext.Node {
    return expectInMap<ParserContext.Node>(contextNodeById, nodeId, "contextNodeById");
}

export function maybeXorNode(nodeIdMapCollection: Collection, nodeId: number): Option<TXorNode> {
    const maybeAstNode: Option<Ast.TNode> = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode) {
        const astNode: Ast.TNode = maybeAstNode;
        return {
            xorKind: XorNodeKind.Ast,
            nodeKind: astNode.kind,
            node: astNode,
        };
    }

    const maybeContextNode: Option<ParserContext.Node> = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode) {
        const contextNode: ParserContext.Node = maybeContextNode;
        return {
            xorKind: XorNodeKind.Context,
            nodeKind: contextNode.kind,
            node: contextNode,
        };
    }

    return undefined;
}

export function expectXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: Option<TXorNode> = maybeXorNode(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't a astNode nor contextNode`, details);
    }

    return maybeNode;
}

export function expectXorNodes(
    nodeIdMapCollection: Collection,
    nodeIds: ReadonlyArray<number>,
): ReadonlyArray<TXorNode> {
    return nodeIds.map(nodeId => expectXorNode(nodeIdMapCollection, nodeId));
}

export function expectChildIds(childIdsById: ChildIdsById, nodeId: number): ReadonlyArray<number> {
    return expectInMap<ReadonlyArray<number>>(childIdsById, nodeId, "childIdsById");
}

export function deepCopyCollection(nodeIdMapCollection: Collection): Collection {
    const contextNodeById: ContextNodeById = new Map<number, ParserContext.Node>();
    nodeIdMapCollection.contextNodeById.forEach((value: ParserContext.Node, key: number) => {
        contextNodeById.set(key, { ...value });
    });
    return {
        astNodeById: new Map(nodeIdMapCollection.astNodeById.entries()),
        contextNodeById: contextNodeById,
        childIdsById: new Map(nodeIdMapCollection.childIdsById.entries()),
        parentIdById: new Map(nodeIdMapCollection.parentIdById.entries()),
    };
}

type NumberMap<T> = Map<number, T>;

function expectInMap<T>(map: Map<number, T>, nodeId: number, mapName: string): T {
    const maybeValue: Option<T> = map.get(nodeId);
    if (maybeValue === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't in ${mapName}`, details);
    }
    return maybeValue;
}
