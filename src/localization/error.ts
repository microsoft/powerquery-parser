// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT license.

// import { isNever, StringUtils } from "../common";
// import { Option } from "../common/option";
// import { Lexer, LexError, Token, TokenKind } from "../lexer";
// import { Ast } from "../parser";
// import { TokenWithColumnNumber } from "../parser/error";

// export function invariantError(reason: string, maybeJsonifyable: Option<any>): string {
//     if (maybeJsonifyable !== undefined) {
//         return StringUtils.expectFormat(
//             LocalizationTemplates.error_common_invariantError_details,
//             reason,
//             JSON.stringify(maybeJsonifyable, undefined, 4),
//         );
//     } else {
//         return StringUtils.expectFormat(LocalizationTemplates.error_common_invariantError_noDetails, reason);
//     }
// }

// export function unknownError(innerError: any): string {
//     return `An unknown error was encountered, innerError: ${innerError}`;
// }

// export function lexBadLineNumber(kind: LexError.BadLineNumberKind, lineNumber: number, numLines: number): string {
//     switch (kind) {
//         case LexError.BadLineNumberKind.GreaterThanNumLines:
//             return `lineNumber (${lineNumber + 1}) is greater than or equal to the number of lines (${numLines}).`;

//         case LexError.BadLineNumberKind.LessThanZero:
//             return `lineNumber (${lineNumber + 1}) is less than zero.`;

//         default:
//             throw isNever(kind);
//     }
// }

// export function lexBadRange(kind: LexError.BadRangeKind): string {
//     switch (kind) {
//         case LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher:
//             return `Start and end shared the same line, but start.lineCodeUnit was higher than end.lineCodeUnit.`;

//         case LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd:
//             return `start.lineNumber is larger than end.lineNumber.`;

//         case LexError.BadRangeKind.LineNumberStart_LessThan_Zero:
//             return `start.lineNumber is less than 0.`;

//         case LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines:
//             return `start.lineNumber is higher than State's number of lines.`;

//         case LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines:
//             return `end.lineNumber is higher than State's number of lines.`;

//         case LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength:
//             return `start.lineCodeUnit is higher than line's length.`;

//         case LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength:
//             return `end.lineCodeUnit is higher than line's length.`;

//         default:
//             throw isNever(kind);
//     }
// }

// export function lexBadState(): string {
//     return `The lexer encountered an error last run. Either feed the lexer more text or review lastError.`;
// }

// export function lexEndOfStream(): string {
//     return `The lexer reached end-of-stream.`;
// }

// export function lexExpected(graphemePosition: StringUtils.GraphemePosition, kind: LexError.ExpectedKind): string {
//     switch (kind) {
//         case LexError.ExpectedKind.HexLiteral:
//             return `Expected hex literal on line ${graphemePosition.lineNumber +
//                 1}, column ${graphemePosition.columnNumber + 1}.`;

//         case LexError.ExpectedKind.KeywordOrIdentifier:
//             return `Expected keyword or identifier on line ${graphemePosition.lineNumber +
//                 1}, column ${graphemePosition.columnNumber + 1}.`;

//         case LexError.ExpectedKind.Numeric:
//             return `Expected numeric literal on line ${graphemePosition.lineNumber +
//                 1}, column ${graphemePosition.columnNumber + 1}.`;

//         default:
//             throw isNever(kind);
//     }
// }

// export function lexErrorLineMap(errorLineMap: Lexer.ErrorLineMap): string {
//     return `Error on line(s): ${[...errorLineMap.keys()]}`;
// }

// export function lexUnexpectedEof(graphemePosition: StringUtils.GraphemePosition): string {
//     return `Reached EOF while attempting to lex on line ${graphemePosition.lineNumber +
//         1}, column ${graphemePosition.columnNumber + 1}.`;
// }

// export function lexUnexpectedRead(graphemePosition: StringUtils.GraphemePosition): string {
//     return `Unexpected read while attempting to lex on line ${graphemePosition.lineNumber +
//         1}, column ${graphemePosition.columnNumber + 1}.`;
// }

// export function lexUnterminatedMultilineToken(
//     graphemePosition: StringUtils.GraphemePosition,
//     kind: LexError.UnterminatedMultilineTokenKind,
// ): string {
//     switch (kind) {
//         case LexError.UnterminatedMultilineTokenKind.MultilineComment:
//             return StringUtils.expectFormat(LocalizationTemplates.error_lex_unterminatedMultilineToken_comment);

//             return `Unterminated multiline comment starting on line ${graphemePosition.lineNumber +
//                 1}, column ${graphemePosition.columnNumber + 1}.`;

//         case LexError.UnterminatedMultilineTokenKind.QuotedIdentifier:
//             return `Unterminated quoted identifier starting on line ${graphemePosition.lineNumber +
//                 1}, column ${graphemePosition.columnNumber + 1}.`;

