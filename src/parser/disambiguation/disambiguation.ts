// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const enum DismabiguationBehavior {
    Strict = "Strict",
    Thorough = "Thorough",
}

export const enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

export const enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    Record = "Record",
}
