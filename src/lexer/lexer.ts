import { CommonError, isNever, Pattern, StringHelpers } from "../common";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { LexerError } from "./error";
import { Keyword } from "./keywords";
import { ErrorLine, LexerLineKind, LexerMultilineKind, LexerRead, LexerState, TErrorLexerLine as TLexerLineError, TLexerLine, TLexerLineExceptUntouched, TouchedWithErrorLine, UntouchedLine } from "./lexerContracts";
import { LexerSnapshot } from "./lexerSnapshot";
import { Token, TokenKind } from "./token";

type GraphemeString = StringHelpers.GraphemeString;
type GraphemePosition = StringHelpers.GraphemePosition;

// the lexer is
//  * functional
//  * represented by a discriminate union (TLexer which are implementations for ILexer)
//  * incremental, allowing line-by-line lexing

// instantiate an instance using Lexer.from
// calling Lexer.appendToDocument, Lexer.next, Lexer.remaining returns an updated lexer state
// Lexer.snapshot creates a frozen copy of a lexer state

export namespace Lexer {

    export function from(blob: string, separator = "\n", lexAfter = true): LexerState {
        let newState: LexerState = {
            lines: [lineFrom(blob, 0)],
            multilineKindUpdate: {},
            separator,
        };

        if (lexAfter) {
            return lexLine(newState);
        }
        else {
            return newState;
        }
    }

    export function fromSplit(blob: string, separator: string): LexerState {
        const lines = blob.split(separator);
        const numLines = lines.length;

        let state = from(lines[0]);
        if (numLines === 1) {
            return state;
        }

        for (let index = 1; index < numLines; index++) {
            state = appendLine(state, lines[index]);
            if (isErrorLine(state.lines[index])) {
                return state;
            }
        }

        return state;
    }

    export function appendLine(state: LexerState, blob: string, lexAfter = true): LexerState {
        let newState: LexerState = {
            ...state,
            lines: state.lines.concat(lineFrom(blob, state.lines.length)),
        };

        if (lexAfter) {
            return lexLine(newState);
        }
        else {
            return newState;
        }
    }

    function lexLine(state: LexerState, lineIndex = (state.lines.length - 1)): LexerState {
        const maybeLine = state.lines[lineIndex];
        if (maybeLine === undefined) {
            throw new Error("invalid line number");
        }

        let line: TLexerLine = maybeLine;
        switch (line.kind) {
            case LexerLineKind.Touched:
            case LexerLineKind.Untouched:
                const lexResult = lex(line);
                line = updateLine(line, lexResult);
                break;

            case LexerLineKind.Error:
                line = {
                    ...line,
                    numberOfActions: line.numberOfActions + 1,
                };
                break;

            case LexerLineKind.TouchedWithError:
                line = {
                    kind: LexerLineKind.Error,
                    multilineKind: line.multilineKind,
                    document: line.document,
                    numberOfActions: line.numberOfActions + 1,
                    position: line.position,
                    tokens: line.tokens,
                    error: new LexerError.LexerError(new LexerError.BadStateError(line.error)),
                };
                break;

            default:
                throw isNever(line);
        }

        // unsafe: temp removal of ReadonlyArray
        const lines: TLexerLineExceptUntouched[] = state.lines as TLexerLineExceptUntouched[];
        lines[lineIndex] = line;

        return state;
    }

    function lineFrom(blob: string, lineNumber: number): UntouchedLine {
        return {
            kind: LexerLineKind.Untouched,
            multilineKind: LexerMultilineKind.Default,
            document: StringHelpers.graphemeDocument(blob),
            position: {
                documentIndex: 0,
                columnNumber: 0,
                lineNumber,
            },
            tokens: [],
            numberOfActions: 0,
            maybeLastRead: undefined,
        }
    }

    // export type TLexer = (
    //     | TouchedLexer
    //     | TouchedWithErrorLexer
    //     | ErrorLexer
    //     | UntouchedLexer
    // )

    // // most Lexer actions leave a TLexer in a touched state of some sort
    // export type TLexerExceptUntouched = Exclude<TLexer, UntouchedLexer>;

    // export interface ILexer {
    //     readonly kind: LexerKind,
    //     readonly document: string,
    //     readonly tokens: ReadonlyArray<Token>,      // all tokens read up to this point
    //     readonly comments: ReadonlyArray<TComment>, // all comments read up to this point
    //     readonly documentIndex: number,             // where the lexer left off, can be EOF
    // }

    // // the last read attempt didn't read any new tokens/comments (though possibly whitespace),
    // // and encountered an error such as: unterminated string, eof, expected hex literal, etc.
    // export interface ErrorLexer extends ILexer {
    //     readonly kind: LexerKind.Error,
    //     readonly error: LexerError.TLexerError,
    // }

    // // the last read attempt succeeded without encountering an error.
    // // possible that only whitespace was consumed.
    // export interface TouchedLexer extends ILexer {
    //     readonly kind: LexerKind.Touched,
    //     readonly lastRead: LexerRead,
    // }

