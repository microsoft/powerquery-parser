// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext } from "..";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type TXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode> | IXorNode<XorNodeKind.Context, ParserContext.Node>;

export interface IXorNode<Kind, T> {
    readonly kind: Kind & XorNodeKind;
    readonly node: T;
}

export interface XorNodeTokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
}
