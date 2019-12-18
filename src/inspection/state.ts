// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, Traverse } from "../common";
import { Ast, NodeIdMap } from "../parser";
import { IInspectedNode, InspectedInvokeExpression } from "./node";
import { Position } from "./position";
import { TPositionIdentifier } from "./positionIdentifier";

export type State = KeywordState & IdentifierState;

export type Inspected = KeywordInspected & IdentifierInspected;

export interface IState<T> extends Traverse.IState<T> {
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export interface KeywordState extends IState<KeywordInspected> {
    readonly keywordRoot: KeywordRoot;
    isKeywordInspectionDone: boolean;
}

export interface IdentifierState extends IState<IdentifierInspected> {
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then we store that leaf here.
    // Later if we encounter the assignment for this identifier then it's stored in Inspected.maybePositionIdentifier
    readonly maybeClosestLeafIdentifier: Option<Ast.Identifier | Ast.GeneralizedIdentifier>;
}

// tslint:disable-next-line: no-empty-interface
export interface IInspected {}

export interface KeywordInspected extends IInspected {
    readonly allowedKeywords: ReadonlyArray<string>;
    readonly maybeRequiredKeyword: Option<string>;
    readonly keywordVisitedNodes: ReadonlyArray<IInspectedNode>;
}

export interface IdentifierInspected extends IInspected {
    readonly identifierVisitedNodes: ReadonlyArray<IInspectedNode>;
    // A map of (identifier, what caused the identifier to be added).
    readonly scope: ReadonlyMap<string, NodeIdMap.TXorNode>;
    // Metadata on the first InvokeExpression encountered.
    readonly maybeInvokeExpression: Option<InspectedInvokeExpression>;
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then if we encounter the identifier's assignment we will store metadata.
    readonly maybePositionIdentifier: Option<TPositionIdentifier>;
}

// Normally a kewyrod inspection starts by going to the right most leaf node on or before the inspection position,
// but on certain nodes the starting postion is shifted to the right one.
// Eg. '{1,|' shouldn't be inspecting the second Csv item instead of the first.
export interface KeywordRoot {
    readonly root: NodeIdMap.TXorNode;
    readonly originalRoot: NodeIdMap.TXorNode;
}
