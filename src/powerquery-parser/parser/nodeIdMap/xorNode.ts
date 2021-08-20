// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Ast } from "../../language";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type TXorNode = XorNode<Ast.TNode>;

export type TAstXorNode = AstXorNode<Ast.TNode>;

export type XorNode<T extends Ast.TNode> = AstXorNode<T> | ContextXorNode;

export type AstXorNode<T extends Ast.TNode> = IXorNode<XorNodeKind.Ast, T>;

export type ContextXorNode = IXorNode<XorNodeKind.Context, ParseContext.Node>;

export interface IXorNode<Kind extends XorNodeKind, T> {
    readonly kind: Kind;
    readonly node: T;
}

export interface XorNodeTokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
}
