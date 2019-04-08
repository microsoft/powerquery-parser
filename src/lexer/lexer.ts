import { CommonError, Pattern, StringHelpers } from "../common";
import { isNever } from "../common/assert";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { CommentKind, LineComment, MultilineComment, TComment } from "./comment";
import { LexerError } from "./error";
import { Keyword, Keywords } from "./keywords";
import { LexerSnapshot as LexerSnapshot } from "./lexerSnapshot";
import { Token, TokenKind } from "./token";

export namespace Lexer {

    export type TLexer = (
        | TouchedLexer
        | TouchedWithErrorLexer
        | ErrorLexer
        | UntouchedLexer
    )

    export type TLexerExceptUntouched = Exclude<TLexer, UntouchedLexer>;

    export interface ILexer {
        readonly kind: LexerKind,
        readonly document: string,
        readonly tokens: ReadonlyArray<Token>,       // all tokens read up to this point
        readonly comments: ReadonlyArray<TComment>,  // all comments read up to this point
        readonly documentIndex: number, // where the lexer left off, can be EOF
    }

    // the last read attempt didn't read any new tokens/comments (though possibly whitespace),
    // and encountered an error such as: unterminated string, eof, expected hex literal, etc.
    export interface ErrorLexer extends ILexer {
        readonly kind: LexerKind.Error,
        readonly error: LexerError.TLexerError,
    }

    // the last read attempt succeeded without encountering an error.
    // possible that only whitespace was consumed.
    export interface TouchedLexer extends ILexer {
        readonly kind: LexerKind.Touched,
        readonly lastRead: LexerRead,
    }

    // the last read attempt read at least one token or comment before encountering an error
    export interface TouchedWithErrorLexer extends ILexer {
        readonly kind: LexerKind.TouchedWithError,
        readonly lastRead: LexerRead,
        readonly error: LexerError.TLexerError,
    }

    // a call to appendtToDocument clears existing state marking it ready to be lexed
    export interface UntouchedLexer extends ILexer {
        readonly kind: LexerKind.Untouched,
        readonly maybeLastRead: Option<LexerRead>,
    }

    export const enum LexerKind {
        Error = "Error",
        Touched = "Touched",                    // a call to lex returned PartialResultKind.Ok
        TouchedWithError = "TouchedWithError",  // a call to lex returned PartialResultKind.Partial
        Untouched = "Untouched",                // the last Lexer action was appendToDocument
    }

    // what was read on a call to lex
    export interface LexerRead {
        readonly tokens: ReadonlyArray<Token>,
        readonly comments: ReadonlyArray<TComment>,
        readonly documentStartIndex: number,
        readonly documentEndIndex: number,
    }

    // create a new default state Lexer for the given document
    export function from(document: string): TLexer {
        return {
            kind: LexerKind.Untouched,
            document: document,
            tokens: [],
            comments: [],
            documentIndex: 0,
            maybeLastRead: undefined,
        }
    }

    // resets TLexerKind to UntouchedLexer
    export function appendToDocument(lexer: TLexer, toAppend: string): UntouchedLexer {
        const newDocument = lexer.document + toAppend;
        switch (lexer.kind) {
            case LexerKind.Error:
                return {
                    kind: LexerKind.Untouched,
                    document: newDocument,
                    tokens: lexer.tokens,
                    comments: lexer.comments,
                    documentIndex: lexer.documentIndex,
                    maybeLastRead: undefined,
                };

            case LexerKind.Touched:
                return {
                    kind: LexerKind.Untouched,
                    document: newDocument,
                    tokens: lexer.tokens,
                    comments: lexer.comments,
                    documentIndex: lexer.documentIndex,
                    maybeLastRead: lexer.lastRead,
                };

            case LexerKind.TouchedWithError:
                return {
                    kind: LexerKind.Untouched,
                    document: newDocument,
                    tokens: lexer.tokens,
                    comments: lexer.comments,
                    documentIndex: lexer.documentIndex,
                    maybeLastRead: undefined,
                };

            case LexerKind.Untouched:
                return {
                    ...lexer,
                    document: newDocument,
                };
        }
    }

    // get a copy of all document, tokens, and comments lexed up to this point
    export function snapshot(lexer: TLexer): LexerSnapshot {
        return new LexerSnapshot(
            lexer.document,
            lexer.tokens,
            lexer.comments,
        )
    }

    // lex one token and all comments before that token
    export function next(lexer: TLexer): TLexerExceptUntouched {
        return lex(lexer, LexerStrategy.SingleToken);
    }

