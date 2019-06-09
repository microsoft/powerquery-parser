// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext } from ".";

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
