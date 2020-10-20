// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { TXorNode } from "../../parser";
import { Position } from "../position";

// Sometimes we want to curry postion around with the indicator that it wasn't a valid active node location.
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
    // A full parental ancestry of the starting node.
    // Must contain at least one element, otherwise it should be an ActiveNodeFailure.
    // [starting node, parent of starting node, parent of parent of starting node, ...].
    readonly ancestry: ReadonlyArray<TXorNode>;
    // A conditional indirection to the leaf if it's an Ast identifier.
    readonly maybeIdentifierUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined;
}

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