    // // the last read attempt read at least one token or comment before encountering an error
    // export interface TouchedWithErrorLexer extends ILexer {
    //     readonly kind: LexerKind.TouchedWithError,
    //     readonly lastRead: LexerRead,
    //     readonly error: LexerError.TLexerError,
    // }

    // // a call to appendtToDocument clears existing state marking it ready to be lexed
    // export interface UntouchedLexer extends ILexer {
    //     readonly kind: LexerKind.Untouched,
    //     readonly maybeLastRead: Option<LexerRead>,
    // }

    // export const enum LexerKind {
    //     Error = "Error",
    //     Touched = "Touched",                    // a call to lex returned PartialResultKind.Ok
    //     TouchedWithError = "TouchedWithError",  // a call to lex returned PartialResultKind.Partial
    //     Untouched = "Untouched",                // the last Lexer action was appendToDocument
    // }

    // // what was read on a call to lex
    // export interface LexerRead {
    //     readonly tokens: ReadonlyArray<Token>,
    //     readonly comments: ReadonlyArray<TComment>,
    //     readonly documentStartIndex: number,
    //     readonly documentEndIndex: number,
    // }

    // // create a new default state Lexer for the given document
    // export function from(document: string): TLexer {
    //     return {
    //         kind: LexerKind.Untouched,
    //         document: document,
    //         tokens: [],
    //         comments: [],
    //         documentIndex: 0,
    //         maybeLastRead: undefined,
    //     }
    // }

    // // resets TLexerKind to UntouchedLexer
    // export function appendToDocument(lexer: TLexer, toAppend: string): UntouchedLexer {
    //     const newDocument = lexer.document + toAppend;
    //     switch (lexer.kind) {
    //         case LexerKind.Error:
    //             return {
    //                 kind: LexerKind.Untouched,
    //                 document: newDocument,
    //                 tokens: lexer.tokens,
    //                 comments: lexer.comments,
    //                 documentIndex: lexer.documentIndex,
    //                 maybeLastRead: undefined,
    //             };

    //         case LexerKind.Touched:
    //             return {
    //                 kind: LexerKind.Untouched,
    //                 document: newDocument,
    //                 tokens: lexer.tokens,
    //                 comments: lexer.comments,
    //                 documentIndex: lexer.documentIndex,
    //                 maybeLastRead: lexer.lastRead,
    //             };

    //         case LexerKind.TouchedWithError:
    //             return {
    //                 kind: LexerKind.Untouched,
    //                 document: newDocument,
    //                 tokens: lexer.tokens,
    //                 comments: lexer.comments,
    //                 documentIndex: lexer.documentIndex,
    //                 maybeLastRead: undefined,
    //             };

    //         case LexerKind.Untouched:
    //             return {
    //                 ...lexer,
    //                 document: newDocument,
    //             };
    //     }
    // }

    // get a frozen copy of all document, tokens, and comments lexed up to this point
    export function snapshot(state: LexerState): LexerSnapshot {
        const allDocuments = state
            .lines
            .map(line => line.document)
            .join(state.separator);

        const allTokens: Token[] = [];
        for (let line of state.lines) {
            for (let token of line.tokens) {
                allTokens.push({
                    ...token,
                    positionStart: { ...token.positionStart },
                    positionEnd: { ...token.positionEnd },
                });
            }
        }

        return new LexerSnapshot(allDocuments, allTokens);
    }

    // // lex one token and all comments before that token
    // export function next(lexer: TLexer): TLexerExceptUntouched {
    //     return lex(lexer, LexerStrategy.SingleToken);
    // }

    // // lex until EOF or an error occurs
    // export function remaining(state: TLexer): TLexerExceptUntouched {
    //     return lex(state, LexerStrategy.UntilEofOrError);
    // }

    export function isErrorState(state: LexerState): boolean {
        const linesWithErrors: ReadonlyArray<ErrorLine | TouchedWithErrorLine> = state.lines.filter(isErrorLine);
        return linesWithErrors.length !== 0;
    }

    export function isErrorLine(line: TLexerLine): line is TLexerLineError {
        switch (line.kind) {
            case LexerLineKind.Error:
            case LexerLineKind.TouchedWithError:
                return true;

            case LexerLineKind.Touched:
            case LexerLineKind.Untouched:
                return false;

            default:
                throw isNever(line);
        }
    }

    export function firstErrorLine(state: LexerState): Option<TLexerLineError> {
        for (let line of state.lines) {
            if (isErrorLine(line)) {
                return line;
            }
        }

        return undefined;
    }

    // function lex(state: TLexer, strategy: LexerStrategy): TLexerExceptUntouched {
    //     switch (state.kind) {
    //         case LexerKind.Touched:
    //         case LexerKind.Untouched:
    //             const lexerRead = read(state, strategy);
    //             const newState = updateState(state, lexerRead);
    //             return newState;

    //         case LexerKind.Error:
    //             return state;

