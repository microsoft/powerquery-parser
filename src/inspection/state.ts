// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, Traverse } from "../common";
import { Ast, NodeIdMap } from "../parser";
import { InspectedKeyword } from "./keyword";
import { Position } from "./position";
import { InspectedScope } from "./scope";

export type State = KeywordState & ScopeState;

export type Inspected = InspectedKeyword & InspectedScope;

export interface KeywordState extends IState<InspectedKeyword> {}

export interface ScopeState extends IState<InspectedScope> {
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then we store that leaf here.
    // Later if we encounter the assignment for this identifier then it's stored in Inspected.maybePositionIdentifier
    readonly maybeClosestLeafIdentifier: Option<Ast.Identifier | Ast.GeneralizedIdentifier>;
}

export interface IState<T> extends Traverse.IState<T> {
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}
