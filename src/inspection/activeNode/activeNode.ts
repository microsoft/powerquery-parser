// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { TXorNode } from "../../parser";
import { Position } from "../position";

// An ActiveNode represents the context a user in a text editor expects their cursor to be in.
// Examples:
//  'let x =|' -> The context is the assignment portion of a key-value pair.
//  'foo(12|' -> The context is the numeric literal.
//  `foo(12,|' -> The context is the second (and currently empty) argument of an invoke expression.
export interface ActiveNode {
    // Position in a text editor.
    readonly position: Position;
    // A full parental ancestry of the root.
    // [root, parent of root, parent of parent of root, ...].
    readonly ancestry: ReadonlyArray<TXorNode>;
    // A conditional indirection to the root if it's some sort of identifier Ast.
    readonly maybeIdentifierUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined;
}
