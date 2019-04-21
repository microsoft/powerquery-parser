export const enum TokenKind {
    Ampersand = "Ampersand",
    Asterisk = "Asterisk",
    AtSign = "AtSign",
    Bang = "Bang",
    Comma = "Comma",
    Division = "Division",
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
    NullLiteral = "NullLiteral",
    NumericLiteral = "NumericLiteral",
    Plus = "Plus",
    QuestionMark = "QuestionMark",
    RightBrace = "RightBrace",
    RightBracket = "RightBracket",
    RightParenthesis = "RightParenthesis",
    Semicolon = "Semicolon",
    StringLiteral = "StringLiteral",
}

// ---------------------------
// ---------- Token ----------
// ---------------------------

export interface IToken<T> {
    readonly kind: TokenKind,
    // range is [start, end)
    readonly positionStart: T,
    readonly positionEnd: T,
    readonly data: string,
}

export interface LineToken extends IToken<LexerLinePosition> {};

export interface Token extends IToken<TokenPosition> {}

// --------------------------------------------
// ---------- IToken type parameters ----------
// --------------------------------------------

export interface LexerLinePosition {
    readonly textIndex: number,
    readonly columnNumber: number,
}

export interface TokenPosition extends LexerLinePosition {
    readonly lineNumber: number,
}
