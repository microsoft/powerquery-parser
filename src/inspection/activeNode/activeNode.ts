// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { TXorNode } from "../../parser";
import { Position } from "../position";

export type TMaybeActiveNode =
    // A Position was given that is inside of an Ast (either fully or partially parsed)
    | ActiveNode
    // An invalid Position was given.
    // `| let x = 1 in x` is before the start of the Ast
    | OutOfBoundPosition;

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
    // Must contain at least one element, otherwise it should be an OutOfBoundPosition.
    // [starting node, parent of starting node, parent of parent of starting node, ...].
    readonly ancestry: ReadonlyArray<TXorNode>;
    // A conditional indirection to the leaf if it's an Ast identifier.
    readonly maybeIdentifierUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined;
}

// The
export interface OutOfBoundPosition extends IActiveNode {
    readonly kind: ActiveNodeKind.OutOfBoundPosition;
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
    OutOfBoundPosition = "OutOfBoundPosition",
}
