// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Token } from "../../language";
import { NodeIdMap } from "..";

// Parsing use to be one giant evaluation, leading to an all-or-nothing outcome which was unsuitable for a
// document that was being live edited.
//
// Take the scenario where a user is in the process of adding another element to a ListExpression.
// Once a comma is typed the parser would error out as it also expects the yet untyped element.
// Under the one giant evaluation model there was no way to propagate what was parsed up to that point.
//
// Context is used as a workbook for Ast.TNodes that have started evaluation but haven't yet finished.
// It starts out empty, with no children belonging to it.
// Most (all non-leaf) Ast.TNode's require several sub-Ast.TNodes to be evaluated as well.
// For each sub-Ast.TNode that begins evaluation another Context is created and linked as a child of the original.
// This means if a Ast.TNode has N attributes of type Ast.TNode, then the Ast.TNode is fully evaluated there should be N
// child contexts created belonging under the original Context.
// Once the Ast.TNode evaluation is complete the result is saved on the Context under its astNode attribute.
//
// Back to the scenario listed above, where the user has entered `{1,}`, you could examine the context state to find:
//  An incomplete ListExpression context with 3 children
//  With the first child being an evaluated Ast.TNode of NodeKind.Constant: `{`
//  With the second child being an evaluated Ast.TNode of NodeKind.Csv: `1,`
//  With the third child being a yet-to-be evaluated Context of NodeKind.Csv

export interface State {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    root: Node<Ast.TNode> | undefined;
    idCounter: number;
    leafIds: Set<number>;
}

export interface Node<T extends Ast.TNode> {
    readonly id: number;
    readonly kind: T["kind"];
    readonly tokenIndexStart: number;
    readonly tokenStart: Token.Token | undefined;
    // Incremented for each child context created with the Node as its parent,
    // and decremented for each child context deleted.
    attributeCounter: number;
    attributeIndex: number | undefined;
    isClosed: boolean;
}

export type TNode = Node<Ast.TNode>;
