// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { TXorNode } from "../../parser";
import { Position } from "../position";

export type TMaybeActiveNode = ActiveNode | ActiveNodeFailure;

export interface IActiveNode {
    readonly kind: ActiveNodeKind;
    // Position in a text editor.
    readonly position: Position;
}

// An ActiveNode represents the context a user in a text editor expects their cursor to be in.
// Examples:
//  'let x =|' -> The context is the assignment portion of a key-value pair.
//  'foo(12|' -> The context is the numeric literal.
//  `foo(12,|' -> The context is the second (and currently empty) argument of an invoke expression.
export interface ActiveNode extends IActiveNode {
    readonly kind: ActiveNodeKind.ActiveNode;
    readonly leafKind: ActiveNodeLeafKind;
    // A full parental ancestry of the root.
    // [root, parent of root, parent of parent of root, ...].
    readonly ancestry: ReadonlyArray<TXorNode>;
    // A conditional indirection to the root if it's some sort of Ast identifier.
    readonly maybeIdentifierUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined;
}

// Sometimes we want to curry postion around with the indicator that it wasn't a valid active node location.
export interface ActiveNodeFailure extends IActiveNode {
    readonly kind: ActiveNodeKind.ActiveNodeFailure;
}

export const enum ActiveNodeLeafKind {
    AfterAstNode = "AfterAstNode",
    Anchored = "Anchored",
    ContextNode = "Context",
    OnAstNode = "OnAstNode",
    ShiftedRight = "ShiftedRight",
}

export const enum ActiveNodeKind {
    ActiveNode = "ActiveNode",
    ActiveNodeFailure = "ActiveNodeFailure",
}
