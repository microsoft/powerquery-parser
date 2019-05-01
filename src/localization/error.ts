import { Option } from "../common/option";
import { TokenKind, Token, Lexer } from "../lexer";
import { Ast } from "../parser";
import { StringHelpers } from "../common";

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

    export function lexerBadState(): string {
        return `The lexer encountered an error last run. Either feed the lexer more text or review lastError.`;
    }

    export function lexerEndOfStream(): string {
        return `The lexer reached end-of-stream.`;
    }

    export function lexerExpectedHexLiteral(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Expected hex literal on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerExpectedKeywordOrIdentifier(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Expected keyword or identifier on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerExpectedNumericLiteral(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Expected numeric literal on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
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

    export function lexerUnterminatedMultilineComment(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unterminated multiline comment starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerUnterminatedQuotedIdentifier(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unterminated quoted identifier starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerUnterminatedString(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unterminated string starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
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
