// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Language } from "..";
import { Assert, StringUtils } from "../common";
import { Lexer, LexError } from "../lexer";
import { ParseError } from "../parser";
import { TokenWithColumnNumber } from "../parser/error";
import { ILocalizationTemplates } from "./templates";

interface ILocalization {
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
        expectedAnyTokenKinds: ReadonlyArray<Language.TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectGeneralizedIdentifier: (
        templates: ILocalizationTemplates,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedTokenKind: Language.TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Language.Token) => string;
    readonly error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_bracket: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_parenthesis: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unusedTokens: (templates: ILocalizationTemplates) => string;
}

export function localizeTokenKind(
    localizationTemplates: ILocalizationTemplates,
    tokenKind: Language.TokenKind,
): string {
    switch (tokenKind) {
        case Language.TokenKind.Ampersand:
            return localizationTemplates.tokenKind_ampersand;
        case Language.TokenKind.Asterisk:
            return localizationTemplates.tokenKind_asterisk;
        case Language.TokenKind.AtSign:
            return localizationTemplates.tokenKind_atSign;
        case Language.TokenKind.Bang:
            return localizationTemplates.tokenKind_bang;
        case Language.TokenKind.Comma:
            return localizationTemplates.tokenKind_comma;
        case Language.TokenKind.Division:
            return localizationTemplates.tokenKind_division;
        case Language.TokenKind.DotDot:
            return localizationTemplates.tokenKind_dotDot;
        case Language.TokenKind.Ellipsis:
            return localizationTemplates.tokenKind_ellipsis;
        case Language.TokenKind.Equal:
            return localizationTemplates.tokenKind_equal;
        case Language.TokenKind.FatArrow:
            return localizationTemplates.tokenKind_fatArrow;
        case Language.TokenKind.GreaterThan:
            return localizationTemplates.tokenKind_greaterThan;
        case Language.TokenKind.GreaterThanEqualTo:
            return localizationTemplates.tokenKind_greaterThanEqualTo;
        case Language.TokenKind.HexLiteral:
            return localizationTemplates.tokenKind_hexLiteral;
        case Language.TokenKind.Identifier:
            return localizationTemplates.tokenKind_identifier;
        case Language.TokenKind.KeywordAnd:
            return localizationTemplates.tokenKind_keywordAnd;
        case Language.TokenKind.KeywordAs:
            return localizationTemplates.tokenKind_keywordAs;
        case Language.TokenKind.KeywordEach:
            return localizationTemplates.tokenKind_keywordEach;
        case Language.TokenKind.KeywordElse:
            return localizationTemplates.tokenKind_keywordElse;
        case Language.TokenKind.KeywordError:
            return localizationTemplates.tokenKind_keywordError;
        case Language.TokenKind.KeywordFalse:
            return localizationTemplates.tokenKind_keywordFalse;
        case Language.TokenKind.KeywordHashBinary:
            return localizationTemplates.tokenKind_keywordHashBinary;
        case Language.TokenKind.KeywordHashDate:
            return localizationTemplates.tokenKind_keywordHashDate;
        case Language.TokenKind.KeywordHashDateTime:
            return localizationTemplates.tokenKind_keywordHashDateTime;
        case Language.TokenKind.KeywordHashDateTimeZone:
            return localizationTemplates.tokenKind_keywordHashDateTimeZone;
        case Language.TokenKind.KeywordHashDuration:
            return localizationTemplates.tokenKind_keywordHashDuration;
        case Language.TokenKind.KeywordHashInfinity:
            return localizationTemplates.tokenKind_keywordHashInfinity;
        case Language.TokenKind.KeywordHashNan:
            return localizationTemplates.tokenKind_keywordHashNan;
        case Language.TokenKind.KeywordHashSections:
            return localizationTemplates.tokenKind_keywordHashSections;
        case Language.TokenKind.KeywordHashShared:
            return localizationTemplates.tokenKind_keywordShared;
        case Language.TokenKind.KeywordHashTable:
            return localizationTemplates.tokenKind_keywordHashTable;
        case Language.TokenKind.KeywordHashTime:
            return localizationTemplates.tokenKind_keywordHashTime;
        case Language.TokenKind.KeywordIf:
            return localizationTemplates.tokenKind_keywordIf;
        case Language.TokenKind.KeywordIn:
            return localizationTemplates.tokenKind_keywordIn;
        case Language.TokenKind.KeywordIs:
            return localizationTemplates.tokenKind_keywordIs;
        case Language.TokenKind.KeywordLet:
            return localizationTemplates.tokenKind_keywordLet;
        case Language.TokenKind.KeywordMeta:
            return localizationTemplates.tokenKind_keywordMeta;
        case Language.TokenKind.KeywordNot:
            return localizationTemplates.tokenKind_notEqual;
        case Language.TokenKind.KeywordOr:
            return localizationTemplates.tokenKind_keywordOr;
        case Language.TokenKind.KeywordOtherwise:
            return localizationTemplates.tokenKind_keywordOtherwise;
        case Language.TokenKind.KeywordSection:
            return localizationTemplates.tokenKind_keywordSection;
        case Language.TokenKind.KeywordShared:
            return localizationTemplates.tokenKind_keywordShared;
        case Language.TokenKind.KeywordThen:
            return localizationTemplates.tokenKind_keywordThen;
        case Language.TokenKind.KeywordTrue:
            return localizationTemplates.tokenKind_keywordTrue;
        case Language.TokenKind.KeywordTry:
            return localizationTemplates.tokenKind_keywordTry;
        case Language.TokenKind.KeywordType:
            return localizationTemplates.tokenKind_keywordType;
        case Language.TokenKind.LeftBrace:
            return localizationTemplates.tokenKind_leftBrace;
        case Language.TokenKind.LeftBracket:
            return localizationTemplates.tokenKind_leftBracket;
        case Language.TokenKind.LeftParenthesis:
            return localizationTemplates.tokenKind_leftParenthesis;
        case Language.TokenKind.LessThan:
            return localizationTemplates.tokenKind_lessThan;
        case Language.TokenKind.LessThanEqualTo:
            return localizationTemplates.tokenKind_lessThanEqualTo;
        case Language.TokenKind.Minus:
            return localizationTemplates.tokenKind_minus;
        case Language.TokenKind.NotEqual:
            return localizationTemplates.tokenKind_notEqual;
        case Language.TokenKind.NullCoalescingOperator:
            return localizationTemplates.tokenKind_nullCoalescingOperator;
        case Language.TokenKind.NullLiteral:
            return localizationTemplates.tokenKind_nullLiteral;
        case Language.TokenKind.NumericLiteral:
            return localizationTemplates.tokenKind_numericLiteral;
        case Language.TokenKind.Plus:
            return localizationTemplates.tokenKind_plus;
        case Language.TokenKind.QuestionMark:
            return localizationTemplates.tokenKind_questionMark;
        case Language.TokenKind.RightBrace:
            return localizationTemplates.tokenKind_rightBrace;
        case Language.TokenKind.RightBracket:
            return localizationTemplates.tokenKind_rightBracket;
        case Language.TokenKind.RightParenthesis:
            return localizationTemplates.tokenKind_rightParenthesis;
        case Language.TokenKind.Semicolon:
            return localizationTemplates.tokenKind_semicolon;
        case Language.TokenKind.TextLiteral:
            return localizationTemplates.tokenKind_textLiteral;

        default:
            throw Assert.isNever(tokenKind);
    }
}