//         case LexError.UnterminatedMultilineTokenKind.String:
//             return `Unterminated multiline comment starting on line ${graphemePosition.lineNumber +
//                 1}, column ${graphemePosition.columnNumber + 1}.`;

//         default:
//             throw isNever(kind);
//     }
// }

// export function parserExpectedCsvContinuationLetExpression(): string {
//     return `A comma cannot precede an In`;
// }

// export function parserExpectedCsvContinuationDanglingComma(): string {
//     return `Did you leave a dangling Comma?`;
// }

// export function parserExpectedTokenKind(
    // expectedTokenKind: TokenKind,
    // maybeTokenWithColumnNumber: Option<TokenWithColumnNumber>,
// ): string {
//     if (maybeTokenWithColumnNumber) {
//         const tokenWithColumnNumber: TokenWithColumnNumber = maybeTokenWithColumnNumber;
//         const token: Token = tokenWithColumnNumber.token;
//         const columnNumber: number = tokenWithColumnNumber.columnNumber;
//         return `Expected to find a ${expectedTokenKind} on line ${token.positionStart.lineNumber +
//             1}, column ${columnNumber + 1}, but a ${token.kind} was found instead.`;
//     } else {
//         return `Expected to find a ${expectedTokenKind} but the end-of-file was reached instead.`;
//     }
// }

// export function parserInvalidLiteralValue(
//     currentTokenData: string,
//     positionStart: StringUtils.GraphemePosition,
// ): string {
//     return `Expected to find a literal on line ${positionStart.lineNumber + 1}, column ${positionStart.columnNumber +
//         1}, but ${currentTokenData} was found instead.`;
// }

// export function parserInvalidPrimitiveType(token: Token, positionStart: StringUtils.GraphemePosition): string {
//     return `Expected to find a primitive literal on line ${positionStart.lineNumber +
//         1}, column ${positionStart.columnNumber + 1}, but ${token.data} was found instead.`;
// }

// export function parserExpectedAnyTokenKind(
    // expectedAnyTokenKind: ReadonlyArray<TokenKind>,
    // maybeTokenWithColumnNumber: Option<TokenWithColumnNumber>,
// ): string {
//     if (maybeTokenWithColumnNumber) {
//         const tokenWithColumnNumber: TokenWithColumnNumber = maybeTokenWithColumnNumber;
//         const token: Token = tokenWithColumnNumber.token;
//         const columnNumber: number = tokenWithColumnNumber.columnNumber;
//         return `Expected to find one of the following on line ${token.positionStart.lineNumber +
//             1}, column ${columnNumber + 1}, but a ${token.kind} was found instead: [${expectedAnyTokenKind}].`;
//     } else {
//         return `Expected to find one of the following, but the end-of-file was reached instead: [${expectedAnyTokenKind}].`;
//     }
// }

// export function parserExpectedGeneralizedIdentifier(maybeTokenWithColumnNumber: Option<TokenWithColumnNumber>): string {
//     if (maybeTokenWithColumnNumber) {
//         const tokenWithColumnNumber: TokenWithColumnNumber = maybeTokenWithColumnNumber;
//         const token: Token = tokenWithColumnNumber.token;
//         const columnNumber: number = tokenWithColumnNumber.columnNumber;
//         return `Expected to find a GeneralizedIdentifier on the line ${token.positionStart.lineNumber +
//             1}, column ${columnNumber + 1}, but a ${token.kind} was found instead: [${token.kind}].`;
//     } else {
//         return `Expected to a GeneralizedIdentifier, but the end-of-file was reached instead.`;
//     }
// }

// export function parserRequiredParameterAfterOptionalParameter(positionStart: StringUtils.GraphemePosition): string {
//     return `Cannot have a non-optional parameter after an optional parameter. Line ${positionStart.lineNumber +
//         1}, column ${positionStart.columnNumber + 1}.`;
// }

// export function parserUnexpectedEndOfTokens(nodeKindOnStack: Ast.NodeKind): string {
//     return `Reached end of tokens while attempting to parse ${nodeKindOnStack}.`;
// }

// export function parserUnterminatedBracket(positionStart: StringUtils.GraphemePosition): string {
//     return `Unterminated bracket starting on line ${positionStart.lineNumber + 1}, column ${positionStart.columnNumber +
//         1}.`;
// }

// export function parserUnterminatedParentheses(positionStart: StringUtils.GraphemePosition): string {
//     return `Unterminated parentheses starting on line ${positionStart.lineNumber +
//         1}, column ${positionStart.columnNumber + 1}.`;
// }

// export function parserUnusedTokensRemain(positionStart: StringUtils.GraphemePosition): string {
//     return `Finished parsing, but more tokens remain starting on line ${positionStart.lineNumber +
//         1}, column ${positionStart.columnNumber + 1}.`;
// }
