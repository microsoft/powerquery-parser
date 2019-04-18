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
    readonly multilineKindUpdate: { [lineNumber: number]: LexerMultilineKind; }
}

export interface ILexerLine {
    readonly kind: LexerLineKind,
    readonly multilineKind: LexerMultilineKind,
    readonly document: string,
    readonly graphemes: ReadonlyArray<string>
    // allows quick checking if a state chnage occured w/o having to check tokens
    readonly actionsTaken: number,          
    readonly tokens: ReadonlyArray<Token>,
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
    readonly startPosition: Position,
    readonly endPosition: Position,
}

export const enum LexStrategy {
    SingleToken = "SingleToken",
    UntilEofOrError = "UntilEofOrError"
}
