// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const enum LineTokenKindAdditions {
    LineComment = "LineComment",
    MultilineComment = "MultilineComment",
    MultilineCommentContent = "MultilineCommentContent",
    MultilineCommentEnd = "MultilineCommentEnd",
    MultilineCommentStart = "MultilineCommentStart",
    TextLiteralContent = "TextContent",
    TextLiteralEnd = "TextLiteralEnd",
    TextLiteralStart = "TextLiteralStart",
    QuotedIdentifierContent = "QuotedIdentifierContent",
    QuotedIdentifierEnd = "QuotedIdentifierEnd",
    QuotedIdentifierStart = "QuotedIdentifierStart",
}

export const enum TokenKind {
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
    NullCoalescing = "NullCoalescing",
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

export const enum LineTokenKind {
    Ampersand = TokenKind.Ampersand,
    Asterisk = TokenKind.Asterisk,
    AtSign = TokenKind.AtSign,
    Bang = TokenKind.Bang,
    Comma = TokenKind.Comma,
    Division = TokenKind.Division,
    DotDot = TokenKind.DotDot,
    Ellipsis = TokenKind.Ellipsis,
    Equal = TokenKind.Equal,
    FatArrow = TokenKind.FatArrow,
    GreaterThan = TokenKind.GreaterThan,
    GreaterThanEqualTo = TokenKind.GreaterThanEqualTo,
    HexLiteral = TokenKind.HexLiteral,
    Identifier = TokenKind.Identifier,
    KeywordAnd = TokenKind.KeywordAnd,
    KeywordAs = TokenKind.KeywordAs,
    KeywordEach = TokenKind.KeywordEach,
    KeywordElse = TokenKind.KeywordElse,
    KeywordError = TokenKind.KeywordError,
    KeywordFalse = TokenKind.KeywordFalse,
    KeywordHashBinary = TokenKind.KeywordHashBinary,
    KeywordHashDate = TokenKind.KeywordHashDate,
    KeywordHashDateTime = TokenKind.KeywordHashDateTime,
    KeywordHashDateTimeZone = TokenKind.KeywordHashDateTimeZone,
    KeywordHashDuration = TokenKind.KeywordHashDuration,
    KeywordHashInfinity = TokenKind.KeywordHashInfinity,
    KeywordHashNan = TokenKind.KeywordHashNan,
    KeywordHashSections = TokenKind.KeywordHashSections,
    KeywordHashShared = TokenKind.KeywordHashShared,
    KeywordHashTable = TokenKind.KeywordHashTable,
    KeywordHashTime = TokenKind.KeywordHashTime,
    KeywordIf = TokenKind.KeywordIf,
    KeywordIn = TokenKind.KeywordIn,
    KeywordIs = TokenKind.KeywordIs,
    KeywordLet = TokenKind.KeywordLet,
    KeywordMeta = TokenKind.KeywordMeta,
    KeywordNot = TokenKind.KeywordNot,
    KeywordOr = TokenKind.KeywordOr,
    KeywordOtherwise = TokenKind.KeywordOtherwise,
    KeywordSection = TokenKind.KeywordSection,
    KeywordShared = TokenKind.KeywordShared,
    KeywordThen = TokenKind.KeywordThen,
    KeywordTrue = TokenKind.KeywordTrue,
    KeywordTry = TokenKind.KeywordTry,
    KeywordType = TokenKind.KeywordType,
    LeftBrace = TokenKind.LeftBrace,
    LeftBracket = TokenKind.LeftBracket,
    LeftParenthesis = TokenKind.LeftParenthesis,
    LessThan = TokenKind.LessThan,
    LessThanEqualTo = TokenKind.LessThanEqualTo,
    Minus = TokenKind.Minus,
    NotEqual = TokenKind.NotEqual,
    NullCoalescing = TokenKind.NullCoalescing,
    NullLiteral = TokenKind.NullLiteral,
    NumericLiteral = TokenKind.NumericLiteral,
    Plus = TokenKind.Plus,
    QuestionMark = TokenKind.QuestionMark,
    RightBrace = TokenKind.RightBrace,
    RightBracket = TokenKind.RightBracket,
    RightParenthesis = TokenKind.RightParenthesis,
    Semicolon = TokenKind.Semicolon,
    TextLiteral = TokenKind.TextLiteral,

    LineComment = LineTokenKindAdditions.LineComment,
    MultilineComment = LineTokenKindAdditions.MultilineComment,
    MultilineCommentContent = LineTokenKindAdditions.MultilineCommentContent,
    MultilineCommentEnd = LineTokenKindAdditions.MultilineCommentEnd,
    MultilineCommentStart = LineTokenKindAdditions.MultilineCommentStart,
    TextLiteralContent = LineTokenKindAdditions.TextLiteralContent,
    TextLiteralEnd = LineTokenKindAdditions.TextLiteralEnd,
    TextLiteralStart = LineTokenKindAdditions.TextLiteralStart,
    QuotedIdentifierContent = LineTokenKindAdditions.QuotedIdentifierContent,
    QuotedIdentifierEnd = LineTokenKindAdditions.QuotedIdentifierEnd,
    QuotedIdentifierStart = LineTokenKindAdditions.QuotedIdentifierStart,
}

export interface IToken<Kind, Position> {
    readonly kind: Kind;
    // range is [start, end)
    readonly positionStart: Position;
    readonly positionEnd: Position;
    readonly data: string;
}

export interface LineToken extends IToken<LineTokenKind, number> {}

export interface Token extends IToken<TokenKind, TokenPosition> {}

export interface TokenPosition {
    readonly lineCodeUnit: number;
    readonly lineNumber: number;
    readonly codeUnit: number;
}

export interface TokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number; // exclusive
    readonly positionStart: TokenPosition;
    readonly positionEnd: TokenPosition;
}
