// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { isNever, StringHelpers } from "../common";
import { Option } from "../common/option";
import { Lexer, LexerError, Token, TokenKind } from "../lexer";
import { Ast } from "../parser";

export namespace Localization.Error {

    export function invariantError(reason: string, maybeJsonifyable: Option<any>): string {
        if (maybeJsonifyable !== undefined) {
            return `InvariantError: ${reason} - ${JSON.stringify(maybeJsonifyable, null, 4)}`;
        }
        else {
            return `InvariantError: ${reason}`;
        }
    }

    export function notYetImplemented(reason: string, maybeJsonifyable: Option<any>): string {
        if (maybeJsonifyable !== undefined) {
            return `NotYetImplemented: ${reason} - ${JSON.stringify(maybeJsonifyable, null, 4)}`;
        }
        else {
            return `NotYetImplemented: ${reason}`;
        }
    }

    export function unknownError(innerError: any): string {
        return `An unknown error was encountered, innerError: ${innerError}`
    }

    export function lexerBadLineNumber(kind: LexerError.BadLineNumberKind, lineNumber: number, numLines: number): string {
        switch (kind) {
            case LexerError.BadLineNumberKind.GreaterThanNumLines:
                return `lineNumber (${lineNumber}) is greater than or equal to number of lines (${numLines}).`;

            case LexerError.BadLineNumberKind.LessThanZero:
                return `lineNumber (${lineNumber}) is less than zero.`;

            default:
                throw isNever(kind);
        }
    }

    export function lexerBadRange(kind: LexerError.BadRangeKind): string {
        switch (kind) {
            case LexerError.BadRangeKind.SameLine_LineCodeUnitStart_Higher:
                return `Start and end shared the same line, but start.lineCodeUnit was higher than end.lineCodeUnit.`;

            case LexerError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd:
                return `start.lineNumber is larger than end.lineNumber.`;

            case LexerError.BadRangeKind.LineNumberStart_LessThan_Zero:
                return `start.lineNumber is less than 0.`;

            case LexerError.BadRangeKind.LineNumberStart_GreaterThan_NumLines:
                return `start.lineNumber is higher than State's number of lines.`;

            case LexerError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines:
                return `end.lineNumber is higher than State's number of lines.`;

            case LexerError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength:
                return `start.lineCodeUnit is higher than line's length.`;

            case LexerError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength:
                return `end.lineCodeUnit is higher than line's length.`;

            default:
                throw isNever(kind);
        }
    }

    export function lexerBadState(): string {
        return `The lexer encountered an error last run. Either feed the lexer more text or review lastError.`;
    }

    export function lexerEndOfStream(): string {
        return `The lexer reached end-of-stream.`;
    }

    export function lexerExpected(
        graphemePosition: StringHelpers.GraphemePosition,
        kind: LexerError.ExpectedKind,
    ): string {
        switch (kind) {
            case LexerError.ExpectedKind.HexLiteral:
                return `Expected hex literal on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;

            case LexerError.ExpectedKind.KeywordOrIdentifier:
                return `Expected keyword or identifier on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;

            case LexerError.ExpectedKind.Numeric:
                return `Expected numeric literal on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;

            default:
                throw isNever(kind);
        }
    }

    export function lexerLineError(errors: Lexer.TErrorLines): string {
        return `Error on line(s): ${Object.keys(errors).join(", ")}`;
    }

    export function lexerUnexpectedEof(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Reached EOF while attempting to lex on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`
    }

    export function lexerUnexpectedRead(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unexpected read while attempting to lex on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerUnterminatedMultilineToken(
        graphemePosition: StringHelpers.GraphemePosition,
        kind: LexerError.UnterminatedMultilineToken,
    ): string {
        switch (kind) {
            case LexerError.UnterminatedMultilineToken.MultilineComment:
                return `Unterminated multiline comment starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;

            case LexerError.UnterminatedMultilineToken.QuotedIdentifier:
                return `Unterminated quoted identifier starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;

            case LexerError.UnterminatedMultilineToken.String:
                return `Unterminated multiline comment starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
                
            default:
                throw isNever(kind);
        }
    }

    export function parserExpectedTokenKind(
        expectedTokenKind: TokenKind,
        maybeFoundToken: Option<Token>,
    ): string {
        if (maybeFoundToken) {
            const token = maybeFoundToken;
            const positionStart = token.positionStart;
            return `Expected to find a ${expectedTokenKind} on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}, but a ${token.kind} was found instead.`;
        }
        else {
            return `Expected to find a ${expectedTokenKind} but the end-of-file was reached instead.`;
        }
    }

    export function parserInvalidLiteralValue(
        currentTokenData: string,
        token: Token,
    ): string {
        const positionStart = token.positionStart;
        return `Expected to find a literal on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}, but ${currentTokenData} was found instead.`;
    }

    export function parserInvalidPrimitiveType(
        token: Token,
    ): string {
        const positionStart = token.positionStart;
        return `Expected to find a primitive literal on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}, but ${token.data} was found instead.`;
    }

    export function parserExpectedAnyTokenKind(
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        maybeFoundToken: Option<Token>,
    ): string {
        if (maybeFoundToken) {
            const token = maybeFoundToken;
            const positionStart = maybeFoundToken.positionStart;
            return `Expected to find one of the following on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}, but a ${token.kind} was found instead: [${expectedAnyTokenKind}].`;
        }
        else {
            return `Expected to find one of the following, but the end-of-file was reached instead: [${expectedAnyTokenKind}].`;
        }
    }

    export function parserRequiredParameterAfterOptionalParameter(missingOptionalToken: Token): string {
        const positionStart = missingOptionalToken.positionStart
        return `Cannot have a non-optional parameter after an optional parameter. Line ${positionStart.lineNumber}, column ${positionStart.columnNumber}.`;
    }

    export function parserUnexpectedEndOfTokens(nodeKindOnStack: Ast.NodeKind): string {
        return `Reached end of tokens while attempting to parse ${nodeKindOnStack}.`
    }

    export function parserUnterminatedBracket(openBracketToken: Token): string {
        const positionStart = openBracketToken.positionStart;
        return `Unterminated bracket starting on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}.`
    }

    export function parserUnterminatedParentheses(openParenthesesToken: Token): string {
        const positionStart = openParenthesesToken.positionStart;
        return `Unterminated parentheses starting on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}.`
    }

    export function parserUnusedTokensRemain(firstUnusedToken: Token): string {
        const positionStart = firstUnusedToken.positionStart;
        return `Finished parsing, but more tokens remain starting on line ${positionStart.lineNumber}, column ${positionStart.columnNumber}.`;
    }

}
