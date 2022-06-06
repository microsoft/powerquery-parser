// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TConstant =
    | ArithmeticOperator
    | EqualityOperator
    | KeywordConstant
    | LanguageConstant
    | LogicalOperator
    | MiscConstant
    | PrimitiveTypeConstant
    | RelationalOperator
    | UnaryOperator
    | WrapperConstant;

export type TBinOpExpressionOperator =
    | ArithmeticOperator
    | EqualityOperator
    | LogicalOperator
    | RelationalOperator
    | MiscConstant.NullCoalescingOperator
    | KeywordConstant.As
    | KeywordConstant.Is
    | KeywordConstant.Meta;

// ---------------------------------
// ---------- const enums ----------
// ---------------------------------

export const enum LanguageConstant {
    Catch = "catch",
    Nullable = "nullable",
    Optional = "optional",
}

export const enum KeywordConstant {
    As = "as",
    Each = "each",
    Else = "else",
    Error = "error",
    False = "false",
    If = "if",
    In = "in",
    Is = "is",
    Let = "let",
    Meta = "meta",
    Otherwise = "otherwise",
    Section = "section",
    Shared = "shared",
    Then = "then",
    True = "true",
    Try = "try",
    Type = "type",
}

// Mostly direct mappings from their respective TokenKind
export const enum MiscConstant {
    Ampersand = "&",
    AtSign = "@",
    Comma = ",",
    DotDot = "..",
    Ellipsis = "...",
    Equal = "=",
    FatArrow = "=>",
    NullCoalescingOperator = "??",
    Semicolon = ";",
    QuestionMark = "?",
}

export const enum PrimitiveTypeConstant {
    Action = "action",
    Any = "any",
    AnyNonNull = "anynonnull",
    Binary = "binary",
    Date = "date",
    DateTime = "datetime",
    DateTimeZone = "datetimezone",
    Duration = "duration",
    Function = "function",
    List = "list",
    Logical = "logical",
    None = "none",
    Null = "null",
    Number = "number",
    Record = "record",
    Table = "table",
    Text = "text",
    Time = "time",
    Type = "type",
}

export const enum WrapperConstant {
    LeftBrace = "{",
    LeftBracket = "[",
    LeftParenthesis = "(",
    RightBrace = "}",
    RightBracket = "]",
    RightParenthesis = ")",
}

// ------------------------------------------
// ---------- operator const enums ----------
// ------------------------------------------

export const enum ArithmeticOperator {
    Multiplication = "*",
    Division = "/",
    Addition = "+",
    Subtraction = "-",
    And = "&",
}

export const enum EqualityOperator {
    EqualTo = "=",
    NotEqualTo = "<>",
}

export const enum LogicalOperator {
    And = "and",
    Or = "or",
}

export const enum RelationalOperator {
    LessThan = "<",
    LessThanEqualTo = "<=",
    GreaterThan = ">",
    GreaterThanEqualTo = ">=",
}

export const enum UnaryOperator {
    Positive = "+",
    Negative = "-",
    Not = "not",
}

// ----------------------------------------
// ---------- const enum iterals ----------
// ----------------------------------------

export const ArithmeticOperators: ReadonlyArray<ArithmeticOperator> = [
    ArithmeticOperator.Multiplication,
    ArithmeticOperator.Division,
    ArithmeticOperator.Addition,
    ArithmeticOperator.Subtraction,
    ArithmeticOperator.And,
];

export const EqualityOperators: ReadonlyArray<EqualityOperator> = [
    EqualityOperator.EqualTo,
    EqualityOperator.NotEqualTo,
];

export const KeywordConstants: ReadonlyArray<KeywordConstant> = [
    KeywordConstant.As,
    KeywordConstant.Each,
    KeywordConstant.Else,
    KeywordConstant.Error,
    KeywordConstant.False,
    KeywordConstant.If,
    KeywordConstant.In,
    KeywordConstant.Is,
    KeywordConstant.Let,
    KeywordConstant.Meta,
    KeywordConstant.Otherwise,
    KeywordConstant.Section,
    KeywordConstant.Shared,
    KeywordConstant.Then,
    KeywordConstant.True,
    KeywordConstant.Try,
    KeywordConstant.Type,
];

export const LanguageConstants: ReadonlyArray<LanguageConstant> = [
    LanguageConstant.Nullable,
    LanguageConstant.Optional,
];

export const LogicalOperators: ReadonlyArray<LogicalOperator> = [LogicalOperator.And, LogicalOperator.Or];

export const MiscConstants: ReadonlyArray<MiscConstant> = [
    MiscConstant.Ampersand,
    MiscConstant.AtSign,
    MiscConstant.Comma,
    MiscConstant.DotDot,
    MiscConstant.Ellipsis,
    MiscConstant.Equal,
    MiscConstant.FatArrow,
    MiscConstant.NullCoalescingOperator,
    MiscConstant.QuestionMark,
    MiscConstant.Semicolon,
];

export const PrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = [
    PrimitiveTypeConstant.Action,
    PrimitiveTypeConstant.Any,
    PrimitiveTypeConstant.AnyNonNull,
    PrimitiveTypeConstant.Binary,
    PrimitiveTypeConstant.Date,
    PrimitiveTypeConstant.DateTime,
    PrimitiveTypeConstant.DateTimeZone,
    PrimitiveTypeConstant.Duration,
    PrimitiveTypeConstant.Function,
    PrimitiveTypeConstant.List,
    PrimitiveTypeConstant.Logical,
    PrimitiveTypeConstant.None,
    PrimitiveTypeConstant.Null,
    PrimitiveTypeConstant.Number,
    PrimitiveTypeConstant.Record,
    PrimitiveTypeConstant.Table,
    PrimitiveTypeConstant.Text,
    PrimitiveTypeConstant.Time,
    PrimitiveTypeConstant.Type,
];

export const RelationalOperators: ReadonlyArray<RelationalOperator> = [
    RelationalOperator.LessThan,
    RelationalOperator.LessThanEqualTo,
    RelationalOperator.GreaterThan,
    RelationalOperator.GreaterThanEqualTo,
];

export const UnaryOperators: ReadonlyArray<UnaryOperator> = [
    UnaryOperator.Positive,
    UnaryOperator.Negative,
    UnaryOperator.Not,
];

export const WrapperConstants: ReadonlyArray<WrapperConstant> = [
    WrapperConstant.LeftBrace,
    WrapperConstant.LeftBracket,
    WrapperConstant.LeftParenthesis,
    WrapperConstant.RightBrace,
    WrapperConstant.RightBracket,
    WrapperConstant.RightParenthesis,
];

export const BinOpExpressionOperators: ReadonlyArray<TBinOpExpressionOperator> = [
    ...ArithmeticOperators,
    ...EqualityOperators,
    ...LogicalOperators,
    ...RelationalOperators,
    MiscConstant.NullCoalescingOperator,
    KeywordConstant.As,
    KeywordConstant.Is,
    KeywordConstant.Meta,
];
