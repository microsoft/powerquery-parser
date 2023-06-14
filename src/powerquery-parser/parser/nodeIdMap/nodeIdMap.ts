// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { ParseContext } from "..";

export type AstNodeById = Map<number, Ast.TNode>;
export type ChildIdsById = Map<number, ReadonlyArray<number>>;
export type ContextNodeById = Map<number, ParseContext.TNode>;
export type IdsByNodeKind = Map<Ast.NodeKind, Set<number>>;
export type ParentIdById = Map<number, number>;

export interface Collection {
    // Holds all of the Ast.TNodes which have been parsed
    readonly astNodeById: AstNodeById;
    // Holds all of the ParseContext.TNodes which are being parsed
    readonly contextNodeById: ContextNodeById;

    // Maps a childId to its parentId (if one exists)
    readonly parentIdById: ParentIdById;
    // Holds all of the childIds for a given parentId.
    // The childIds are in the order that they were parsed.
    readonly childIdsById: ChildIdsById;
    readonly idsByNodeKind: IdsByNodeKind;

    // A collection of all leaf nodes (which by definition are Ast.TNodes)
    readonly leafIds: Set<number>;
    // The right most Ast in the parse context, which can be treated as the most recently parsed node.
    readonly rightMostLeaf: Ast.TNode | undefined;
}

export interface CollectionValidation {
    readonly nodes: { [key: number]: NodeSummary };
    readonly leafIds: ReadonlyArray<number>;
    readonly nodeIdsByNodeKind: { [key: string]: ReadonlyArray<number> };
    readonly unknownLeafIds: ReadonlyArray<number>;
    readonly unknownParentIdKeys: ReadonlyArray<number>;
    readonly unknownParentIdValues: ReadonlyArray<number>;
    readonly unknownChildIdsKeys: ReadonlyArray<number>;
    readonly unknownChildIdsValues: ReadonlyArray<number>;
    readonly unknownByNodeKindNodeKinds: ReadonlyArray<Ast.NodeKind>;
    readonly unknownByNodeKindNodeIds: ReadonlyArray<number>;
    readonly badParentChildLink: ReadonlyArray<[number, number]>;
}

export interface NodeSummary {
    readonly nodeKind: Ast.NodeKind;
    readonly childIds: ReadonlyArray<number> | undefined;
    readonly parentId: number | undefined;
    readonly isAstNode: boolean;
}