export const Localization: ILocalization = {
    error_common_invariantError: (
        templates: ILocalizationTemplates,
        invariantBroken: string,
        maybeJsonifyableDetails: any | undefined,
    ) => {
        if (maybeJsonifyableDetails !== undefined) {
            return StringUtils.assertFormat(
                templates.error_common_invariantError_1_details,
                new Map([
                    ["invariantBroken", invariantBroken],
                    ["details", JSON.stringify(maybeJsonifyableDetails, undefined, 4)],
                ]),
            );
        } else {
            return StringUtils.assertFormat(
                templates.error_common_invariantError_2_noDetails,
                new Map([["invariantBroken", invariantBroken]]),
            );
        }
    },

    error_common_unknown: (templates: ILocalizationTemplates, innerError: any) => {
        return StringUtils.assertFormat(templates.error_common_unknown, new Map([["innerError", innerError]]));
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
        return StringUtils.assertFormat(templates.error_lex_lineMap, new Map([["lineNumbers", lineNumbers]]));
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
        expectedAnyTokenKinds: ReadonlyArray<Language.TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        const localizedExpectedAnyTokenKinds: string = expectedAnyTokenKinds
            .map((tokenKind: Language.TokenKind) => localizeTokenKind(templates, tokenKind))
            .join(", ");

        if (maybeFoundToken !== undefined) {
            return StringUtils.assertFormat(
                templates.error_parse_expectAnyTokenKind_1_other,
                new Map([
                    ["foundTokenKind", localizeTokenKind(templates, maybeFoundToken.token.kind)],
                    ["expectedAnyTokenKinds", localizedExpectedAnyTokenKinds],
                ]),
            );
        } else {
            return StringUtils.assertFormat(
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
        expectedTokenKind: Language.TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        const localizedExpectedTokenKind: string = localizeTokenKind(templates, expectedTokenKind);

        if (maybeFoundToken !== undefined) {
            return StringUtils.assertFormat(
                templates.error_parse_expectTokenKind_1_other,
                new Map([
                    ["expectedTokenKind", localizedExpectedTokenKind],
                    ["foundTokenKind", localizeTokenKind(templates, maybeFoundToken.token.kind)],
                ]),
            );
        } else {
            return StringUtils.assertFormat(
                templates.error_parse_expectTokenKind_2_endOfStream,
                new Map([["expectedTokenKind", localizedExpectedTokenKind]]),
            );
        }
    },

    error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Language.Token) => {
        return StringUtils.assertFormat(
            templates.error_parse_invalidPrimitiveType,
            new Map([["foundTokenKind", localizeTokenKind(templates, token.kind)]]),
        );
    },

    error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) =>
        templates.error_parse_requiredParameterAfterOptional,

    error_parse_unterminated_bracket: (templates: ILocalizationTemplates) => templates.error_parse_unterminated_bracket,

    error_parse_unterminated_parenthesis: (templates: ILocalizationTemplates) =>
        templates.error_parse_unterminated_parenthesis,

    error_parse_unusedTokens: (templates: ILocalizationTemplates) => templates.error_parse_unusedTokens,
};
