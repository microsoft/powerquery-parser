import { CommonError } from "../common";

const enum LineTokenKindAdditions {
    StringLiteralStart = "StringLiteralStart",
    StringLiteralEnd = "StringLiteralEnd",
    QuotedIdentifierStart = "QuotedIdentifierStart",
    QuotedIdentifierEnd = "QuotedIdentifierEnd",
    MultilineCommentStart = "MultilineCommentStart",
    MultilineCommentEnd = "MultilineCommentEnd",
}

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
    LineComment = "LineComment",
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

export const enum LineTokenKind {
    Ampersand = TokenKind.Ampersand,
    Asterisk = TokenKind.Asterisk,
    AtSign = TokenKind.AtSign,
    Bang = TokenKind.Bang,
    Comma = TokenKind.Comma,
    Division = TokenKind.Division,
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
    LineComment = TokenKind.LineComment,
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
    NullLiteral = TokenKind.NullLiteral,
    NumericLiteral = TokenKind.NumericLiteral,
    Plus = TokenKind.Plus,
    QuestionMark = TokenKind.QuestionMark,
    RightBrace = TokenKind.RightBrace,
    RightBracket = TokenKind.RightBracket,
    RightParenthesis = TokenKind.RightParenthesis,
    Semicolon = TokenKind.Semicolon,

    StringLiteralStart = LineTokenKindAdditions.StringLiteralStart,
    StringLiteralEnd = LineTokenKindAdditions.StringLiteralEnd,
    QuotedIdentifierStart = LineTokenKindAdditions.QuotedIdentifierStart,
    QuotedIdentifierEnd = LineTokenKindAdditions.QuotedIdentifierEnd,
    MultilineCommentStart = LineTokenKindAdditions.MultilineCommentStart,
    MultilineCommentEnd = LineTokenKindAdditions.MultilineCommentEnd,
}

// ---------------------------
// ---------- Token ----------
// ---------------------------

export interface IToken<Kind, Position> {
    readonly kind: Kind,
    // range is [start, end)
    readonly positionStart: Position,
    readonly positionEnd: Position,
    readonly data: string,
}

export interface LineToken extends IToken<LineTokenKind, LexerLinePosition> { };

export interface Token extends IToken<TokenKind, TokenPosition> { }

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

// --------------------------------------------
// ---------- IToken type parameters ----------
// --------------------------------------------

export function tokenKindFrom(lineTokenKind: LineTokenKind): TokenKind {
    switch (lineTokenKind) {
        case LineTokenKind.StringLiteralStart:
        case LineTokenKind.StringLiteralEnd:
        case LineTokenKind.QuotedIdentifierStart:
        case LineTokenKind.QuotedIdentifierEnd:
        case LineTokenKind.MultilineCommentStart:
        case LineTokenKind.MultilineCommentEnd:
            const details = { lineTokenKind };
            throw new CommonError.InvariantError("lineTokenKind should've already been stripped out", details);
        default:
            // unsafe action:
            //      casting LineTokenKind into TokenKind
            // what I'm trying to avoid:
            //      adding a case for all remaining variants in LineTokenKind
            // why it's safe:
            //      set(LineTokenKind) - set(LineTokenKindAdditions) === set(TokenKind)
            return lineTokenKind as unknown as TokenKind;
    }
}
