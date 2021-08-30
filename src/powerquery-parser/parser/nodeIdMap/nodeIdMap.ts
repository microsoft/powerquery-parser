// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Ast } from "../../language";

export type AstNodeById = NumberMap<Ast.TNode>;
export type ChildIdsById = NumberMap<ReadonlyArray<number>>;
export type ContextNodeById = NumberMap<ParseContext.TNode>;
export type IdsByNodeKind = Map<Ast.NodeKind, Set<number>>;
export type ParentIdById = NumberMap<number>;

export interface Collection {
    // Ast.TNode variant of TXorNode
    readonly astNodeById: AstNodeById;
    // ParseContext.Node variant of TXorNode
    readonly contextNodeById: ContextNodeById;

    // Mapping of a node to its children. Unlike the other maps this cannot be a Set.
    // It must be a Readonly array which maintains the order that the node's children were parsed.
    readonly childIdsById: ChildIdsById;
    readonly idsByNodeKind: IdsByNodeKind;
    // A set of all leaf node ids..
    readonly leafIds: Set<number>;
    // Mappings from a node to its parent.
    readonly parentIdById: ParentIdById;

    // The right most Ast in the parse context, which under normal circumstances is the most recently parsed node.
    readonly maybeRightMostLeaf: Ast.TNode | undefined;
}

type NumberMap<T> = Map<number, T>;
