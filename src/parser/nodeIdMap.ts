// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext } from ".";
import { CommonError, Option } from "../common";

export type AstNodeById = NumberMap<Ast.TNode>;

export type ContextNodeById = NumberMap<ParserContext.Node>;

export type ParentIdById = NumberMap<number>;

export type ChildIdsById = NumberMap<ReadonlyArray<number>>;

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

export function expectChildIds(
    childIdsById: Map<number, ReadonlyArray<number>>,
    nodeId: number,
): ReadonlyArray<number> {
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
