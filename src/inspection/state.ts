// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, Traverse } from "../common";
import { Ast, NodeIdMap } from "../parser";
import { Keyword } from "./keyword";
import { IInspectedNode, InspectedInvokeExpression } from "./node";
import { Position } from "./position";
import { TPositionIdentifier } from "./positionIdentifier";

export type State = KeywordState & IdentifierState;

export type Inspected = InspectedKeyword & InspectedIdentifier;

export interface IState<T> extends Traverse.IState<T> {
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export interface KeywordState extends IState<InspectedKeyword> {
    isKeywordInspectionDone: boolean;
}

export interface IdentifierState extends IState<InspectedIdentifier> {
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then we store that leaf here.
    // Later if we encounter the assignment for this identifier then it's stored in Inspected.maybePositionIdentifier
    readonly maybeClosestLeafIdentifier: Option<Ast.Identifier | Ast.GeneralizedIdentifier>;
}

export interface IInspected {
    // The DFS traversal path is recorded, starting from the given position's leaf node to the last parents' parent.
    // This is primarily used during the inspection itself, but it's made public on the chance that it's useful.
    readonly visitedNodes: ReadonlyArray<IInspectedNode>;
}

export interface InspectedKeyword extends IInspected {
    readonly maybeKeywords: Option<ReadonlyArray<Keyword>>;
}

export interface InspectedIdentifier extends IInspected {
    // A map of (identifier, what caused the identifier to be added).
    readonly scope: ReadonlyMap<string, NodeIdMap.TXorNode>;
    // Metadata on the first InvokeExpression encountered.
    readonly maybeInvokeExpression: Option<InspectedInvokeExpression>;
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then if we encounter the identifier's assignment we will store metadata.
    readonly maybePositionIdentifier: Option<TPositionIdentifier>;
}
