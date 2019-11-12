// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, Traverse } from "../common";
import { Ast, NodeIdMap } from "../parser";
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

// tslint:disable-next-line: no-empty-interface
export interface IInspected {}

export interface InspectedKeyword extends IInspected {
    readonly allowedKeywords: ReadonlyArray<string>;
    readonly maybeRequiredKeyword: Option<string>;
    readonly keywordVisitedNodes: ReadonlyArray<IInspectedNode>;
}

export interface InspectedIdentifier extends IInspected {
    readonly identifierVisitedNodes: ReadonlyArray<IInspectedNode>;
    // A map of (identifier, what caused the identifier to be added).
    readonly scope: ReadonlyMap<string, NodeIdMap.TXorNode>;
    // Metadata on the first InvokeExpression encountered.
    readonly maybeInvokeExpression: Option<InspectedInvokeExpression>;
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then if we encounter the identifier's assignment we will store metadata.
    readonly maybePositionIdentifier: Option<TPositionIdentifier>;
}