    //         case LexerKind.TouchedWithError:
    //             return {
    //                 kind: LexerKind.Error,
    //                 tokens: state.tokens,
    //                 comments: state.comments,
    //                 document: state.document,
    //                 documentIndex: state.documentIndex,
    //                 error: new LexerError.LexerError(new LexerError.BadStateError(state.error)),
    //             };

    //         default:
    //             throw isNever(state);
    //     }
    // }

    function updateLine(
        originalState: TLexerLine,
        lexPartialResult: PartialResult<LexerRead, LexerError.TLexerError>,
    ): TLexerLineExceptUntouched {
        switch (lexPartialResult.kind) {
            case PartialResultKind.Ok: {
                const lexerRead: LexerRead = lexPartialResult.value;
                const newTokens: ReadonlyArray<Token> = originalState.tokens.concat(lexerRead.tokens);

                return {
                    kind: LexerLineKind.Touched,
                    multilineKind: LexerMultilineKind.Default,
                    document: originalState.document,
                    tokens: newTokens,
                    position: lexerRead.positionEnd,
                    lastRead: lexerRead,
                    numberOfActions: originalState.numberOfActions + 1,
                }
            }

            case PartialResultKind.Partial: {
                const lexerRead: LexerRead = lexPartialResult.value;
                const newTokens: ReadonlyArray<Token> = originalState.tokens.concat(lexerRead.tokens);

                return {
                    kind: LexerLineKind.TouchedWithError,
                    multilineKind: LexerMultilineKind.Default,
                    document: originalState.document,
                    numberOfActions: originalState.numberOfActions + 1,
                    position: lexerRead.positionEnd,
                    tokens: newTokens,
                    error: lexPartialResult.error,
                    lastRead: lexerRead,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LexerLineKind.Error,
                    multilineKind: LexerMultilineKind.Default,
                    document: originalState.document,
                    numberOfActions: originalState.numberOfActions,
                    tokens: originalState.tokens,
                    position: originalState.position,
                    error: lexPartialResult.error,
                }

            default:
                throw isNever(lexPartialResult);
        }
    }

    function lex(line: TLexerLine): PartialResult<LexerRead, LexerError.TLexerError> {
        if (!line.document.blob) {
            return {
                kind: PartialResultKind.Ok,
                value: {
                    tokens: [],
                    positionStart: line.position,
                    positionEnd: line.position,
                }
            };
        }

        const document: GraphemeString = line.document;
        const documentBlob = line.document.blob;
        const documentLength = documentBlob.length;
        const positionStart = line.position;

        let currentPosition = positionStart;
        let continueLexing = positionStart.documentIndex < documentLength;

        if (!continueLexing) {
            return {
                kind: PartialResultKind.Err,
                error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
            }
        }

        const newTokens: Token[] = [];
        let maybeError: Option<LexerError.TLexerError>;
        while (continueLexing) {
            currentPosition = drainWhitespace(document, currentPosition);

            const chr1: string = documentBlob[currentPosition.documentIndex];
            if (chr1 === undefined) {
                break;
            }

            try {
                let token: Token;

                if (chr1 === "!") { token = readConstant(TokenKind.Bang, document, currentPosition, 1); }
                else if (chr1 === "&") { token = readConstant(TokenKind.Ampersand, document, currentPosition, 1); }
                else if (chr1 === "(") { token = readConstant(TokenKind.LeftParenthesis, document, currentPosition, 1); }
                else if (chr1 === ")") { token = readConstant(TokenKind.RightParenthesis, document, currentPosition, 1); }
                else if (chr1 === "*") { token = readConstant(TokenKind.Asterisk, document, currentPosition, 1); }
                else if (chr1 === "+") { token = readConstant(TokenKind.Plus, document, currentPosition, 1); }
                else if (chr1 === ",") { token = readConstant(TokenKind.Comma, document, currentPosition, 1); }
                else if (chr1 === "-") { token = readConstant(TokenKind.Minus, document, currentPosition, 1); }
                else if (chr1 === ";") { token = readConstant(TokenKind.Semicolon, document, currentPosition, 1); }
                else if (chr1 === "?") { token = readConstant(TokenKind.QuestionMark, document, currentPosition, 1); }
                else if (chr1 === "@") { token = readConstant(TokenKind.AtSign, document, currentPosition, 1); }
                else if (chr1 === "[") { token = readConstant(TokenKind.LeftBracket, document, currentPosition, 1); }
                else if (chr1 === "]") { token = readConstant(TokenKind.RightBracket, document, currentPosition, 1); }
                else if (chr1 === "{") { token = readConstant(TokenKind.LeftBrace, document, currentPosition, 1); }
                else if (chr1 === "}") { token = readConstant(TokenKind.RightBrace, document, currentPosition, 1); }

                // else if (chr === "\"") { token = readStringLiteral(document, documentIndex); }

                else if (chr1 === "0") {
                    const chr2 = documentBlob[currentPosition.documentIndex + 1];

                    if (chr2 === "x" || chr2 === "X") { token = readHexLiteral(document, currentPosition); }
                    else { token = readNumericLiteral(document, currentPosition); }
                }

                else if ("1" <= chr1 && chr1 <= "9") { token = readNumericLiteral(document, currentPosition); }

                else if (chr1 === ".") {
                    const chr2 = document.blob[currentPosition.documentIndex + 1];

                    if (chr2 === undefined) {
                        const graphemePosition = StringHelpers.graphemePositionAt(document.blob, currentPosition.documentIndex);
                        throw new LexerError.UnexpectedEofError(graphemePosition);
                    }
                    else if ("1" <= chr2 && chr2 <= "9") { token = readNumericLiteral(document, currentPosition); }
                    else if (chr2 === ".") {
                        const chr3 = document.blob[currentPosition.documentIndex + 2];

                        if (chr3 === ".") { token = readConstant(TokenKind.Ellipsis, document, currentPosition, 3); }
                        else { throw unexpectedReadError(document.blob, currentPosition.documentIndex) }
                    }
                    else { throw unexpectedReadError(document.blob, currentPosition.documentIndex) }
                }

                else if (chr1 === ">") {
                    const chr2 = document.blob[currentPosition.documentIndex + 1];

                    if (chr2 === "=") { token = readConstant(TokenKind.GreaterThanEqualTo, document, currentPosition, 2); }
                    else { token = readConstant(TokenKind.GreaterThan, document, currentPosition, 1); }
                }

                else if (chr1 === "<") {
                    const chr2 = document.blob[currentPosition.documentIndex + 1];

                    if (chr2 === "=") { token = readConstant(TokenKind.LessThanEqualTo, document, currentPosition, 2); }
                    else if (chr2 === ">") { token = readConstant(TokenKind.NotEqual, document, currentPosition, 2); }
                    else { token = readConstant(TokenKind.LessThan, document, currentPosition, 1) }
                }

                else if (chr1 === "=") {
                    const chr2 = document.blob[currentPosition.documentIndex + 1];

                    if (chr2 === ">") { token = readConstant(TokenKind.FatArrow, document, currentPosition, 2); }
                    else { token = readConstant(TokenKind.Equal, document, currentPosition, 1); }
                }

                else if (chr1 === "/") {
                    const chr2 = document.blob[currentPosition.documentIndex + 1];

                    if (chr2 === "/") {
                        throw new Error("comments not supported");
                        // const phantomTokenIndex = line.tokens.length + newTokens.length;
                        // const commentRead = readComments(document, documentIndex, CommentKind.Line, phantomTokenIndex);
                        // documentIndex = commentRead[commentRead.length - 1].documentEndIndex;
                        // newComments.push(...commentRead);
                        // continue;
                    }
                    else if (chr2 === "*") {
                        throw new Error("comments not supported");
                        // const phantomTokenIndex = line.tokens.length + newTokens.length;
                        // const commentRead = readComments(document, documentIndex, CommentKind.Multiline, phantomTokenIndex);
                        // documentIndex = commentRead[commentRead.length - 1].documentEndIndex;
                        // newComments.push(...commentRead);
                        // continue;
                    }
                    else { token = readConstant(TokenKind.Division, document, currentPosition, 1); }
                }

                else if (chr1 === "#") {
                    const chr2 = document.blob[currentPosition.documentIndex + 1];

                    if (chr2 === "\"") { token = readQuotedIdentifier(document, currentPosition); }
                    else { token = readKeyword(document, currentPosition); }
                }

                else { token = readKeywordOrIdentifier(document, currentPosition); }

                currentPosition = token.positionEnd;
                newTokens.push(token);

                if (currentPosition.documentIndex === documentLength) {
                    continueLexing = false;
                }

            } catch (e) {
                let error: LexerError.TLexerError;
                if (LexerError.isTInnerLexerError(e)) {
                    error = new LexerError.LexerError(e);
                }
                else {
                    error = CommonError.ensureCommonError(e);
                }
                continueLexing = false;
                maybeError = error;
            }
        }

        if (maybeError) {
            if (newTokens.length) {
                return {
                    kind: PartialResultKind.Partial,
                    value: {
                        tokens: newTokens,
                        positionStart: positionStart,
                        positionEnd: currentPosition,
                    },
                    error: maybeError,
                };
            }
            else {
                return {
                    kind: PartialResultKind.Err,
                    error: maybeError,
                }
            }
        }
        else {
            return {
                kind: PartialResultKind.Ok,
                value: {
                    tokens: newTokens,
                    positionStart: positionStart,
                    positionEnd: currentPosition,
                }
            }
        }
    }

    function drainWhitespace(
        document: GraphemeString,
        position: GraphemePosition,
    ): GraphemePosition {
        let documentIndex = position.documentIndex;
        let continueDraining = document.blob[documentIndex] !== undefined;

        while (continueDraining) {
            const maybeLength = StringHelpers.maybeRegexMatchLength(Pattern.RegExpWhitespace, document.blob, documentIndex);
            if (maybeLength) {
                documentIndex += maybeLength;
            }
            else {
                continueDraining = false;
            }
        }

        return {
            ...position,
            documentIndex,
        };
    }

    // function readStringLiteral(document: string, documentIndex: number): Token {
    //     const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex);
    //     if (stringEndIndex === undefined) {
    //         throw unterminatedStringError(document, documentIndex);
    //     }

    //     return readTokenFromSlice(document, documentIndex, TokenKind.StringLiteral, stringEndIndex + 1);
    // }

    function readHexLiteral(
        document: GraphemeString,
        positionStart: GraphemePosition,
    ): Token {
        const maybeDocumentIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpHex, document.blob, positionStart.documentIndex);
        if (maybeDocumentIndexEnd === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document.blob, positionStart.documentIndex);
            throw new LexerError.ExpectedHexLiteralError(graphemePosition);
        }
        const documentIndexEnd: number = maybeDocumentIndexEnd;

