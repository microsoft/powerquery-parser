import { Token } from "./token";
import { Option, StringHelpers } from "../common";
import { LexerError } from "./error";

export type TLexerLine = (
    | TouchedLine
    | UntouchedLine
    | TouchedWithErrorLine
    | ErrorLine
)

export interface LexerState {
    readonly lines: ReadonlyArray<TLexerLine>,
    readonly multilineKindUpdate: { [lineNumber: number]: LexerMultilineKind; }
}

export interface GraphemeDocument {
    readonly blob: string,
    readonly graphemes: ReadonlyArray<string>,
    readonly documentIndex2GraphemeIndex: { [documentIndex: number]: number; }
    readonly graphemeIndex2DocumentIndex: { [graphemeIndex: number]: number; }
}

export interface ILexerLine {
    readonly kind: LexerLineKind,
    readonly multilineKind: LexerMultilineKind,
    readonly document: GraphemeDocument,
    readonly position: GraphemeDocumentPosition,
    readonly tokens: ReadonlyArray<Token>,
    readonly numberOfActions: number,
}

export interface GraphemeDocumentPosition {
    readonly documentIndex: number,
    readonly lineNumber: number,
    readonly columnNumber: number,
}

export const enum LexerLineKind {
    Error = "Error",
    Touched = "Touched",
    TouchedWithError = "TouchedWithError",
    Untouched = "Untouched",
}

export const enum LexerMultilineKind {
    Default = "Default",
    ExpectingMultilineComment = "ExpectingMultilineComment",
    ExpectingMultilineQuotedIdentifier = "ExpectingMultilineQuotedIdentifier",
    ExpectingMultilineString = "ExpectingMultilineString",
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
    readonly lastRead: LexerRead,
    readonly error: LexerError.TLexerError,
}

// a call to appendtToDocument clears existing state marking it ready to be lexed
export interface UntouchedLine extends ILexerLine {
    readonly kind: LexerLineKind.Untouched,
    readonly maybeLastRead: Option<LexerRead>,
}

export interface LexerRead {
    readonly tokens: ReadonlyArray<Token>,
    readonly startPosition: GraphemeDocumentPosition,
    readonly endPosition: GraphemeDocumentPosition,
}
