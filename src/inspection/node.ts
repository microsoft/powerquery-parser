// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option } from "../common";
import { TokenPosition } from "../lexer";

export const enum NodeKind {
    EachExpression = "EachExpression",
    InvokeExpression = "InvokeExpression",
    List = "List",
    Record = "Record",
}

export type TNode = EachExpression | InvokeExpression | List | Record;

export interface INode {
    readonly kind: NodeKind;
    readonly maybePositionStart: Option<TokenPosition>;
    readonly maybePositionEnd: Option<TokenPosition>;
}

export interface EachExpression extends INode {
    readonly kind: NodeKind.EachExpression;
}

export interface InvokeExpression extends INode {
    readonly kind: NodeKind.InvokeExpression;
}

export interface List extends INode {
    readonly kind: NodeKind.List;
}

export interface Record extends INode {
    readonly kind: NodeKind.Record;
}
