// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export enum TokenKind {
    Ampersand = "Ampersand",
    Asterisk = "Asterisk",
    AtSign = "AtSign",
    Bang = "Bang",
    Comma = "Comma",
    Division = "Division",
    DotDot = "DotDot",
    Ellipsis = "Ellipsis",
    Equal = "Equal",
    FatArrow = "FatArrow",
    GreaterThan = "GreaterThan",
    GreaterThanEqualTo = "GreaterThanEqualTo",
    HexLiteral = "HexLiteral",
    Identifier = "Identifier",
    KeywordAnd = "KeywordAnd",
    KeywordAs = "KeywordAs",
    KeywordEach = "KeywordEach",
    KeywordElse = "KeywordElse",
    KeywordError = "KeywordError",
    KeywordFalse = "KeywordFalse",
    KeywordHashBinary = "KeywordHashBinary",
    KeywordHashDate = "KeywordHashDate",
    KeywordHashDateTime = "KeywordHashDateTime",
    KeywordHashDateTimeZone = "KeywordHashDateTimeZone",
    KeywordHashDuration = "KeywordHashDuration",
    KeywordHashInfinity = "KeywordHashInfinity",
    KeywordHashNan = "KeywordHashNan",
    KeywordHashSections = "KeywordHashSections",
    KeywordHashShared = "KeywordHashShared",
    KeywordHashTable = "KeywordHashTable",
    KeywordHashTime = "KeywordHashTime",
    KeywordIf = "KeywordIf",
    KeywordIn = "KeywordIn",
    KeywordIs = "KeywordIs",
    KeywordLet = "KeywordLet",
    KeywordMeta = "KeywordMeta",
    KeywordNot = "KeywordNot",
    KeywordOr = "KeywordOr",
    KeywordOtherwise = "KeywordOtherwise",
    KeywordSection = "KeywordSection",
    KeywordShared = "KeywordShared",
    KeywordThen = "KeywordThen",
    KeywordTrue = "KeywordTrue",
    KeywordTry = "KeywordTry",
    KeywordType = "KeywordType",
    LeftBrace = "LeftBrace",
    LeftBracket = "LeftBracket",
    LeftParenthesis = "LeftParenthesis",
    LessThan = "LessThan",
    LessThanEqualTo = "LessThanEqualTo",
    Minus = "Minus",
    NotEqual = "NotEqual",
    NullCoalescingOperator = "NullCoalescingOperator",
    NullLiteral = "NullLiteral",
    NumericLiteral = "NumericLiteral",
    Plus = "Plus",
    QuestionMark = "QuestionMark",
    RightBrace = "RightBrace",
    RightBracket = "RightBracket",
    RightParenthesis = "RightParenthesis",
    Semicolon = "Semicolon",
    TextLiteral = "TextLiteral",
}

export interface IToken<Kind, Position> {
    readonly kind: Kind;
    // range is [start, end)
    readonly positionStart: Position;
    readonly positionEnd: Position;
    readonly data: string;
}

export type Token = IToken<TokenKind, TokenPosition>;

// 0-indexed
// Inclusive start, exclusive end
export interface TokenPosition {
    // What code unit it's on for the line
    readonly lineCodeUnit: number;
    // What line it's on
    readonly lineNumber: number;
    // What code unit it's on for the whole document
    readonly codeUnit: number;
}

// 0-indexed
// Inclusive start, exclusive end
export interface TokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
    readonly positionStart: TokenPosition;
    readonly positionEnd: TokenPosition;
}