    // lex until EOF or an error occurs
    export function remaining(state: TLexer): TLexerExceptUntouched {
        return lex(state, LexerStrategy.UntilEofOrError);
    }

    export function hasError(lexer: TLexer): lexer is (ErrorLexer | TouchedWithErrorLexer) {
        switch (lexer.kind) {
            case LexerKind.Error:
            case LexerKind.TouchedWithError:
                return true;

            case LexerKind.Touched:
            case LexerKind.Untouched:
                return false;

            default:
                throw isNever(lexer);
        }
    }

    function lex(state: TLexer, strategy: LexerStrategy): TLexerExceptUntouched {
        switch (state.kind) {
            case LexerKind.Touched:
            case LexerKind.Untouched:
                const lexerRead = read(state, strategy);
                const newState = updateState(state, lexerRead);
                return newState;

            case LexerKind.Error:
                return state;

            case LexerKind.TouchedWithError:
                return {
                    kind: LexerKind.Error,
                    tokens: state.tokens,
                    comments: state.comments,
                    document: state.document,
                    documentIndex: state.documentIndex,
                    error: new LexerError.LexerError(new LexerError.BadStateError(state.error)),
                };

            default:
                throw isNever(state);
        }
    }

    function updateState(originalState: TLexer, lexerReadPartialResult: PartialResult<LexerRead, LexerError.TLexerError>): TLexerExceptUntouched {
        switch (lexerReadPartialResult.kind) {
            case PartialResultKind.Ok: {
                const lexerRead: LexerRead = lexerReadPartialResult.value;
                const newTokens: ReadonlyArray<Token> = originalState.tokens.concat(lexerRead.tokens);
                const newComments: ReadonlyArray<TComment> = originalState.comments.concat(lexerRead.comments);

                return {
                    kind: LexerKind.Touched,
                    document: originalState.document,
                    tokens: newTokens,
                    comments: newComments,
                    documentIndex: lexerRead.documentEndIndex,
                    lastRead: lexerRead,
                }
            }

            case PartialResultKind.Partial: {
                const lexerRead: LexerRead = lexerReadPartialResult.value;
                const newTokens: ReadonlyArray<Token> = originalState.tokens.concat(lexerRead.tokens);
                const newComments: ReadonlyArray<TComment> = originalState.comments.concat(lexerRead.comments);
                
                return {
                    kind: LexerKind.TouchedWithError,
                    document: originalState.document,
                    tokens: newTokens,
                    comments: newComments,
                    documentIndex: lexerRead.documentEndIndex,
                    lastRead: lexerRead,
                    error: lexerReadPartialResult.error,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LexerKind.Error,
                    document: originalState.document,
                    tokens: originalState.tokens,
                    comments: originalState.comments,
                    documentIndex: originalState.documentIndex,
                    error: lexerReadPartialResult.error,
                }

            default:
                throw isNever(lexerReadPartialResult);
        }
    }

    function read(state: TLexer, behavior: LexerStrategy): PartialResult<LexerRead, LexerError.TLexerError> {
        const document = state.document;
        const documentLength = document.length;
        const documentStartIndex = state.documentIndex;

        let documentIndex = documentStartIndex;
        let continueLexing = documentIndex < documentLength;

        if (!continueLexing) {
            return {
                kind: PartialResultKind.Err,
                error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
            }
        }

        const newTokens: Token[] = [];
        const newComments: TComment[] = [];
        let maybeError: Option<LexerError.TLexerError>;
        while (continueLexing) {
            documentIndex = drainWhitespace(document, documentIndex);

            const chr = state.document[documentIndex];
            if (chr === undefined) {
                break;
            }

            const newlineKind = StringHelpers.maybeNewlineKindAt(document, documentIndex);

            if (newlineKind === StringHelpers.NewlineKind.SingleCharacter) {
                documentIndex += 1;
                continue;
            }
            else if (newlineKind === StringHelpers.NewlineKind.DoubleCharacter) {
                documentIndex += 2;
                continue;
            }

            try {
                let token: Token;

                if (chr === "!") { token = readConstantToken(documentIndex, TokenKind.Bang, chr); }
                else if (chr === "&") { token = readConstantToken(documentIndex, TokenKind.Ampersand, chr); }
                else if (chr === "(") { token = readConstantToken(documentIndex, TokenKind.LeftParenthesis, chr); }
                else if (chr === ")") { token = readConstantToken(documentIndex, TokenKind.RightParenthesis, chr); }
                else if (chr === "*") { token = readConstantToken(documentIndex, TokenKind.Asterisk, chr); }
                else if (chr === "+") { token = readConstantToken(documentIndex, TokenKind.Plus, chr); }
                else if (chr === ",") { token = readConstantToken(documentIndex, TokenKind.Comma, chr); }
                else if (chr === "-") { token = readConstantToken(documentIndex, TokenKind.Minus, chr); }
                else if (chr === ";") { token = readConstantToken(documentIndex, TokenKind.Semicolon, chr); }
                else if (chr === "?") { token = readConstantToken(documentIndex, TokenKind.QuestionMark, chr); }
                else if (chr === "@") { token = readConstantToken(documentIndex, TokenKind.AtSign, chr); }
                else if (chr === "[") { token = readConstantToken(documentIndex, TokenKind.LeftBracket, chr); }
                else if (chr === "]") { token = readConstantToken(documentIndex, TokenKind.RightBracket, chr); }
                else if (chr === "{") { token = readConstantToken(documentIndex, TokenKind.LeftBrace, chr); }
                else if (chr === "}") { token = readConstantToken(documentIndex, TokenKind.RightBrace, chr); }

                else if (chr === "\"") { token = readStringLiteral(document, documentIndex); }

                else if (chr === "0") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === "x" || secondChr === "X") { token = readHexLiteral(document, documentIndex); }
                    else { token = readNumericLiteral(document, documentIndex); }
                }

                else if ("1" <= chr && chr <= "9") { token = readNumericLiteral(document, documentIndex); }

                else if (chr === ".") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === undefined) {
                        const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
                        throw new LexerError.UnexpectedEofError(graphemePosition);
                    }
                    else if ("1" <= secondChr && secondChr <= "9") { token = readNumericLiteral(document, documentIndex); }
                    else if (secondChr === ".") {
                        const thirdChr = document[documentIndex + 2];

                        if (thirdChr === ".") { token = readConstantToken(documentIndex, TokenKind.Ellipsis, "..."); }
                        else { throw unexpectedReadError(document, documentIndex) }
                    }
                    else { throw unexpectedReadError(document, documentIndex) }
                }

