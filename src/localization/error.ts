import { Option } from "../common/option";
import { TokenKind, TokenPosition } from "../lexer";
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

    export function lexerUnexpectedEof(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Reached EOF while attempting to lex on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`
    }

    export function lexerUnexpectedRead(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unexpected read while attempting to lex on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerUnterminatedMultilineComment(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unterminated multiline comment starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function lexerUnterminatedString(graphemePosition: StringHelpers.GraphemePosition): string {
        return `Unterminated string starting on line ${graphemePosition.lineNumber}, column ${graphemePosition.columnNumber}.`;
    }

    export function parserExpectedTokenKind(
        expectedTokenKind: TokenKind,
        maybeFoundTokenPosition: Option<TokenPosition>,
    ): string {
        if (maybeFoundTokenPosition) {
            const position = maybeFoundTokenPosition;
            return `Expected to find a ${expectedTokenKind} on line ${position.lineNumber}, column ${position.columnNumber}, but a ${position.token.kind} was found instead.`;
        }
        else {
            return `Expected to find a ${expectedTokenKind} but the end-of-file was reached instead.`;
        }
    }

    export function parserInvalidLiteralValue(
        currentTokenData: string,
        tokenPosition: TokenPosition,
    ): string {
        return `Expected to find a literal on line ${tokenPosition.lineNumber}, column ${tokenPosition.columnNumber}, but ${currentTokenData} was found instead.`;
    }

    export function parserInvalidPrimitiveType(
        foundIdentifier: string,
        tokenPosition: TokenPosition,
    ): string {
        return `Expected to find a primitive literal on line ${tokenPosition.lineNumber}, column ${tokenPosition.columnNumber}, but ${foundIdentifier} was found instead.`;
    }

    export function parserExpectedAnyTokenKind(
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        maybeFoundTokenPosition: Option<TokenPosition>,
    ): string {
        if (maybeFoundTokenPosition) {
            const position = maybeFoundTokenPosition;
            return `Expected to find one of the following on line ${position.lineNumber}, column ${position.columnNumber}, but a ${position.token.kind} was found instead: [${expectedAnyTokenKind}].`;
        }
        else {
            return `Expected to find one of the following, but the end-of-file was reached instead: [${expectedAnyTokenKind}].`;
        }
    }

    export function parserRequiredParameterAfterOptionalParameter(missingOptionalTokenPosition: TokenPosition): string {
        return `Cannot have a non-optional parameter after an optional parameter. Line ${missingOptionalTokenPosition.lineNumber}, column ${missingOptionalTokenPosition.columnNumber}.`;
    }

    export function parserUnexpectedEndOfTokens(nodeKindOnStack: Ast.NodeKind): string {
        return `Reached end of tokens while attempting to parse ${nodeKindOnStack}.`
    }

    export function parserUnterminatedBracket(openBracketTokenPosition: TokenPosition): string {
        return `Unterminated bracket starting on line ${openBracketTokenPosition.lineNumber}, column ${openBracketTokenPosition.columnNumber}.`
    }

    export function parserUnterminatedParentheses(openParenthesesTokenPosition: TokenPosition): string {
        return `Unterminated parentheses starting on line ${openParenthesesTokenPosition.lineNumber}, column ${openParenthesesTokenPosition.columnNumber}.`
    }

    export function parserUnusedTokensRemain(firstUnusedTokenPosition: TokenPosition): string {
        return `Finished parsing, but more tokens remain starting on line ${firstUnusedTokenPosition.lineNumber}, column ${firstUnusedTokenPosition.columnNumber}.`;
    }

}
