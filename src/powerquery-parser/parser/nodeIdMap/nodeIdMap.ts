// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Ast } from "../../language";

export type AstNodeById = NumberMap<Ast.TNode>;

export type ContextNodeById = NumberMap<ParseContext.Node>;

export type ParentIdById = NumberMap<number>;

export type ChildIdsById = NumberMap<ReadonlyArray<number>>;

export interface Collection {
    readonly astNodeById: AstNodeById;
    readonly contextNodeById: ContextNodeById;
    readonly parentIdById: ParentIdById;
    readonly childIdsById: ChildIdsById;
    readonly maybeRightMostLeaf: Ast.TNode | undefined;
}

type NumberMap<T> = Map<number, T>;
