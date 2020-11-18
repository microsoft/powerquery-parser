// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { Result } from "../../common";
import { Ast } from "../../language";
import { IParseState } from "../IParseState";

export type TAmbiguousBracketNode = Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression;

export type TAmbiguousParenthesisNode = Ast.FunctionExpression | Ast.ParenthesizedExpression;

export const enum DismabiguationBehavior {
    Strict = "Strict",
    Thorough = "Thorough",
}

export const enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    RecordExpression = "RecordExpression",
}

export const enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

export interface AmbiguousParse<T extends Ast.TNode, S extends IParseState = IParseState> {
    readonly parseState: S;
    readonly result: Result<T, ParseError.ParseError<S>>;
}
