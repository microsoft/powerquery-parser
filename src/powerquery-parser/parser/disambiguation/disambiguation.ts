// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../language";
import { ParseError } from "..";
import { ParseState } from "../parseState";
import { Result } from "../../common";

export type TAmbiguousBracketNode = Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression;

export type TAmbiguousParenthesisNode = Ast.FunctionExpression | Ast.ParenthesizedExpression | Ast.TLogicalExpression;

export enum DismabiguationBehavior {
    Strict = "Strict",
    Thorough = "Thorough",
}

export enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    RecordExpression = "RecordExpression",
}

export enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

export interface AmbiguousParse<T extends Ast.TNode> {
    readonly parseState: ParseState;
    readonly result: Result<T, ParseError.ParseError>;
}
