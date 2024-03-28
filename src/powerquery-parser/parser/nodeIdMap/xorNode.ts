// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { ParseContext } from "..";

export enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type TXorNode = XorNode<Ast.TNode>;

export type XorNode<T extends Ast.TNode> = AstXorNode<T> | ContextXorNode<T>;

export type TAstXorNode = AstXorNode<Ast.TNode>;

export type AstXorNode<T extends Ast.TNode> = IXorNode<XorNodeKind.Ast, T>;

export type TContextXorNode = ContextXorNode<Ast.TNode>;

export type ContextXorNode<T extends Ast.TNode> = IXorNode<XorNodeKind.Context, ParseContext.Node<T>>;

export interface IXorNode<Kind extends XorNodeKind, T> {
    readonly kind: Kind;
    readonly node: T;
}

export interface XorNodeTokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
}
