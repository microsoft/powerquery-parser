// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Ast } from "../../language";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type TXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode> | IXorNode<XorNodeKind.Context, ParseContext.Node>;

export interface IXorNode<Kind, T> {
    readonly kind: Kind & XorNodeKind;
    readonly node: T;
}

export interface XorNodeTokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
}
