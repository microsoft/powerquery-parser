// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Ast } from "../../language";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type TXorNode = AstXorNode | ContextXorNode;

export type AstXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode>;

export type ContextXorNode = IXorNode<XorNodeKind.Context, ParseContext.Node>;

export interface IXorNode<Kind extends XorNodeKind, T> {
    readonly kind: Kind;
    readonly node: T;
}

export interface XorNodeTokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
}
