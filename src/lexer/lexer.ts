import { CommonError, Pattern, StringHelpers, isNever } from "../common";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { LexerError } from "./error";
import { GraphemeDocument, GraphemeDocumentPosition, LexerLineKind, LexerMultilineKind, LexerRead, LexerState, TLexerLine, UntouchedLine, TLexerLineExceptUntouched, ErrorLine, TouchedWithErrorLine, TErrorLexerLine as TLexerLineError } from "./lexerContracts";
import { Token, TokenKind } from "./token";

// the lexer is
//  * functional
//  * represented by a discriminate union (TLexer which are implementations for ILexer)
//  * incremental, allowing line-by-line lexing

// instantiate an instance using Lexer.from
// calling Lexer.appendToDocument, Lexer.next, Lexer.remaining returns an updated lexer state
// Lexer.snapshot creates a frozen copy of a lexer state

export namespace Lexer {

    export function from(blob: string): LexerState {
        return {
            lines: [lineFrom(blob, 0)],
            multilineKindUpdate: {},
        }
    }

    export function fromSplit(blob: string, separator: string) {
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
            document: graphemeDocument(blob),
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

    function graphemeDocument(blob: string): GraphemeDocument {
        const graphemes = StringHelpers.graphemeSplitter.splitGraphemes(blob);
        const numGraphemes = graphemes.length;
        const documentIndex2GraphemeIndex: { [documentIndex: number]: number; } = {};
        const graphemeIndex2DocumentIndex: { [graphemeIndex: number]: number; } = {};

        let summedCodeUnits = 0;
        for (let index = 0; index < numGraphemes; index++) {
            graphemeIndex2DocumentIndex[index] = summedCodeUnits;
            documentIndex2GraphemeIndex[summedCodeUnits] = index;
            summedCodeUnits += graphemes[index].length;
        }

        return {
            blob,
            graphemes,
            documentIndex2GraphemeIndex,
            graphemeIndex2DocumentIndex
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

    // // get a copy of all document, tokens, and comments lexed up to this point
    // export function snapshot(lexer: TLexer): LexerSnapshot {
    //     return new LexerSnapshot(
    //         lexer.document,
    //         lexer.tokens,
    //         lexer.comments,
    //     )
    // }

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

    function firstErrorLine(state: LexerState): Option<TLexerLineError> {
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
                    position: lexerRead.endPosition,
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
                    position: lexerRead.endPosition,
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
        const document: GraphemeDocument = line.document;
        const documentBlob = line.document.blob;
        const documentLength = documentBlob.length;
        const startPosition = line.position;

        let currentPosition = startPosition;
        let continueLexing = startPosition.documentIndex < documentLength;

        if (!continueLexing) {
            return {
                kind: PartialResultKind.Err,
                error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
            }
        }

        const newTokens: Token[] = [];
        const newComments: Comment[] = [];
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

                // else if ("1" <= chr && chr <= "9") { token = readNumericLiteral(document, documentIndex); }

                // else if (chr === ".") {
                //     const secondChr = document[documentIndex + 1];

                //     if (secondChr === undefined) {
                //         const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
                //         throw new LexerError.UnexpectedEofError(graphemePosition);
                //     }
                //     else if ("1" <= secondChr && secondChr <= "9") { token = readNumericLiteral(document, documentIndex); }
                //     else if (secondChr === ".") {
                //         const thirdChr = document[documentIndex + 2];

                //         if (thirdChr === ".") { token = readConstantToken(documentIndex, TokenKind.Ellipsis, "..."); }
                //         else { throw unexpectedReadError(document, documentIndex) }
                //     }
                //     else { throw unexpectedReadError(document, documentIndex) }
                // }

                // else if (chr === ">") {
                //     const secondChr = document[documentIndex + 1];

                //     if (secondChr === "=") { token = readConstantToken(documentIndex, TokenKind.GreaterThanEqualTo, ">="); }
                //     else { token = readConstantToken(documentIndex, TokenKind.GreaterThan, chr); }
                // }

                // else if (chr === "<") {
                //     const secondChr = document[documentIndex + 1];

                //     if (secondChr === "=") { token = readConstantToken(documentIndex, TokenKind.LessThanEqualTo, "<="); }
                //     else if (secondChr === ">") { token = readConstantToken(documentIndex, TokenKind.NotEqual, "<>"); }
                //     else { token = readConstantToken(documentIndex, TokenKind.LessThan, chr) }
                // }

                // else if (chr === "=") {
                //     const secondChr = document[documentIndex + 1];

                //     if (secondChr === ">") { token = readConstantToken(documentIndex, TokenKind.FatArrow, "=>"); }
                //     else { token = readConstantToken(documentIndex, TokenKind.Equal, chr); }
                // }

                // else if (chr === "/") {
                //     const secondChr = document[documentIndex + 1];

                //     if (secondChr === "/") {
                //         const phantomTokenIndex = line.tokens.length + newTokens.length;
                //         const commentRead = readComments(document, documentIndex, CommentKind.Line, phantomTokenIndex);
                //         documentIndex = commentRead[commentRead.length - 1].documentEndIndex;
                //         newComments.push(...commentRead);
                //         continue;
                //     }
                //     else if (secondChr === "*") {
                //         const phantomTokenIndex = line.tokens.length + newTokens.length;
                //         const commentRead = readComments(document, documentIndex, CommentKind.Multiline, phantomTokenIndex);
                //         documentIndex = commentRead[commentRead.length - 1].documentEndIndex;
                //         newComments.push(...commentRead);
                //         continue;
                //     }
                //     else { token = readConstantToken(documentIndex, TokenKind.Division, chr); }
                // }

                // else if (chr === "#") {
                //     const secondChr = document[documentIndex + 1];

                //     if (secondChr === "\"") { token = readQuotedIdentifier(document, documentIndex); }
                //     else { token = readKeyword(document, documentIndex, undefined); }
                // }

                // else { token = readKeywordOrIdentifier(document, documentIndex); }

                else { throw unexpectedReadError(document.blob, currentPosition.documentIndex); }

                currentPosition = token.endPosition;
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
            if (newTokens.length || newComments.length) {
                return {
                    kind: PartialResultKind.Partial,
                    value: {
                        tokens: newTokens,
                        startPosition: startPosition,
                        endPosition: currentPosition,
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
                    startPosition: startPosition,
                    endPosition: currentPosition,
                }
            }
        }
    }

    function drainWhitespace(document: GraphemeDocument, position: GraphemeDocumentPosition): GraphemeDocumentPosition {
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

    function readHexLiteral(document: GraphemeDocument, startPosition: GraphemeDocumentPosition): Token {
        const maybeDocumentIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpHex, document, startPosition);
        if (maybeDocumentIndexEnd === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document.blob, startPosition.documentIndex);
            throw new LexerError.ExpectedHexLiteralError(graphemePosition);
        }

        const endPosition: GraphemeDocumentPosition = {
            documentIndex: maybeDocumentIndexEnd,
            lineNumber: startPosition.lineNumber,
            columnNumber: document.graphemeIndex2DocumentIndex[maybeDocumentIndexEnd],
        }
        return readTokenFromPositions(TokenKind.HexLiteral, document, startPosition, endPosition);
    }

    function readNumericLiteral(document: GraphemeDocument, startPosition: GraphemeDocumentPosition): Token {
        const maybeDocumentIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, document, startPosition);
        if (maybeDocumentIndexEnd === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document.blob, startPosition.documentIndex);
            throw new LexerError.ExpectedNumericLiteralError(graphemePosition);
        }

        const endPosition: GraphemeDocumentPosition = {
            documentIndex: maybeDocumentIndexEnd,
            lineNumber: startPosition.lineNumber,
            columnNumber: document.graphemeIndex2DocumentIndex[maybeDocumentIndexEnd],
        }
        return readTokenFromPositions(TokenKind.HexLiteral, document, startPosition, endPosition);
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

    // function readQuotedIdentifier(document: string, documentIndex: number): Token {
    //     const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex + 1);
    //     if (stringEndIndex === undefined) {
    //         throw unterminatedStringError(document, documentIndex + 1);
    //     }

    //     return readTokenFromSlice(document, documentIndex, TokenKind.Identifier, stringEndIndex + 1);
    // }

    // function readKeyword(document: GraphemeDocument, startPosition: GraphemeDocumentPosition, maybeSubstring: Option<string>): Token {
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

    // function readKeywordOrIdentifier(document: string, documentIndex: number): Token {
    //     const maybeSubstring = maybeKeywordOrIdentifierSubstring(document, documentIndex);
    //     if (maybeSubstring === undefined) {
    //         const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
    //         throw new LexerError.ExpectedKeywordOrIdentifierError(graphemePosition);
    //     }
    //     const substring: string = maybeSubstring;

    //     if (substring[0] === "#" || Keywords.indexOf(substring) !== -1) {
    //         return readKeyword(document, documentIndex, substring);
    //     }
    //     else if (substring === "null") {
    //         const documentStartIndex = documentIndex;
    //         const documentEndIndex = documentStartIndex + 4;
    //         return {
    //             kind: TokenKind.NullLiteral,
    //             documentStartIndex,
    //             documentEndIndex,
    //             data: "null",
    //         }
    //     }
    //     else {
    //         return readTokenFromSubstring(documentIndex, TokenKind.Identifier, substring);
    //     }
    // }

    // function maybeKeywordOrIdentifierSubstring(
    //     document: GraphemeDocument,
    //     startPosition: GraphemeDocumentPosition,
    // ): Option<string> {
    //     const chr = document[documentIndex];
    //     let indexOfStart: number;

    //     if (chr === "#") {
    //         indexOfStart = documentIndex + 1;
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
        document: GraphemeDocument,
        startPosition: GraphemeDocumentPosition,
        length: number,
    ): Token {
        const documentIndexStart = startPosition.documentIndex;
        const documentIndexEnd = documentIndexStart + length;
        const columnNumberEnd = document.documentIndex2GraphemeIndex[documentIndexEnd];
        const data = document.blob.substring(documentIndexStart, documentIndexEnd);

        return {
            kind: tokenKind,
            startPosition,
            endPosition: {
                documentIndex: documentIndexEnd,
                lineNumber: startPosition.lineNumber,
                columnNumber: columnNumberEnd,
            },
            data,
        }
    }

    function readTokenFromPositions(
        tokenKind: TokenKind,
        document: GraphemeDocument,
        startPosition: GraphemeDocumentPosition,
        endPosition: GraphemeDocumentPosition,
    ): Token {
        return {
            kind: tokenKind,
            startPosition,
            endPosition,
            data: document.blob.substring(startPosition.documentIndex, endPosition.documentIndex),
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
        document: GraphemeDocument,
        position: GraphemeDocumentPosition,
    ): Option<number> {
        const documentIndex = position.documentIndex;
        const maybeLength = StringHelpers.maybeRegexMatchLength(pattern, document.blob, documentIndex);

        return maybeLength !== undefined
            ? documentIndex
            : undefined;
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