                else if (chr === ">") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === "=") { token = readConstantToken(documentIndex, TokenKind.GreaterThanEqualTo, ">="); }
                    else { token = readConstantToken(documentIndex, TokenKind.GreaterThan, chr); }
                }

                else if (chr === "<") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === "=") { token = readConstantToken(documentIndex, TokenKind.LessThanEqualTo, "<="); }
                    else if (secondChr === ">") { token = readConstantToken(documentIndex, TokenKind.NotEqual, "<>"); }
                    else { token = readConstantToken(documentIndex, TokenKind.LessThan, chr) }
                }

                else if (chr === "=") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === ">") { token = readConstantToken(documentIndex, TokenKind.FatArrow, "=>"); }
                    else { token = readConstantToken(documentIndex, TokenKind.Equal, chr); }
                }

                else if (chr === "/") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === "/") {
                        const phantomTokenIndex = state.tokens.length + newTokens.length;
                        const commentRead = readComments(document, documentIndex, CommentKind.Line, phantomTokenIndex);
                        documentIndex = commentRead[commentRead.length - 1].documentEndIndex;
                        newComments.push(...commentRead);
                        continue;
                    }
                    else if (secondChr === "*") {
                        const phantomTokenIndex = state.tokens.length + newTokens.length;
                        const commentRead = readComments(document, documentIndex, CommentKind.Multiline, phantomTokenIndex);
                        documentIndex = commentRead[commentRead.length - 1].documentEndIndex;
                        newComments.push(...commentRead);
                        continue;
                    }
                    else { token = readConstantToken(documentIndex, TokenKind.Division, chr); }
                }

                else if (chr === "#") {
                    const secondChr = document[documentIndex + 1];

                    if (secondChr === "\"") { token = readQuotedIdentifier(document, documentIndex); }
                    else { token = readKeyword(document, documentIndex, undefined); }
                }

                else { token = readKeywordOrIdentifier(document, documentIndex); }

                documentIndex = token.documentEndIndex;
                newTokens.push(token);

                if (behavior === LexerStrategy.SingleToken || documentIndex === documentLength) {
                    continueLexing = false;
                }

            } catch (e) {
                let error: LexerError.TLexerError;
                if (LexerError.isTInnerLexerError(e)) {
                    error = new LexerError.LexerError(e);
                }
                else {
                    error = CommonError.ensureWrappedError(e);
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
                        comments: newComments,
                        documentStartIndex,
                        documentEndIndex: documentIndex,
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
                    comments: newComments,
                    documentStartIndex,
                    documentEndIndex: documentIndex,
                }
            }
        }
    }

    function drainWhitespace(document: string, documentIndex: number): number {
        while (document[documentIndex] !== undefined) {
            const maybeLength = StringHelpers.regexMatchLength(Pattern.RegExpWhitespace, document, documentIndex);
            if (maybeLength) {
                documentIndex += maybeLength;
            }
            else {
                break;
            }
        }

        return documentIndex;
    }

    function readStringLiteral(document: string, documentIndex: number): Token {
        const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex);
        if (stringEndIndex === undefined) {
            throw unterminatedStringError(document, documentIndex);
        }

        return readTokenFromSlice(document, documentIndex, TokenKind.StringLiteral, stringEndIndex + 1);
    }

    function readHexLiteral(document: string, documentIndex: number): Token {
        const hexEndIndex = indexOfRegexEnd(Pattern.RegExpHex, document, documentIndex);
        if (hexEndIndex === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
            throw new LexerError.ExpectedHexLiteralError(graphemePosition);
        }

        return readTokenFromSlice(document, documentIndex, TokenKind.HexLiteral, hexEndIndex);
    }

    function readNumericLiteral(document: string, documentIndex: number): Token {
        const numericEndIndex = indexOfRegexEnd(Pattern.RegExpNumeric, document, documentIndex);
        if (numericEndIndex === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
            throw new LexerError.ExpectedNumericLiteralError(graphemePosition);
        }

        return readTokenFromSlice(document, documentIndex, TokenKind.NumericLiteral, numericEndIndex);
    }

    function readComments(
        document: string,
        documentIndex: number,
        initial: CommentKind,
        phantomTokenIndex: number
    ): ReadonlyArray<TComment> {
        let maybeNextCommentKind: Option<CommentKind> = initial;
        let chr1 = document[documentIndex];
        let chr2 = document[documentIndex + 1];

        const comments = [];
        while (maybeNextCommentKind) {
            let comment: TComment;
            switch (maybeNextCommentKind) {
                case CommentKind.Line:
                    comment = readLineComment(document, documentIndex, phantomTokenIndex)
                    break;

                case CommentKind.Multiline:
                    comment = readMultilineComment(document, documentIndex, phantomTokenIndex);
                    break;

                default:
                    throw isNever(maybeNextCommentKind)
            }

            documentIndex = comment.documentEndIndex;
            comments.push(comment);

            chr1 = document[documentIndex];
            chr2 = document[documentIndex + 1];
            // line comment
            if (chr1 === "/" && chr2 === "/") {
                maybeNextCommentKind = CommentKind.Line;
            }
            // multiline comment
            else if (chr1 === "/" && chr2 === "*") {
                maybeNextCommentKind = CommentKind.Multiline;
            }
            else {
                maybeNextCommentKind = undefined;
            }
        }

        return comments;
    }

    function readLineComment(document: string, documentIndex: number, phantomTokenIndex: number): LineComment {
        const documentLength = document.length;
        const commentStart = documentIndex;

        let maybeLiteral: Option<string>;
        let commentEnd = commentStart + 2;

        while (!maybeLiteral && commentEnd < documentLength) {
            const maybeNewlineKind = StringHelpers.maybeNewlineKindAt(document, commentEnd);
            if (maybeNewlineKind) {
                switch (maybeNewlineKind) {
                    case StringHelpers.NewlineKind.DoubleCharacter:
                        maybeLiteral = document.substring(commentStart, commentEnd);
                        documentIndex = commentEnd + 2;
                        break;

                    case StringHelpers.NewlineKind.SingleCharacter:
                        maybeLiteral = document.substring(commentStart, commentEnd);
                        documentIndex = commentEnd + 1;
                        break;

                    default:
                        throw isNever(maybeNewlineKind);
                }
            }
            else {
                commentEnd += 1;
            }
        }

        // reached EOF without a trailing newline
        if (!maybeLiteral) {
            maybeLiteral = document.substring(commentStart, document.length);
            documentIndex = document.length;
        }

        return {
            kind: CommentKind.Line,
            literal: maybeLiteral,
            phantomTokenIndex,
            containsNewline: true,
            documentStartIndex: commentStart,
            documentEndIndex: documentIndex,
        }
    }

    function readMultilineComment(document: string, documentIndex: number, phantomTokenIndex: number): MultilineComment {
        const documentStartIndex = documentIndex;
        const indexOfCommentEnd = document.indexOf("*/", documentStartIndex + 2);
        if (indexOfCommentEnd === -1) {
            const graphemePosition = StringHelpers.graphemePositionAt(document, documentStartIndex);
            throw new LexerError.UnterminatedMultilineCommentError(graphemePosition);
        }

        const documentEndIndex = indexOfCommentEnd + 2;
        const literal = document.substring(documentStartIndex, documentEndIndex);

        return {
            kind: CommentKind.Multiline,
            literal,
            phantomTokenIndex,
            containsNewline: StringHelpers.containsNewline(literal),
            documentStartIndex,
            documentEndIndex,
        }
    }

    function readQuotedIdentifier(document: string, documentIndex: number): Token {
        const stringEndIndex = maybeIndexOfStringEnd(document, documentIndex + 1);
        if (stringEndIndex === undefined) {
            throw unterminatedStringError(document, documentIndex + 1);
        }

        return readTokenFromSlice(document, documentIndex, TokenKind.Identifier, stringEndIndex + 1);
    }

    function readKeyword(document: string, documentIndex: number, maybeSubstring: Option<string>): Token {
        if (maybeSubstring === undefined) {
            maybeSubstring = maybeKeywordOrIdentifierSubstring(document, documentIndex);
            if (maybeSubstring === undefined) {
                throw unexpectedReadError(document, documentIndex);
            }
        }
        const substring = maybeSubstring;

        switch (substring) {
            case Keyword.And:
                return readConstantToken(documentIndex, TokenKind.KeywordAnd, substring);
            case Keyword.As:
                return readConstantToken(documentIndex, TokenKind.KeywordAs, substring);
            case Keyword.Each:
                return readConstantToken(documentIndex, TokenKind.KeywordEach, substring);
            case Keyword.Else:
                return readConstantToken(documentIndex, TokenKind.KeywordElse, substring);
            case Keyword.Error:
                return readConstantToken(documentIndex, TokenKind.KeywordError, substring);
            case Keyword.False:
                return readConstantToken(documentIndex, TokenKind.KeywordFalse, substring);
            case Keyword.If:
                return readConstantToken(documentIndex, TokenKind.KeywordIf, substring);
            case Keyword.In:
                return readConstantToken(documentIndex, TokenKind.KeywordIn, substring);
            case Keyword.Is:
                return readConstantToken(documentIndex, TokenKind.KeywordIs, substring);
            case Keyword.Let:
                return readConstantToken(documentIndex, TokenKind.KeywordLet, substring);
            case Keyword.Meta:
                return readConstantToken(documentIndex, TokenKind.KeywordMeta, substring);
            case Keyword.Not:
                return readConstantToken(documentIndex, TokenKind.KeywordNot, substring);
            case Keyword.Or:
                return readConstantToken(documentIndex, TokenKind.KeywordOr, substring);
            case Keyword.Otherwise:
                return readConstantToken(documentIndex, TokenKind.KeywordOtherwise, substring);
            case Keyword.Section:
                return readConstantToken(documentIndex, TokenKind.KeywordSection, substring);
            case Keyword.Shared:
                return readConstantToken(documentIndex, TokenKind.KeywordShared, substring);
            case Keyword.Then:
                return readConstantToken(documentIndex, TokenKind.KeywordThen, substring);
            case Keyword.True:
                return readConstantToken(documentIndex, TokenKind.KeywordTrue, substring);
            case Keyword.Try:
                return readConstantToken(documentIndex, TokenKind.KeywordTry, substring);
            case Keyword.Type:
                return readConstantToken(documentIndex, TokenKind.KeywordType, substring);
            case Keyword.HashBinary:
                return readConstantToken(documentIndex, TokenKind.KeywordHashBinary, substring);
            case Keyword.HashDate:
                return readConstantToken(documentIndex, TokenKind.KeywordHashDate, substring);
            case Keyword.HashDateTime:
                return readConstantToken(documentIndex, TokenKind.KeywordHashDateTime, substring);
            case Keyword.HashDateTimeZone:
                return readConstantToken(documentIndex, TokenKind.KeywordHashDateTimeZone, substring);
            case Keyword.HashDuration:
                return readConstantToken(documentIndex, TokenKind.KeywordHashDuration, substring);
            case Keyword.HashInfinity:
                return readConstantToken(documentIndex, TokenKind.KeywordHashInfinity, substring);
            case Keyword.HashNan:
                return readConstantToken(documentIndex, TokenKind.KeywordHashNan, substring);
            case Keyword.HashSections:
                return readConstantToken(documentIndex, TokenKind.KeywordHashSections, substring);
            case Keyword.HashShared:
                return readConstantToken(documentIndex, TokenKind.KeywordHashShared, substring);
            case Keyword.HashTable:
                return readConstantToken(documentIndex, TokenKind.KeywordHashTable, substring);
            case Keyword.HashTime:
                return readConstantToken(documentIndex, TokenKind.KeywordHashTime, substring);
            default:
                throw new CommonError.InvariantError("unknown keyword", { keyword: substring });
        }
    }

    function readKeywordOrIdentifier(document: string, documentIndex: number): Token {
        const maybeSubstring = maybeKeywordOrIdentifierSubstring(document, documentIndex);
        if (maybeSubstring === undefined) {
            const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
            throw new LexerError.ExpectedKeywordOrIdentifierError(graphemePosition);
        }
        const substring = maybeSubstring;

        if (substring[0] === "#" || Keywords.indexOf(substring) !== -1) {
            return readKeyword(document, documentIndex, substring);
        }
        else if (substring === "null") {
            const documentStartIndex = documentIndex;
            const documentEndIndex = documentStartIndex + 4;
            return {
                kind: TokenKind.NullLiteral,
                documentStartIndex,
                documentEndIndex,
                data: "null",
            }
        }
        else {
            return readTokenFromSubstring(documentIndex, TokenKind.Identifier, substring);
        }
    }

    function maybeKeywordOrIdentifierSubstring(document: string, documentIndex: number): Option<string> {
        const chr = document[documentIndex];

        let indexOfStart = documentIndex;
        if (chr === "#") {
            indexOfStart += 1;
        }

        const identifierEndIndex = indexOfRegexEnd(Pattern.RegExpIdentifier, document, indexOfStart);
        if (identifierEndIndex !== -1) {
            return document.substring(documentIndex, identifierEndIndex);
        }
        else {
            return undefined;
        }
    }

    function readConstantToken(documentStartIndex: number, tokenKind: TokenKind, data: string): Token {
        return {
            kind: tokenKind,
            documentStartIndex,
            documentEndIndex: documentStartIndex + data.length,
            data,
        };
    }

    function readTokenFromSlice(
        document: string,
        documentIndex: number,
        tokenKind: TokenKind,
        documentIndexEnd: number,
    ): Token {
        const data = document.substring(documentIndex, documentIndexEnd);
        return readTokenFromSubstring(documentIndex, tokenKind, data);
    }

    function readTokenFromSubstring(
        documentStartIndex: number,
        tokenKind: TokenKind,
        data: string,
    ): Token {
        const documentEndIndex = documentStartIndex + data.length;
        return {
            kind: tokenKind,
            documentStartIndex,
            documentEndIndex,
            data,
        };
    }

    function indexOfRegexEnd(
        pattern: RegExp,
        document: string,
        documentStartIndex: number,
    ): Option<number> {
        const matchLength = StringHelpers.regexMatchLength(pattern, document, documentStartIndex);
        if (matchLength) {
            return documentStartIndex + matchLength;
        }
        else {
            return undefined;
        }
    }

    function maybeIndexOfStringEnd(
        document: string,
        documentStartIndex: number,
    ): Option<number> {
        let documentIndex = documentStartIndex + 1;
        let indexOfDoubleQuote = document.indexOf("\"", documentIndex)

        while (indexOfDoubleQuote !== -1) {
            if (document[indexOfDoubleQuote + 1] == "\"") {
                documentIndex = indexOfDoubleQuote + 2;
                indexOfDoubleQuote = document.indexOf("\"", documentIndex);
            }
            else {
                return indexOfDoubleQuote;
            }
        }

        return undefined;
    }

    function unexpectedReadError(
        document: string,
        documentIndex: number,
    ): LexerError.UnexpectedReadError {
        const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
        return new LexerError.UnexpectedReadError(graphemePosition);
    }

    function unterminatedStringError(
        document: string,
        documentIndex: number,
    ): LexerError.UnterminatedStringError {
        const graphemePosition = StringHelpers.graphemePositionAt(document, documentIndex);
        return new LexerError.UnterminatedStringError(graphemePosition);
    }

    const enum LexerStrategy {
        SingleToken = "SingleToken",
        UntilEofOrError = "UntilEofOrError"
    }
}