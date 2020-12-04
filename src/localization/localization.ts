// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer } from "..";
import { Assert, StringUtils } from "../powerquery-parser/common";
import { Token } from "../language";
import { LexError } from "../lexer";
import { ParseError } from "../parser";
import { SequenceKind, TokenWithColumnNumber } from "../parser/error";
import { ILocalizationTemplates } from "./templates";

interface ILocalization {
    readonly error_common_cancellationError: (templates: ILocalizationTemplates) => string;
    readonly error_common_invariantError: (
        templates: ILocalizationTemplates,
        reason: string,
        maybeJsonifyableDetails: any | undefined,
    ) => string;
    readonly error_common_unknown: (templates: ILocalizationTemplates, message: any) => string;
    readonly error_lex_badLineNumber: (templates: ILocalizationTemplates, kind: LexError.BadLineNumberKind) => string;
    readonly error_lex_badRange: (templates: ILocalizationTemplates, kind: LexError.BadRangeKind) => string;
    readonly error_lex_badState: (templates: ILocalizationTemplates) => string;
    readonly error_lex_endOfStream: (templates: ILocalizationTemplates) => string;
    readonly error_lex_endOfStreamPartwayRead: (templates: ILocalizationTemplates) => string;
    readonly error_lex_expectedKind: (templates: ILocalizationTemplates, kind: LexError.ExpectedKind) => string;
    readonly error_lex_lineMap: (templates: ILocalizationTemplates, errorLineMap: Lexer.ErrorLineMap) => string;
    readonly error_lex_unexpectedRead: (templates: ILocalizationTemplates) => string;
    readonly error_lex_unterminatedMultilineToken: (
        templates: ILocalizationTemplates,
        kind: LexError.UnterminatedMultilineTokenKind,
    ) => string;
    readonly error_parse_csvContinuation: (
        templates: ILocalizationTemplates,
        kind: ParseError.CsvContinuationKind,
    ) => string;
    readonly error_parse_expectAnyTokenKind: (
        templates: ILocalizationTemplates,
        expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectGeneralizedIdentifier: (
        templates: ILocalizationTemplates,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedTokenKind: Token.TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Token.Token) => string;
    readonly error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_sequence: (
        templates: ILocalizationTemplates,
        sequenceKind: SequenceKind,
    ) => string;
    readonly error_parse_unusedTokens: (templates: ILocalizationTemplates) => string;
}

export function localizeTokenKind(localizationTemplates: ILocalizationTemplates, tokenKind: Token.TokenKind): string {
    switch (tokenKind) {
        case Token.TokenKind.Ampersand:
            return localizationTemplates.tokenKind_ampersand;
        case Token.TokenKind.Asterisk:
            return localizationTemplates.tokenKind_asterisk;
        case Token.TokenKind.AtSign:
            return localizationTemplates.tokenKind_atSign;
        case Token.TokenKind.Bang:
            return localizationTemplates.tokenKind_bang;
        case Token.TokenKind.Comma:
            return localizationTemplates.tokenKind_comma;
        case Token.TokenKind.Division:
            return localizationTemplates.tokenKind_division;
        case Token.TokenKind.DotDot:
            return localizationTemplates.tokenKind_dotDot;
        case Token.TokenKind.Ellipsis:
            return localizationTemplates.tokenKind_ellipsis;
        case Token.TokenKind.Equal:
            return localizationTemplates.tokenKind_equal;
        case Token.TokenKind.FatArrow:
            return localizationTemplates.tokenKind_fatArrow;
        case Token.TokenKind.GreaterThan:
            return localizationTemplates.tokenKind_greaterThan;
        case Token.TokenKind.GreaterThanEqualTo:
            return localizationTemplates.tokenKind_greaterThanEqualTo;
        case Token.TokenKind.HexLiteral:
            return localizationTemplates.tokenKind_hexLiteral;
        case Token.TokenKind.Identifier:
            return localizationTemplates.tokenKind_identifier;
        case Token.TokenKind.KeywordAnd:
            return localizationTemplates.tokenKind_keywordAnd;
        case Token.TokenKind.KeywordAs:
            return localizationTemplates.tokenKind_keywordAs;
        case Token.TokenKind.KeywordEach:
            return localizationTemplates.tokenKind_keywordEach;
        case Token.TokenKind.KeywordElse:
            return localizationTemplates.tokenKind_keywordElse;
        case Token.TokenKind.KeywordError:
            return localizationTemplates.tokenKind_keywordError;
        case Token.TokenKind.KeywordFalse:
            return localizationTemplates.tokenKind_keywordFalse;
        case Token.TokenKind.KeywordHashBinary:
            return localizationTemplates.tokenKind_keywordHashBinary;
        case Token.TokenKind.KeywordHashDate:
            return localizationTemplates.tokenKind_keywordHashDate;
        case Token.TokenKind.KeywordHashDateTime:
            return localizationTemplates.tokenKind_keywordHashDateTime;
        case Token.TokenKind.KeywordHashDateTimeZone:
            return localizationTemplates.tokenKind_keywordHashDateTimeZone;
        case Token.TokenKind.KeywordHashDuration:
            return localizationTemplates.tokenKind_keywordHashDuration;
        case Token.TokenKind.KeywordHashInfinity:
            return localizationTemplates.tokenKind_keywordHashInfinity;
        case Token.TokenKind.KeywordHashNan:
            return localizationTemplates.tokenKind_keywordHashNan;
        case Token.TokenKind.KeywordHashSections:
            return localizationTemplates.tokenKind_keywordHashSections;
        case Token.TokenKind.KeywordHashShared:
            return localizationTemplates.tokenKind_keywordShared;
        case Token.TokenKind.KeywordHashTable:
            return localizationTemplates.tokenKind_keywordHashTable;
        case Token.TokenKind.KeywordHashTime:
            return localizationTemplates.tokenKind_keywordHashTime;
        case Token.TokenKind.KeywordIf:
            return localizationTemplates.tokenKind_keywordIf;
        case Token.TokenKind.KeywordIn:
            return localizationTemplates.tokenKind_keywordIn;
        case Token.TokenKind.KeywordIs:
            return localizationTemplates.tokenKind_keywordIs;
        case Token.TokenKind.KeywordLet:
            return localizationTemplates.tokenKind_keywordLet;
        case Token.TokenKind.KeywordMeta:
            return localizationTemplates.tokenKind_keywordMeta;
        case Token.TokenKind.KeywordNot:
            return localizationTemplates.tokenKind_notEqual;
        case Token.TokenKind.KeywordOr:
            return localizationTemplates.tokenKind_keywordOr;
        case Token.TokenKind.KeywordOtherwise:
            return localizationTemplates.tokenKind_keywordOtherwise;
        case Token.TokenKind.KeywordSection:
            return localizationTemplates.tokenKind_keywordSection;
        case Token.TokenKind.KeywordShared:
            return localizationTemplates.tokenKind_keywordShared;
        case Token.TokenKind.KeywordThen:
            return localizationTemplates.tokenKind_keywordThen;
        case Token.TokenKind.KeywordTrue:
            return localizationTemplates.tokenKind_keywordTrue;
        case Token.TokenKind.KeywordTry:
            return localizationTemplates.tokenKind_keywordTry;
        case Token.TokenKind.KeywordType:
            return localizationTemplates.tokenKind_keywordType;
        case Token.TokenKind.LeftBrace:
            return localizationTemplates.tokenKind_leftBrace;
        case Token.TokenKind.LeftBracket:
            return localizationTemplates.tokenKind_leftBracket;
        case Token.TokenKind.LeftParenthesis:
            return localizationTemplates.tokenKind_leftParenthesis;
        case Token.TokenKind.LessThan:
            return localizationTemplates.tokenKind_lessThan;
        case Token.TokenKind.LessThanEqualTo:
            return localizationTemplates.tokenKind_lessThanEqualTo;
        case Token.TokenKind.Minus:
            return localizationTemplates.tokenKind_minus;
        case Token.TokenKind.NotEqual:
            return localizationTemplates.tokenKind_notEqual;
        case Token.TokenKind.NullCoalescingOperator:
            return localizationTemplates.tokenKind_nullCoalescingOperator;
        case Token.TokenKind.NullLiteral:
            return localizationTemplates.tokenKind_nullLiteral;
        case Token.TokenKind.NumericLiteral:
            return localizationTemplates.tokenKind_numericLiteral;
        case Token.TokenKind.Plus:
            return localizationTemplates.tokenKind_plus;
        case Token.TokenKind.QuestionMark:
            return localizationTemplates.tokenKind_questionMark;
        case Token.TokenKind.RightBrace:
            return localizationTemplates.tokenKind_rightBrace;
        case Token.TokenKind.RightBracket:
            return localizationTemplates.tokenKind_rightBracket;
        case Token.TokenKind.RightParenthesis:
            return localizationTemplates.tokenKind_rightParenthesis;
        case Token.TokenKind.Semicolon:
            return localizationTemplates.tokenKind_semicolon;
        case Token.TokenKind.TextLiteral:
            return localizationTemplates.tokenKind_textLiteral;

        default:
            throw Assert.isNever(tokenKind);
    }
}

export const Localization: ILocalization = {
    error_common_cancellationError: (templates: ILocalizationTemplates) => {
        return templates.error_common_cancellationError;
    },

    error_common_invariantError: (
        templates: ILocalizationTemplates,
        invariantBroken: string,
        maybeJsonifyableDetails: any | undefined,
    ) => {
        if (maybeJsonifyableDetails !== undefined) {
            return StringUtils.assertGetFormatted(
                templates.error_common_invariantError_1_details,
                new Map([
                    ["invariantBroken", invariantBroken],
                    ["details", JSON.stringify(maybeJsonifyableDetails, undefined, 4)],
                ]),
            );
        } else {
            return StringUtils.assertGetFormatted(
                templates.error_common_invariantError_2_noDetails,
                new Map([["invariantBroken", invariantBroken]]),
            );
        }
    },

    error_common_unknown: (templates: ILocalizationTemplates, innerError: any) => {
        return StringUtils.assertGetFormatted(templates.error_common_unknown, new Map([["innerError", innerError]]));
    },

    error_lex_badLineNumber: (templates: ILocalizationTemplates, kind: LexError.BadLineNumberKind) => {
        switch (kind) {
            case LexError.BadLineNumberKind.GreaterThanNumLines:
                return templates.error_lex_badLineNumber_1_greaterThanNumLines;

            case LexError.BadLineNumberKind.LessThanZero:
                return templates.error_lex_badLineNumber_2_lessThanZero;

            default:
                throw Assert.isNever(kind);
        }
    },

    error_lex_badRange: (templates: ILocalizationTemplates, kind: LexError.BadRangeKind) => {
        switch (kind) {
            case LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher:
                return templates.error_lex_badRange_7_sameLine_codeUnitStartGreaterThanCodeUnitEnd;

            case LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd:
                return templates.error_lex_badRange_4_lineNumberStart_greaterThanLineNumberEnd;

            case LexError.BadRangeKind.LineNumberStart_LessThan_Zero:
                return templates.error_lex_badRange_6_lineNumberStart_lessThanZero;

            case LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines:
                return templates.error_lex_badRange_5_lineNumberStart_greaterThanNumLines;

            case LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines:
                return templates.error_lex_badRange_2_lineNumberEnd_greaterThanLineNumbers;

            case LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength:
                return templates.error_lex_badRange_3_lineNumberStart_greaterThanLineLength;

            case LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength:
                return templates.error_lex_badRange_1_lineNumberEnd_greaterThanLineLength;

            default:
                throw Assert.isNever(kind);
        }
    },

    error_lex_badState: (templates: ILocalizationTemplates) => templates.error_lex_badState,

    error_lex_endOfStream: (templates: ILocalizationTemplates) => templates.error_lex_endOfStream,

    error_lex_endOfStreamPartwayRead: (templates: ILocalizationTemplates) => templates.error_lex_endOfStreamPartwayRead,

    error_lex_expectedKind: (templates: ILocalizationTemplates, kind: LexError.ExpectedKind) => {
        switch (kind) {
            case LexError.ExpectedKind.HexLiteral:
                return templates.error_lex_expectedKind_1_hex;

            case LexError.ExpectedKind.KeywordOrIdentifier:
                return templates.error_lex_expectedKind_2_keywordOrIdentifier;

            case LexError.ExpectedKind.Numeric:
                return templates.error_lex_expectedKind_3_numeric;

            default:
                throw Assert.isNever(kind);
        }
    },

    error_lex_lineMap: (templates: ILocalizationTemplates, errorLineMap: Lexer.ErrorLineMap) => {
        const lineNumbers: string = [...errorLineMap.keys()]
            .map((lineNumber: number) => lineNumber.toString())
            .join(",");
        return StringUtils.assertGetFormatted(templates.error_lex_lineMap, new Map([["lineNumbers", lineNumbers]]));
    },

    error_lex_unexpectedRead: (templates: ILocalizationTemplates) => templates.error_lex_unexpectedRead,

    error_lex_unterminatedMultilineToken: (
        templates: ILocalizationTemplates,
        kind: LexError.UnterminatedMultilineTokenKind,
    ) => {
        switch (kind) {
            case LexError.UnterminatedMultilineTokenKind.MultilineComment:
                return templates.error_lex_unterminatedMultilineToken_1_comment;

            case LexError.UnterminatedMultilineTokenKind.QuotedIdentifier:
                return templates.error_lex_unterminatedMultilineToken_2_quotedIdentifier;

            case LexError.UnterminatedMultilineTokenKind.Text:
                return templates.error_lex_unterminatedMultilineToken_3_string;

            default:
                throw Assert.isNever(kind);
        }
    },

    error_parse_csvContinuation: (templates: ILocalizationTemplates, kind: ParseError.CsvContinuationKind) => {
        switch (kind) {
            case ParseError.CsvContinuationKind.DanglingComma:
                return templates.error_parse_csvContinuation_1_danglingComma;

            case ParseError.CsvContinuationKind.LetExpression:
                return templates.error_parse_csvContinuation_2_letExpression;

            default:
                throw Assert.isNever(kind);
        }
    },

    error_parse_expectAnyTokenKind: (
        templates: ILocalizationTemplates,
        expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        const localizedExpectedAnyTokenKinds: string = expectedAnyTokenKinds
            .map((tokenKind: Token.TokenKind) => localizeTokenKind(templates, tokenKind))
            .join(", ");

        if (maybeFoundToken !== undefined) {
            return StringUtils.assertGetFormatted(
                templates.error_parse_expectAnyTokenKind_1_other,
                new Map([
                    ["foundTokenKind", localizeTokenKind(templates, maybeFoundToken.token.kind)],
                    ["expectedAnyTokenKinds", localizedExpectedAnyTokenKinds],
                ]),
            );
        } else {
            return StringUtils.assertGetFormatted(
                templates.error_parse_expectAnyTokenKind_2_endOfStream,
                new Map([["expectedAnyTokenKinds", localizedExpectedAnyTokenKinds]]),
            );
        }
    },

    error_parse_expectGeneralizedIdentifier: (
        templates: ILocalizationTemplates,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        if (maybeFoundToken !== undefined) {
            return templates.error_parse_expectGeneralizedIdentifier_1_other;
        } else {
            return templates.error_parse_expectGeneralizedIdentifier_2_endOfStream;
        }
    },

    error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedTokenKind: Token.TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        const localizedExpectedTokenKind: string = localizeTokenKind(templates, expectedTokenKind);

        if (maybeFoundToken !== undefined) {
            return StringUtils.assertGetFormatted(
                templates.error_parse_expectTokenKind_1_other,
                new Map([
                    ["expectedTokenKind", localizedExpectedTokenKind],
                    ["foundTokenKind", localizeTokenKind(templates, maybeFoundToken.token.kind)],
                ]),
            );
        } else {
            return StringUtils.assertGetFormatted(
                templates.error_parse_expectTokenKind_2_endOfStream,
                new Map([["expectedTokenKind", localizedExpectedTokenKind]]),
            );
        }
    },

    error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Token.Token) => {
        return StringUtils.assertGetFormatted(
            templates.error_parse_invalidPrimitiveType,
            new Map([["foundTokenKind", localizeTokenKind(templates, token.kind)]]),
        );
    },

    error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) =>
        templates.error_parse_requiredParameterAfterOptional,

    error_parse_unterminated_sequence: (templates: ILocalizationTemplates, sequenceKind: SequenceKind) => {
        switch (sequenceKind) {
            case SequenceKind.Bracket:
                return templates.error_parse_unterminated_sequence_bracket;

            case SequenceKind.Parenthesis:
                return templates.error_parse_unterminated_sequence_parenthesis;

            default:
                throw Assert.isNever(sequenceKind);
        }
    },

    error_parse_unusedTokens: (templates: ILocalizationTemplates) => templates.error_parse_unusedTokens,
};
