import { CommonError, isNever, Pattern, StringHelpers } from "../common";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { LexerError } from "./error";
import { Keyword } from "./keywords";
import { ErrorLine, LexerLineKind, LexerLineString, LexerMultilineKind, LexerRead, LexerState, TErrorLexerLine, TLexerLine, TouchedWithErrorLine, UntouchedLine } from "./lexerContracts";
import { LexerSnapshot } from "./lexerSnapshot";
import { LexerLinePosition, LineToken, Token, TokenKind } from "./token";

// the lexer is
//  * functional
//  * represented by a discriminate union (TLexer which are implementations for ILexer)
//  * incremental, allowing line-by-line lexing

// instantiate an instance using Lexer.from
// calling Lexer.appendToDocument, Lexer.next, Lexer.remaining returns an updated lexer state
// Lexer.snapshot creates a frozen copy of a lexer state

export namespace Lexer {

    export function lexerLineStringFrom(text: string): LexerLineString {
        const graphemes = StringHelpers.graphemeSplitter.splitGraphemes(text);
        const numGraphemes = graphemes.length;
        const textIndex2GraphemeIndex: { [textIndex: number]: number; } = {};
        const graphemeIndex2TextIndex: { [graphemeIndex: number]: number; } = {};

        let summedCodeUnits = 0;
        for (let index = 0; index < numGraphemes; index++) {
            graphemeIndex2TextIndex[index] = summedCodeUnits;
            textIndex2GraphemeIndex[summedCodeUnits] = index;
            summedCodeUnits += graphemes[index].length;
        }

        graphemeIndex2TextIndex[numGraphemes] = text.length;
        textIndex2GraphemeIndex[text.length] = numGraphemes;

        return {
            text,
            graphemes,
            textIndex2GraphemeIndex,
            graphemeIndex2TextIndex
        }
    }

    export function from(blob: string, separator = "\n", lexAfter = true): LexerState {
        let newState: LexerState = {
            lines: [lineFrom(blob, 0)],
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
                    lineString: line.lineString,
                    numberOfActions: line.numberOfActions + 1,
                    lineNumber: line.lineNumber,
                    position: line.position,
                    tokens: line.tokens,
                    multilineKindStart: line.multilineKindStart,
                    multilineKindEnd: line.multilineKindEnd,
                    error: new LexerError.LexerError(new LexerError.BadStateError(line.error)),
                };
                break;

            default:
                throw isNever(line);
        }

        // unsafe: temp removal of ReadonlyArray
        const lines: TLexerLine[] = state.lines as TLexerLine[];
        lines[lineIndex] = line;

