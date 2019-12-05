// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext } from "..";

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
    readonly kind: Kind & XorNodeKind;
    readonly node: T;
}

export interface Collection {
    readonly astNodeById: AstNodeById;
    readonly contextNodeById: ContextNodeById;
    readonly parentIdById: ParentIdById;
    readonly childIdsById: ChildIdsById;
}

type NumberMap<T> = Map<number, T>;