        const positionEnd: GraphemePosition = {
            documentIndex: documentIndexEnd,
            lineNumber: positionStart.lineNumber,
            columnNumber: document.documentIndex2GraphemeIndex[documentIndexEnd],
        }
        return readTokenFromPositions(TokenKind.HexLiteral, document, positionStart, positionEnd);
    }

    function readNumericLiteral(document: GraphemeString, positionStart: GraphemePosition): Token {
        const maybeDocumentIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, document.blob, positionStart.documentIndex);
        if (maybeDocumentIndexEnd === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document.blob, positionStart.documentIndex);
            throw new LexerError.ExpectedNumericLiteralError(graphemePosition);
        }
        const documentIndexEnd: number = maybeDocumentIndexEnd;

        const positionEnd: GraphemePosition = {
            documentIndex: documentIndexEnd,
            lineNumber: positionStart.lineNumber,
            columnNumber: document.documentIndex2GraphemeIndex[documentIndexEnd],
        }
        return readTokenFromPositions(TokenKind.NumericLiteral, document, positionStart, positionEnd);
    }

    // function readComments(
    //     document: string,
    //     documentIndex: number,
    //     initial: CommentKind,
    //     phantomTokenIndex: number,
    // ): ReadonlyArray<TComment> {
    //     let maybeNextCommentKind: Option<CommentKind> = initial;
    //     let chr1 = document[documentIndex];
    //     let chr2 = document[documentIndex + 1];

    //     const newComments = [];
    //     while (maybeNextCommentKind) {
    //         let comment: TComment;
    //         switch (maybeNextCommentKind) {
    //             case CommentKind.Line:
    //                 comment = readLineComment(document, documentIndex, phantomTokenIndex)
    //                 break;

    //             case CommentKind.Multiline:
    //                 comment = readMultilineComment(document, documentIndex, phantomTokenIndex);
    //                 break;

    //             default:
    //                 throw isNever(maybeNextCommentKind)
    //         }

    //         documentIndex = comment.documentEndIndex;
    //         newComments.push(comment);

    //         chr1 = document[documentIndex];
    //         chr2 = document[documentIndex + 1];
    //         // line comment
    //         if (chr1 === "/" && chr2 === "/") {
    //             maybeNextCommentKind = CommentKind.Line;
    //         }
    //         // multiline comment
    //         else if (chr1 === "/" && chr2 === "*") {
    //             maybeNextCommentKind = CommentKind.Multiline;
    //         }
    //         else {
    //             maybeNextCommentKind = undefined;
    //         }
    //     }

    //     return newComments;
    // }

    // function readLineComment(
    //     document: string,
    //     documentIndex: number,
    //     phantomTokenIndex: number,
    // ): LineComment {
    //     const documentLength = document.length;
    //     const commentStart = documentIndex;

    //     let maybeLiteral: Option<string>;
    //     let commentEnd = commentStart + 2;

    //     while (!maybeLiteral && commentEnd < documentLength) {
    //         const maybeNewlineKind = StringHelpers.maybeNewlineKindAt(document, commentEnd);
    //         switch (maybeNewlineKind) {
    //             case StringHelpers.NewlineKind.DoubleCharacter:
    //                 maybeLiteral = document.substring(commentStart, commentEnd);
    //                 documentIndex = commentEnd + 2;
    //                 break;

    //             case StringHelpers.NewlineKind.SingleCharacter:
    //                 maybeLiteral = document.substring(commentStart, commentEnd);
    //                 documentIndex = commentEnd + 1;
    //                 break;

    //             case undefined:
    //                 commentEnd += 1;
    //                 break;

    //             default:
    //                 throw isNever(maybeNewlineKind);
    //         }
    //     }

    //     // reached EOF without a trailing newline
    //     if (!maybeLiteral) {
    //         maybeLiteral = document.substring(commentStart, document.length);
    //         documentIndex = document.length;
    //     }

    //     return {
    //         kind: CommentKind.Line,
    //         literal: maybeLiteral,
    //         phantomTokenIndex,
    //         containsNewline: true,
    //         documentStartIndex: commentStart,
    //         documentEndIndex: documentIndex,
    //     }
    // }

    // function readMultilineComment(
    //     document: string,
    //     documentIndex: number,
    //     phantomTokenIndex: number,
    // ): MultilineComment {
    //     const documentStartIndex = documentIndex;
    //     const indexOfCommentEnd = document.indexOf("*/", documentStartIndex + 2);
    //     if (indexOfCommentEnd === -1) {
    //         const graphemePosition = StringHelpers.graphemePositionAt(document, documentStartIndex);
    //         throw new LexerError.UnterminatedMultilineCommentError(graphemePosition);
    //     }

    //     const documentEndIndex = indexOfCommentEnd + 2;
    //     const literal = document.substring(documentStartIndex, documentEndIndex);

    //     return {
    //         kind: CommentKind.Multiline,
    //         literal,
    //         phantomTokenIndex,
    //         containsNewline: StringHelpers.containsNewline(literal),
    //         documentStartIndex,
    //         documentEndIndex,
    //     }
    // }

    function readKeyword(document: GraphemeString, positionStart: GraphemePosition): Token {
        const maybeToken: Option<Token> = maybeReadKeyword(document, positionStart);
        if (maybeToken) {
            return maybeToken;
        }
        else {
            throw unexpectedReadError(document.blob, positionStart.documentIndex);
        }
    }

    function maybeReadKeyword(document: GraphemeString, positionStart: GraphemePosition): Option<Token> {
        const documentBlob = document.blob;

        const documentIndexStart = positionStart.documentIndex;
        const identifierDocumentIndexStart = documentBlob[documentIndexStart] === "#"
            ? documentIndexStart + 1
            : documentIndexStart;

        const maybeIdentifierDocumentIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, documentBlob, identifierDocumentIndexStart);
        if (maybeIdentifierDocumentIndexEnd === undefined) {
            return undefined;
        }
        const documentIndexEnd = maybeIdentifierDocumentIndexEnd;

        const substring = document.blob.substring(documentIndexStart, documentIndexEnd);

        const maybeKeywordTokenKind = maybeKeywordTokenKindFrom(substring);
        if (maybeKeywordTokenKind === undefined) {
            return undefined;
        }
        else {
            return {
                kind: maybeKeywordTokenKind,
                positionStart,
                positionEnd: {
                    documentIndex: documentIndexEnd,
                    lineNumber: positionStart.lineNumber,
                    columnNumber: document.documentIndex2GraphemeIndex[documentIndexEnd],
                },
                data: substring,
            }
        }
    }

    function readQuotedIdentifier(_document: GraphemeString, _position: GraphemePosition): Token {
        throw new Error("not supported");
        // const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex + 1);
        // if (stringEndIndex === undefined) {
        //     throw unterminatedStringError(document, documentIndex + 1);
        // }

        // return readTokenFromSlice(document, documentIndex, TokenKind.Identifier, stringEndIndex + 1);
    }

    // function readKeyword(document: GraphemeString, startPosition: GraphemePosition, maybeSubstring: Option<string>): Token {
    //     if (maybeSubstring === undefined) {
    //         maybeSubstring = maybeKeywordOrIdentifierSubstring(document, documentIndex);
    //         if (maybeSubstring === undefined) {
    //             throw unexpectedReadError(document, documentIndex);
    //         }
    //     }
    //     const substring: string = maybeSubstring;
    //     const substringLength = substring.length;

    //     switch (substring) {
    //         case Keyword.And:
    //             return readConstant(TokenKind.KeywordAnd, document, startPosition, substringLength);
    //         case Keyword.As:
    //             return readConstant(TokenKind.KeywordAs, document, startPosition, substringLength);
    //         case Keyword.Each:
    //             return readConstant(TokenKind.KeywordEach, document, startPosition, substringLength);
    //         case Keyword.Else:
    //             return readConstant(TokenKind.KeywordElse, document, startPosition, substringLength);
    //         case Keyword.Error:
    //             return readConstant(TokenKind.KeywordError, document, startPosition, substringLength);
    //         case Keyword.False:
    //             return readConstant(TokenKind.KeywordFalse, document, startPosition, substringLength);
    //         case Keyword.If:
    //             return readConstant(TokenKind.KeywordIf, document, startPosition, substringLength);
    //         case Keyword.In:
    //             return readConstant(TokenKind.KeywordIn, document, startPosition, substringLength);
    //         case Keyword.Is:
    //             return readConstant(TokenKind.KeywordIs, document, startPosition, substringLength);
    //         case Keyword.Let:
    //             return readConstant(TokenKind.KeywordLet, document, startPosition, substringLength);
    //         case Keyword.Meta:
    //             return readConstant(TokenKind.KeywordMeta, document, startPosition, substringLength);
    //         case Keyword.Not:
    //             return readConstant(TokenKind.KeywordNot, document, startPosition, substringLength);
    //         case Keyword.Or:
    //             return readConstant(TokenKind.KeywordOr, document, startPosition, substringLength);
    //         case Keyword.Otherwise:
    //             return readConstant(TokenKind.KeywordOtherwise, document, startPosition, substringLength);
    //         case Keyword.Section:
    //             return readConstant(TokenKind.KeywordSection, document, startPosition, substringLength);
    //         case Keyword.Shared:
    //             return readConstant(TokenKind.KeywordShared, document, startPosition, substringLength);
    //         case Keyword.Then:
    //             return readConstant(TokenKind.KeywordThen, document, startPosition, substringLength);
    //         case Keyword.True:
    //             return readConstant(TokenKind.KeywordTrue, document, startPosition, substringLength);
    //         case Keyword.Try:
    //             return readConstant(TokenKind.KeywordTry, document, startPosition, substringLength);
    //         case Keyword.Type:
    //             return readConstant(TokenKind.KeywordType, document, startPosition, substringLength);
    //         case Keyword.HashBinary:
    //             return readConstant(TokenKind.KeywordHashBinary, document, startPosition, substringLength);
    //         case Keyword.HashDate:
    //             return readConstant(TokenKind.KeywordHashDate, document, startPosition, substringLength);
    //         case Keyword.HashDateTime:
    //             return readConstant(TokenKind.KeywordHashDateTime, document, startPosition, substringLength);
    //         case Keyword.HashDateTimeZone:
    //             return readConstant(TokenKind.KeywordHashDateTimeZone, document, startPosition, substringLength);
    //         case Keyword.HashDuration:
    //             return readConstant(TokenKind.KeywordHashDuration, document, startPosition, substringLength);
    //         case Keyword.HashInfinity:
    //             return readConstant(TokenKind.KeywordHashInfinity, document, startPosition, substringLength);
    //         case Keyword.HashNan:
    //             return readConstant(TokenKind.KeywordHashNan, document, startPosition, substringLength);
    //         case Keyword.HashSections:
    //             return readConstant(TokenKind.KeywordHashSections, document, startPosition, substringLength);
    //         case Keyword.HashShared:
    //             return readConstant(TokenKind.KeywordHashShared, document, startPosition, substringLength);
    //         case Keyword.HashTable:
    //             return readConstant(TokenKind.KeywordHashTable, document, startPosition, substringLength);
    //         case Keyword.HashTime:
    //             return readConstant(TokenKind.KeywordHashTime, document, startPosition, substringLength);
    //         default:
    //             throw new CommonError.InvariantError("unknown keyword", { keyword: substring });
    //     }
    // }

    // the quoted identifier case has already been taken care of
    function readKeywordOrIdentifier(document: GraphemeString, positionStart: GraphemePosition): Token {
        const documentBlob = document.blob;
        const documentIndexStart = positionStart.documentIndex;

        // keyword
        if (document.blob[documentIndexStart] === "#") {
            return readKeyword(document, positionStart);
        }
        // either keyword or identifier
        else {
            const maybeDocumentIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, documentBlob, documentIndexStart);
            if (maybeDocumentIndexEnd === undefined) {
                throw unexpectedReadError(document.blob, documentIndexStart);
            }
            const documentIndexEnd = maybeDocumentIndexEnd;
            const substring = documentBlob.substring(documentIndexStart, documentIndexEnd);

            const maybeKeywordTokenKind = maybeKeywordTokenKindFrom(substring);
            const tokenKind = maybeKeywordTokenKind === undefined
                ? TokenKind.Identifier
                : maybeKeywordTokenKind;

            return {
                kind: tokenKind,
                positionStart,
                positionEnd: {
                    documentIndex: documentIndexEnd,
                    lineNumber: positionStart.lineNumber,
                    columnNumber: document.documentIndex2GraphemeIndex[documentIndexEnd],
                },
                data: substring,
            }
        }
    }

    // function maybeKeywordOrIdentifierSubstring(
    //     document: GraphemeString,
    //     positionStart: GraphemePosition,
    // ): Option<string> {
    //     const chr = document.blob[positionStart.documentIndex];
    //     let indexOfStart: number;

    //     if (chr === "#") {
    //         indexOfStart = positionStart.documentIndex + 1;
    //     }
    //     else {
    //         indexOfStart = documentIndex;
    //     }

    //     const identifierEndIndex = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, document, indexOfStart);
    //     if (identifierEndIndex !== -1) {
    //         return document.substring(documentIndex, identifierEndIndex);
    //     }
    //     else {
    //         return undefined;
    //     }
    // }

    function readConstant(
        tokenKind: TokenKind,
        document: GraphemeString,
        positionStart: GraphemePosition,
        length: number,
    ): Token {
        const documentIndexEnd = positionStart.documentIndex + length;
        const positionEnd = {
            documentIndex: positionStart.documentIndex + length,
            lineNumber: positionStart.lineNumber,
            columnNumber: document.documentIndex2GraphemeIndex[documentIndexEnd]
        }
        return readTokenFromPositions(tokenKind, document, positionStart, positionEnd);
    }

    function readTokenFromPositions(
        tokenKind: TokenKind,
        document: GraphemeString,
        startPosition: GraphemePosition,
        positionEnd: GraphemePosition,
    ): Token {
        return {
            kind: tokenKind,
            positionStart: startPosition,
            positionEnd: positionEnd,
            data: document.blob.substring(startPosition.documentIndex, positionEnd.documentIndex),
        };
    }

    // function readTokenFromSlice(
    //     document: string,
    //     documentIndex: number,
    //     tokenKind: TokenKind,
    //     documentIndexEnd: number,
    // ): Token {
    //     const data = document.substring(documentIndex, documentIndexEnd);
    //     return readTokenFromSubstring(documentIndex, tokenKind, data);
    // }

    // function readTokenFromSubstring(
    //     documentStartIndex: number,
    //     tokenKind: TokenKind,
    //     data: string,
    // ): Token {
    //     return {
    //         kind: tokenKind,
    //         documentStartIndex,
    //         documentEndIndex: documentStartIndex + data.length,
    //         data,
    //     };
    // }

    function maybeIndexOfRegexEnd(
        pattern: RegExp,
        documentBlob: string,
        documentIndex: number,
    ): Option<number> {
        const maybeLength = StringHelpers.maybeRegexMatchLength(pattern, documentBlob, documentIndex);

        return maybeLength !== undefined
            ? documentIndex + maybeLength
            : undefined;
    }

    function maybeKeywordTokenKindFrom(str: string): Option<TokenKind> {
        switch (str) {
            case Keyword.And:
                return TokenKind.KeywordAnd;
            case Keyword.As:
                return TokenKind.KeywordAs;
            case Keyword.Each:
                return TokenKind.KeywordEach;
            case Keyword.Else:
                return TokenKind.KeywordElse;
            case Keyword.Error:
                return TokenKind.KeywordError;
            case Keyword.False:
                return TokenKind.KeywordFalse;
            case Keyword.If:
                return TokenKind.KeywordIf;
            case Keyword.In:
                return TokenKind.KeywordIn;
            case Keyword.Is:
                return TokenKind.KeywordIs;
            case Keyword.Let:
                return TokenKind.KeywordLet;
            case Keyword.Meta:
                return TokenKind.KeywordMeta;
            case Keyword.Not:
                return TokenKind.KeywordNot;
            case Keyword.Or:
                return TokenKind.KeywordOr;
            case Keyword.Otherwise:
                return TokenKind.KeywordOtherwise;
            case Keyword.Section:
                return TokenKind.KeywordSection;
            case Keyword.Shared:
                return TokenKind.KeywordShared;
            case Keyword.Then:
                return TokenKind.KeywordThen;
            case Keyword.True:
                return TokenKind.KeywordTrue;
            case Keyword.Try:
                return TokenKind.KeywordTry;
            case Keyword.Type:
                return TokenKind.KeywordType;
            case Keyword.HashBinary:
                return TokenKind.KeywordHashBinary;
            case Keyword.HashDate:
                return TokenKind.KeywordHashDate;
            case Keyword.HashDateTime:
                return TokenKind.KeywordHashDateTime;
            case Keyword.HashDateTimeZone:
                return TokenKind.KeywordHashDateTimeZone;
            case Keyword.HashDuration:
                return TokenKind.KeywordHashDuration;
            case Keyword.HashInfinity:
                return TokenKind.KeywordHashInfinity;
            case Keyword.HashNan:
                return TokenKind.KeywordHashNan;
            case Keyword.HashSections:
                return TokenKind.KeywordHashSections;
            case Keyword.HashShared:
                return TokenKind.KeywordHashShared;
            case Keyword.HashTable:
                return TokenKind.KeywordHashTable;
            case Keyword.HashTime:
                return TokenKind.KeywordHashTime;
            default:
                return undefined;
        }
    }

    // function maybeIndexOfStringEnd(
    //     document: string,
    //     documentStartIndex: number,
    // ): Option<number> {
    //     let documentIndex = documentStartIndex + 1;
    //     let indexOfDoubleQuote = document.indexOf("\"", documentIndex)

    //     while (indexOfDoubleQuote !== -1) {
    //         if (document[indexOfDoubleQuote + 1] === "\"") {
    //             documentIndex = indexOfDoubleQuote + 2;
    //             indexOfDoubleQuote = document.indexOf("\"", documentIndex);
    //         }
    //         else {
    //             return indexOfDoubleQuote;
    //         }
    //     }

    //     return undefined;
    // }

    function unexpectedReadError(
        document: string,
        documentIndex: number,
    ): LexerError.UnexpectedReadError {
        const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
        return new LexerError.UnexpectedReadError(graphemePosition);
    }

    // function unterminatedStringError(
    //     document: string,
    //     documentIndex: number,
    // ): LexerError.UnterminatedStringError {
    //     const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
    //     return new LexerError.UnterminatedStringError(graphemePosition);
    // }
}