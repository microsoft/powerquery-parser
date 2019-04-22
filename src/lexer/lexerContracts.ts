import { Option } from "../common";
import { LexerError } from "./error";
import { LineToken } from "./token";

export type TLexerLineExceptUntouched = Exclude<TLexerLine, UntouchedLine>;

export type TLexerLine = (
    | TouchedLine
    | UntouchedLine
    | TouchedWithErrorLine
    | ErrorLine
)

export type TErrorLexerLine = (
    | ErrorLine
    | TouchedWithErrorLine
)

export interface LexerState {
    readonly lines: ReadonlyArray<TLexerLine>,
    readonly separator: string,
}

export const enum LexerMultilineKind {
    Comment = "Comment",
    Default = "Default",
    QuotedIdentifier = "QuotedIdentifier",
    String = "String",
}

export interface ILexerLine {
    readonly kind: LexerLineKind,
    readonly lineString: LexerLineString,               // text representation for the line
    readonly numberOfActions: number,                   // allows for quick LexerLine equality comparisons
    readonly lineNumber: number,                        // what line number is this
    readonly tokens: ReadonlyArray<LineToken>,          // LineTokens lexed so far
    readonly multilineKindStart: LexerMultilineKind,
    readonly multilineKindEnd: LexerMultilineKind,
    readonly isLineEof: boolean,
}

export interface LexerLineString {
    readonly text: string,
    readonly graphemes: ReadonlyArray<string>,
    readonly textIndex2GraphemeIndex: { [textIndex: number]: number; }
    readonly graphemeIndex2TextIndex: { [graphemeIndex: number]: number; }
}

export const enum LexerLineKind {
    Error = "Error",
    Touched = "Touched",
    TouchedWithError = "TouchedWithError",
    Untouched = "Untouched",
}

export interface ErrorLine extends ILexerLine {
    readonly kind: LexerLineKind.Error,
    readonly error: LexerError.TLexerError,
}

// the last read attempt succeeded without encountering an error.
// possible that only whitespace was consumed.
export interface TouchedLine extends ILexerLine {
    readonly kind: LexerLineKind.Touched,
    readonly lastRead: LexerRead,
}

// the last read attempt read at least one token or comment before encountering an error
export interface TouchedWithErrorLine extends ILexerLine {
    readonly kind: LexerLineKind.TouchedWithError,
    readonly error: LexerError.TLexerError,
    readonly lastRead: LexerRead,
}

// a call to appendtToDocument clears existing state marking it ready to be lexed
export interface UntouchedLine extends ILexerLine {
    readonly kind: LexerLineKind.Untouched,
    readonly maybeLastRead: Option<LexerRead>,
}

export interface LexerRead {
    readonly tokens: ReadonlyArray<LineToken>,
    readonly multilineKindEnd: LexerMultilineKind,
    readonly isLineEof: boolean,
}