        return state;
    }

    function lineFrom(blob: string, lineNumber: number): UntouchedLine {
        return {
            kind: LexerLineKind.Untouched,
            lineString: lexerLineStringFrom(blob),
            numberOfActions: 0,
            lineNumber,
            position: {
                textIndex: 0,
                columnNumber: 0,
            },
            tokens: [],
            multilineKindStart: LexerMultilineKind.Default,
            multilineKindEnd: LexerMultilineKind.Default,
            maybeLastRead: undefined,
        }
    }

    // get a frozen copy of all document, tokens, and comments lexed up to this point
    export function snapshot(state: LexerState): LexerSnapshot {
        const allLineStrings = state
            .lines
            .map(line => line.lineString)
            .join(state.separator);

        const allTokens: Token[] = [];
        for (let line of state.lines) {
            for (let token of line.tokens) {
                allTokens.push({
                    ...token,
                    positionStart: {
                        lineNumber: line.lineNumber,
                        ...token.positionStart,
                    },
                    positionEnd: {
                        lineNumber: line.lineNumber,
                        ...token.positionEnd,
                    },
                });
            }
        }

        return new LexerSnapshot(allLineStrings, allTokens);
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

    export function isErrorLine(line: TLexerLine): line is TErrorLexerLine {
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

    export function firstErrorLine(state: LexerState): Option<TErrorLexerLine> {
        for (let line of state.lines) {
            if (isErrorLine(line)) {
                return line;
            }
        }

        return undefined;
    }

    function updateLine(
        originalState: TLexerLine,
        lexPartialResult: PartialResult<LexerRead, LexerError.TLexerError>,
    ): TLexerLine {
        switch (lexPartialResult.kind) {
            case PartialResultKind.Ok: {
                const lexerRead: LexerRead = lexPartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = originalState.tokens.concat(lexerRead.tokens);

                return {
                    kind: LexerLineKind.Touched,
                    lineString: originalState.lineString,
                    numberOfActions: originalState.numberOfActions + 1,
                    lineNumber: originalState.lineNumber,
                    position: lexerRead.positionEnd,
                    tokens: newTokens,
                    multilineKindStart: originalState.multilineKindStart,
                    multilineKindEnd: lexerRead.multilineKindEnd,
                    lastRead: lexerRead,
                }
            }

            case PartialResultKind.Partial: {
                const lexerRead: LexerRead = lexPartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = originalState.tokens.concat(lexerRead.tokens);

                return {
                    kind: LexerLineKind.TouchedWithError,
                    lineString: originalState.lineString,
                    numberOfActions: originalState.numberOfActions + 1,
                    lineNumber: originalState.lineNumber,
                    position: lexerRead.positionEnd,
                    tokens: newTokens,
                    multilineKindStart: originalState.multilineKindStart,
                    multilineKindEnd: lexerRead.multilineKindEnd,
                    error: lexPartialResult.error,
                    lastRead: lexerRead,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LexerLineKind.Error,
                    lineString: originalState.lineString,
                    numberOfActions: originalState.numberOfActions,
                    tokens: originalState.tokens,
                    lineNumber: originalState.lineNumber,
                    multilineKindStart: originalState.multilineKindStart,
                    multilineKindEnd: originalState.multilineKindEnd,
                    position: originalState.position,
                    error: lexPartialResult.error,
                }

            default:
                throw isNever(lexPartialResult);
        }
    }

    function lex(line: TLexerLine): PartialResult<LexerRead, LexerError.TLexerError> {
        if (!line.lineString.text) {
            return {
                kind: PartialResultKind.Ok,
                value: {
                    tokens: [],
                    positionStart: line.position,
                    positionEnd: line.position,
                    multilineKindEnd: LexerMultilineKind.Default,
                }
            };
        }

        const lineString = line.lineString;
        const text = lineString.text;
        const textLength = text.length;
        const positionStart = line.position;

        let currentPosition = positionStart;
        let continueLexing = positionStart.textIndex < textLength;

        if (!continueLexing) {
            return {
                kind: PartialResultKind.Err,
                error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
            }
        }

        const newTokens: LineToken[] = [];
        let maybeError: Option<LexerError.TLexerError>;
        let multilineKind = line.multilineKindEnd;
        while (continueLexing) {
            try {
                let token: LineToken;
                switch (multilineKind) {
                    case LexerMultilineKind.Default:
                        token = lexDefault(line);
                        break;

                    case LexerMultilineKind.Comment:
                    case LexerMultilineKind.QuotedIdentifier:
                    case LexerMultilineKind.String:
                        throw new Error("todo");

                    default:
                        throw isNever(multilineKind);
                }

                currentPosition = token.positionEnd;
                newTokens.push(token);

                if (currentPosition.textIndex === textLength) {
                    continueLexing = false;
                }
            }
            catch (e) {
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
                        multilineKindEnd: multilineKind,
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
                    multilineKindEnd: multilineKind,
                }
            }
        }
    }

    function lexDefault(line: TLexerLine): LineToken {
        const lineString = line.lineString;
        const text = lineString.text;
        const positionStart = line.position;

        let currentPosition = drainWhitespace(lineString, positionStart);
        const chr1: string = text[currentPosition.textIndex];
        let token: LineToken;

        if (chr1 === "!") { token = readConstant(TokenKind.Bang, lineString, currentPosition, 1); }
        else if (chr1 === "&") { token = readConstant(TokenKind.Ampersand, lineString, currentPosition, 1); }
        else if (chr1 === "(") { token = readConstant(TokenKind.LeftParenthesis, lineString, currentPosition, 1); }
        else if (chr1 === ")") { token = readConstant(TokenKind.RightParenthesis, lineString, currentPosition, 1); }
        else if (chr1 === "*") { token = readConstant(TokenKind.Asterisk, lineString, currentPosition, 1); }
        else if (chr1 === "+") { token = readConstant(TokenKind.Plus, lineString, currentPosition, 1); }
        else if (chr1 === ",") { token = readConstant(TokenKind.Comma, lineString, currentPosition, 1); }
        else if (chr1 === "-") { token = readConstant(TokenKind.Minus, lineString, currentPosition, 1); }
        else if (chr1 === ";") { token = readConstant(TokenKind.Semicolon, lineString, currentPosition, 1); }
        else if (chr1 === "?") { token = readConstant(TokenKind.QuestionMark, lineString, currentPosition, 1); }
        else if (chr1 === "@") { token = readConstant(TokenKind.AtSign, lineString, currentPosition, 1); }
        else if (chr1 === "[") { token = readConstant(TokenKind.LeftBracket, lineString, currentPosition, 1); }
        else if (chr1 === "]") { token = readConstant(TokenKind.RightBracket, lineString, currentPosition, 1); }
        else if (chr1 === "{") { token = readConstant(TokenKind.LeftBrace, lineString, currentPosition, 1); }
        else if (chr1 === "}") { token = readConstant(TokenKind.RightBrace, lineString, currentPosition, 1); }

        else if (chr1 === "\"") { throw new Error("not supported") }

        else if (chr1 === "0") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "x" || chr2 === "X") { token = readHexLiteral(lineString, currentPosition); }
            else { token = readNumericLiteral(lineString, currentPosition); }
        }

        else if ("1" <= chr1 && chr1 <= "9") { token = readNumericLiteral(lineString, currentPosition); }

        else if (chr1 === ".") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === undefined) {
                const LexerLinePosition = StringHelpers.graphemePositionAt(text, currentPosition.textIndex);
                throw new LexerError.UnexpectedEofError(LexerLinePosition);
            }
            else if ("1" <= chr2 && chr2 <= "9") { token = readNumericLiteral(lineString, currentPosition); }
            else if (chr2 === ".") {
                const chr3 = text[currentPosition.textIndex + 2];

                if (chr3 === ".") { token = readConstant(TokenKind.Ellipsis, lineString, currentPosition, 3); }
                else { throw unexpectedReadError(text, currentPosition.textIndex) }
            }
            else { throw unexpectedReadError(text, currentPosition.textIndex) }
        }

        else if (chr1 === ">") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "=") { token = readConstant(TokenKind.GreaterThanEqualTo, lineString, currentPosition, 2); }
            else { token = readConstant(TokenKind.GreaterThan, lineString, currentPosition, 1); }
        }

        else if (chr1 === "<") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "=") { token = readConstant(TokenKind.LessThanEqualTo, lineString, currentPosition, 2); }
            else if (chr2 === ">") { token = readConstant(TokenKind.NotEqual, lineString, currentPosition, 2); }
            else { token = readConstant(TokenKind.LessThan, lineString, currentPosition, 1) }
        }

        else if (chr1 === "=") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === ">") { token = readConstant(TokenKind.FatArrow, lineString, currentPosition, 2); }
            else { token = readConstant(TokenKind.Equal, lineString, currentPosition, 1); }
        }

        else if (chr1 === "/") {
            const chr2 = text[currentPosition.textIndex + 1];

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
            else { token = readConstant(TokenKind.Division, lineString, currentPosition, 1); }
        }

        else if (chr1 === "#") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "\"") { token = readQuotedIdentifier(lineString, currentPosition); }
            else { token = readKeyword(lineString, currentPosition); }
        }

        else { token = readKeywordOrIdentifier(lineString, currentPosition); }

        return token;
    }

    function drainWhitespace(
        lineString: LexerLineString,
        position: LexerLinePosition,
    ): LexerLinePosition {
        let textIndex = position.textIndex;
        let continueDraining = lineString.text[textIndex] !== undefined;

        while (continueDraining) {
            const maybeLength = StringHelpers.maybeRegexMatchLength(Pattern.RegExpWhitespace, lineString.text, textIndex);
            if (maybeLength) {
                textIndex += maybeLength;
            }
            else {
                continueDraining = false;
            }
        }

        return {
            ...position,
            textIndex,
        };
    }

    // function readStringLiteral(document: string, documentIndex: number): LineToken {
    //     const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex);
    //     if (stringEndIndex === undefined) {
    //         throw unterminatedStringError(document, documentIndex);
    //     }

    //     return readTokenFromSlice(document, documentIndex, TokenKind.StringLiteral, stringEndIndex + 1);
    // }

    function readHexLiteral(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineToken {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpHex, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            const LexerLinePosition = StringHelpers.graphemePositionAt(lineString.text, positionStart.textIndex);
            throw new LexerError.ExpectedHexLiteralError(LexerLinePosition);
        }
        const textIndexEnd: number = maybeTextIndexEnd;

        const positionEnd: LexerLinePosition = {
            textIndex: textIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
        }
        return readTokenFromPositions(TokenKind.HexLiteral, lineString, positionStart, positionEnd);
    }

    function readNumericLiteral(lineString: LexerLineString, positionStart: LexerLinePosition): LineToken {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            const LexerLinePosition = StringHelpers.graphemePositionAt(lineString.text, positionStart.textIndex);
            throw new LexerError.ExpectedNumericLiteralError(LexerLinePosition);
        }
        const textEndIndex: number = maybeTextIndexEnd;

        const positionEnd: LexerLinePosition = {
            textIndex: textEndIndex,
            columnNumber: lineString.textIndex2GraphemeIndex[textEndIndex],
        }
        return readTokenFromPositions(TokenKind.NumericLiteral, lineString, positionStart, positionEnd);
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
    //         const LexerLinePosition = StringHelpers.LexerLinePositionAt(document, documentStartIndex);
    //         throw new LexerError.UnterminatedMultilineCommentError(LexerLinePosition);
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

    function readKeyword(lineString: LexerLineString, positionStart: LexerLinePosition): LineToken {
        const maybeToken: Option<LineToken> = maybeReadKeyword(lineString, positionStart);
        if (maybeToken) {
            return maybeToken;
        }
        else {
            throw unexpectedReadError(lineString.text, positionStart.textIndex);
        }
    }

    function maybeReadKeyword(lineString: LexerLineString, positionStart: LexerLinePosition): Option<LineToken> {
        const text = lineString.text;

        const textStartIndex = positionStart.textIndex;
        const identifierTextIndexStart = text[textStartIndex] === "#"
            ? textStartIndex + 1
            : textStartIndex;

        const maybeIdentifierTextIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, identifierTextIndexStart);
        if (maybeIdentifierTextIndexEnd === undefined) {
            return undefined;
        }
        const textIndexEnd = maybeIdentifierTextIndexEnd;

        const substring = text.substring(textStartIndex, textIndexEnd);

        const maybeKeywordTokenKind = maybeKeywordTokenKindFrom(substring);
        if (maybeKeywordTokenKind === undefined) {
            return undefined;
        }
        else {
            return {
                kind: maybeKeywordTokenKind,
                positionStart,
                positionEnd: {
                    textIndex: textIndexEnd,
                    columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
                },
                data: substring,
            }
        }
    }

    function readQuotedIdentifier(_document: LexerLineString, _position: LexerLinePosition): LineToken {
        throw new Error("not supported");
        // const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex + 1);
        // if (stringEndIndex === undefined) {
        //     throw unterminatedStringError(document, documentIndex + 1);
        // }

        // return readTokenFromSlice(document, documentIndex, TokenKind.Identifier, stringEndIndex + 1);
    }

    // the quoted identifier case has already been taken care of
    // null-literal is also read here
    function readKeywordOrIdentifier(lineString: LexerLineString, positionStart: LexerLinePosition): LineToken {
        const text = lineString.text;
        const textIndexStart = positionStart.textIndex;

        // keyword
        if (text[textIndexStart] === "#") {
            return readKeyword(lineString, positionStart);
        }
        // either keyword or identifier
        else {
            const maybeTextIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, textIndexStart);
            if (maybeTextIndexEnd === undefined) {
                throw unexpectedReadError(text, textIndexStart);
            }
            const textIndexEnd = maybeTextIndexEnd;
            const substring = text.substring(textIndexStart, textIndexEnd);

            const maybeKeywordTokenKind = maybeKeywordTokenKindFrom(substring);

            let tokenKind;
            if (maybeKeywordTokenKind !== undefined) {
                tokenKind = maybeKeywordTokenKind;
            }
            else if (substring === "null") {
                tokenKind = TokenKind.NullLiteral;
            }
            else {
                tokenKind = TokenKind.Identifier;
            }

            return {
                kind: tokenKind,
                positionStart,
                positionEnd: {
                    textIndex: textIndexEnd,
                    columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
                },
                data: substring,
            }
        }
    }

    function readConstant(
        tokenKind: TokenKind,
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
        length: number,
    ): LineToken {
        const textIndexEnd = positionStart.textIndex + length;
        const positionEnd: LexerLinePosition = {
            textIndex: positionStart.textIndex + length,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd]
        }
        return readTokenFromPositions(tokenKind, lineString, positionStart, positionEnd);
    }

    function readTokenFromPositions(
        tokenKind: TokenKind,
        lineString: LexerLineString,
        startPosition: LexerLinePosition,
        positionEnd: LexerLinePosition,
    ): LineToken {
        return {
            kind: tokenKind,
            positionStart: startPosition,
            positionEnd: positionEnd,
            data: lineString.text.substring(startPosition.textIndex, positionEnd.textIndex),
        };
    }

    function maybeIndexOfRegexEnd(
        pattern: RegExp,
        text: string,
        textIndex: number,
    ): Option<number> {
        const maybeLength = StringHelpers.maybeRegexMatchLength(pattern, text, textIndex);

        return maybeLength !== undefined
            ? textIndex + maybeLength
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
        text: string,
        textIndex: number,
    ): LexerError.UnexpectedReadError {
        const LexerLinePosition = StringHelpers.graphemePositionAt(text, textIndex);
        return new LexerError.UnexpectedReadError(LexerLinePosition);
    }

    // function unterminatedStringError(
    //     text: string,
    //     textIndex: number,
    // ): LexerError.UnterminatedStringError {
    //     const LexerLinePosition = StringHelpers.graphemePositionAt(text, textIndex);
    //     return new LexerError.UnterminatedStringError(LexerLinePosition);
    // }
}