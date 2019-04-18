import { Token } from "./token";
import { Option } from "../common";
import { LexerError } from "./error";

export type TLexerLine = (
    | TouchedLine
    | UntouchedLine
    | TouchedWithErrorLine
    | ErrorLine
)

export interface LexerState {
    readonly lines: ReadonlyArray<TLexerLine>,
    readonly multilineKindUpdate: { [lineNumber: number]: MultilineKind; }
}

export interface ILexerLine {
    readonly kind: LineKind,
    // allows quick checking if a state chnage occured w/o having to check tokens
    readonly actionsTaken: number,          
    readonly multilineKind: MultilineKind,
    readonly tokens: ReadonlyArray<Token>,
}

export const enum LineKind {
    Error = "Error",
    Touched = "Touched",
    TouchedWithError = "TouchedWithError",
    Untouched = "Untouched",
}

export const enum MultilineKind {
    Default = "Default",
    ExpectingMultilineComment = "ExpectingMultilineComment",
    ExpectingMultilineQuotedIdentifier = "ExpectingMultilineQuotedIdentifier",
    ExpectingMultilineString = "ExpectingMultilineString",
}

export interface ErrorLine extends ILexerLine {
    readonly kind: LineKind.Error,
    readonly error: LexerError.TLexerError,
}

// the last read attempt succeeded without encountering an error.
// possible that only whitespace was consumed.
export interface TouchedLine extends ILexerLine {
    readonly kind: LineKind.Touched,
    readonly lastRead: LexerRead,
}

// the last read attempt read at least one token or comment before encountering an error
export interface TouchedWithErrorLine extends ILexerLine {
    readonly kind: LineKind.TouchedWithError,
    readonly lastRead: LexerRead,
    readonly error: LexerError.TLexerError,
}

// a call to appendtToDocument clears existing state marking it ready to be lexed
export interface UntouchedLine extends ILexerLine {
    readonly kind: LineKind.Untouched,
    readonly maybeLastRead: Option<LexerRead>,
}

export interface LexerRead {
    readonly tokens: ReadonlyArray<Token>,
    readonly startPosition: Position,
    readonly endPosition: Position,
}
