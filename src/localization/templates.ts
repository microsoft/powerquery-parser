// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Locale } from "./locale";
import * as bg_BG from "./templates/bg-BG.json";
import * as ca_ES from "./templates/ca-ES.json";
import * as cs_CZ from "./templates/cs-CZ.json";
import * as da_DK from "./templates/da-DK.json";
import * as de_DE from "./templates/de-DE.json";
import * as el_GR from "./templates/el-GR.json";
import * as en_US from "./templates/en-US.json";
import * as es_ES from "./templates/es-ES.json";
import * as et_EE from "./templates/et-EE.json";
import * as eu_ES from "./templates/eu-ES.json";
import * as fi_FI from "./templates/fi-FI.json";
import * as fr_FR from "./templates/fr-FR.json";
import * as gl_ES from "./templates/gl-ES.json";
import * as hi_IN from "./templates/hi-IN.json";
import * as hr_HR from "./templates/hr-HR.json";
import * as hu_HU from "./templates/hu-HU.json";
import * as id_ID from "./templates/id-ID.json";
import * as it_IT from "./templates/it-IT.json";
import * as ja_JP from "./templates/ja-JP.json";
import * as kk_KZ from "./templates/kk-KZ.json";
import * as ko_KR from "./templates/ko-KR.json";
import * as lt_LT from "./templates/lt-LT.json";
import * as lv_LV from "./templates/lv-LV.json";
import * as ms_MY from "./templates/ms-MY.json";
import * as nb_NO from "./templates/nb-NO.json";
import * as nl_NL from "./templates/nl-NL.json";
import * as pl_PL from "./templates/pl-PL.json";
import * as pt_BR from "./templates/pt-BR.json";
import * as pt_PT from "./templates/pt-PT.json";
import * as ro_RO from "./templates/ro-RO.json";
import * as ru_RU from "./templates/ru-RU.json";
import * as sk_SK from "./templates/sk-SK.json";
import * as sl_SI from "./templates/sl-SI.json";
import * as sr_Cyrl_RS from "./templates/sr-Cyrl-RS.json";
import * as sr_Latn_RS from "./templates/sr-Latn-RS.json";
import * as sv_SE from "./templates/sv-SE.json";
import * as th_TH from "./templates/th-TH.json";
import * as tr_TR from "./templates/tr-TR.json";
import * as uk_UA from "./templates/uk-UA.json";
import * as vi_VN from "./templates/vi-VN.json";
import * as zh_CN from "./templates/zh-CN.json";
import * as zh_TW from "./templates/zh-TW.json";

export interface ILocalizationTemplates {
    readonly error_common_invariantError_1_details: string;
    readonly error_common_invariantError_2_noDetails: string;
    readonly error_common_unknown: string;
    readonly error_lex_badLineNumber_1_greaterThanNumLines: string;
    readonly error_lex_badLineNumber_2_lessThanZero: string;
    readonly error_lex_badRange_1_lineNumberEnd_greaterThanLineLength: string;
    readonly error_lex_badRange_2_lineNumberEnd_greaterThanLineNumbers: string;
    readonly error_lex_badRange_3_lineNumberStart_greaterThanLineLength: string;
    readonly error_lex_badRange_4_lineNumberStart_greaterThanLineNumberEnd: string;
    readonly error_lex_badRange_5_lineNumberStart_greaterThanNumLines: string;
    readonly error_lex_badRange_6_lineNumberStart_lessThanZero: string;
    readonly error_lex_badRange_7_sameLine_codeUnitStartGreaterThanCodeUnitEnd: string;
    readonly error_lex_badState: string;
    readonly error_lex_endOfStream: string;
    readonly error_lex_endOfStreamPartwayRead: string;
    readonly error_lex_expectedKind_1_hex: string;
    readonly error_lex_expectedKind_2_keywordOrIdentifier: string;
    readonly error_lex_expectedKind_3_numeric: string;
    readonly error_lex_lineMap: string;
    readonly error_lex_unexpectedRead: string;
    readonly error_lex_unterminatedMultilineToken_1_comment: string;
    readonly error_lex_unterminatedMultilineToken_2_quotedIdentifier: string;
    readonly error_lex_unterminatedMultilineToken_3_string: string;
    readonly error_parse_csvContinuation_1_danglingComma: string;
    readonly error_parse_csvContinuation_2_letExpression: string;
    readonly error_parse_expectAnyTokenKind_1_other: string;
    readonly error_parse_expectAnyTokenKind_2_endOfStream: string;
    readonly error_parse_expectGeneralizedIdentifier_1_other: string;
    readonly error_parse_expectGeneralizedIdentifier_2_endOfStream: string;
    readonly error_parse_expectTokenKind_1_other: string;
    readonly error_parse_expectTokenKind_2_endOfStream: string;
    readonly error_parse_invalidPrimitiveType: string;
    readonly error_parse_requiredParameterAfterOptional: string;
    readonly error_parse_unterminated_bracket: string;
    readonly error_parse_unterminated_parenthesis: string;
    readonly error_parse_unusedTokens: string;
    readonly tokenKind_ampersand: string;
    readonly tokenKind_asterisk: string;
    readonly tokenKind_atSign: string;
    readonly tokenKind_bang: string;
    readonly tokenKind_comma: string;
    readonly tokenKind_division: string;
    readonly tokenKind_dotDot: string;
    readonly tokenKind_ellipsis: string;
    readonly tokenKind_equal: string;
    readonly tokenKind_fatArrow: string;
    readonly tokenKind_greaterThan: string;
    readonly tokenKind_greaterThanEqualTo: string;
    readonly tokenKind_hexLiteral: string;
    readonly tokenKind_identifier: string;
    readonly tokenKind_keywordAnd: string;
    readonly tokenKind_keywordAs: string;
    readonly tokenKind_keywordEach: string;
    readonly tokenKind_keywordElse: string;
    readonly tokenKind_keywordError: string;
    readonly tokenKind_keywordFalse: string;
    readonly tokenKind_keywordHashBinary: string;
    readonly tokenKind_keywordHashDate: string;
    readonly tokenKind_keywordHashDateTime: string;
    readonly tokenKind_keywordHashDateTimeZone: string;
    readonly tokenKind_keywordHashDuration: string;
    readonly tokenKind_keywordHashInfinity: string;
    readonly tokenKind_keywordHashNan: string;
    readonly tokenKind_keywordHashSections: string;
    readonly tokenKind_keywordHashShared: string;
    readonly tokenKind_keywordHashTable: string;
    readonly tokenKind_keywordHashTime: string;
    readonly tokenKind_keywordIf: string;
    readonly tokenKind_keywordIn: string;
    readonly tokenKind_keywordIs: string;
    readonly tokenKind_keywordLet: string;
    readonly tokenKind_keywordMeta: string;
    readonly tokenKind_keywordNot: string;
    readonly tokenKind_keywordOr: string;
    readonly tokenKind_keywordOtherwise: string;
    readonly tokenKind_keywordSection: string;
    readonly tokenKind_keywordShared: string;
    readonly tokenKind_keywordThen: string;
    readonly tokenKind_keywordTrue: string;
    readonly tokenKind_keywordTry: string;
    readonly tokenKind_keywordType: string;
    readonly tokenKind_leftBrace: string;
    readonly tokenKind_leftBracket: string;
    readonly tokenKind_leftParenthesis: string;
    readonly tokenKind_lessThan: string;
    readonly tokenKind_lessThanEqualTo: string;
    readonly tokenKind_minus: string;
    readonly tokenKind_notEqual: string;
    readonly tokenKind_nullLiteral: string;
    readonly tokenKind_numericLiteral: string;
    readonly tokenKind_plus: string;
    readonly tokenKind_questionMark: string;
    readonly tokenKind_rightBrace: string;
    readonly tokenKind_rightBracket: string;
    readonly tokenKind_rightParenthesis: string;
    readonly tokenKind_semicolon: string;
    readonly tokenKind_stringLiteral: string;
}

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([
    [Locale.bg_BG.toLowerCase(), bg_BG],
    [Locale.ca_EZ.toLowerCase(), ca_ES],
    [Locale.cs_CZ.toLowerCase(), cs_CZ],
    [Locale.da_DK.toLowerCase(), da_DK],
    [Locale.de_DE.toLowerCase(), de_DE],
    [Locale.el_GR.toLowerCase(), el_GR],
    [Locale.en_US.toLowerCase(), en_US],
    [Locale.es_ES.toLowerCase(), es_ES],
    [Locale.et_EE.toLowerCase(), et_EE],
    [Locale.eu_ES.toLowerCase(), eu_ES],
    [Locale.fi_FI.toLowerCase(), fi_FI],
    [Locale.fr_FR.toLowerCase(), fr_FR],
    [Locale.gl_ES.toLowerCase(), gl_ES],
    [Locale.hi_IN.toLowerCase(), hi_IN],
    [Locale.hr_HR.toLowerCase(), hr_HR],
    [Locale.hu_HU.toLowerCase(), hu_HU],
    [Locale.id_ID.toLowerCase(), id_ID],
    [Locale.it_IT.toLowerCase(), it_IT],
    [Locale.ja_JP.toLowerCase(), ja_JP],
    [Locale.kk_KZ.toLowerCase(), kk_KZ],
    [Locale.ko_KR.toLowerCase(), ko_KR],
    [Locale.lt_LT.toLowerCase(), lt_LT],
    [Locale.lv_LV.toLowerCase(), lv_LV],
    [Locale.ms_MY.toLowerCase(), ms_MY],
    [Locale.nb_NO.toLowerCase(), nb_NO],
    [Locale.nl_NL.toLowerCase(), nl_NL],
    [Locale.pl_PL.toLowerCase(), pl_PL],
    [Locale.pt_BR.toLowerCase(), pt_BR],
    [Locale.pt_PT.toLowerCase(), pt_PT],
    [Locale.ro_RO.toLowerCase(), ro_RO],
    [Locale.ru_RU.toLowerCase(), ru_RU],
    [Locale.sk_SK.toLowerCase(), sk_SK],
    [Locale.sl_SI.toLowerCase(), sl_SI],
    [Locale.sr_Cyrl_RS.toLowerCase(), sr_Cyrl_RS],
    [Locale.sr_Latn_RS.toLowerCase(), sr_Latn_RS],
    [Locale.sv_SE.toLowerCase(), sv_SE],
    [Locale.th_TH.toLowerCase(), th_TH],
    [Locale.tr_TR.toLowerCase(), tr_TR],
    [Locale.uk_UA.toLowerCase(), uk_UA],
    [Locale.vi_VN.toLowerCase(), vi_VN],
    [Locale.zh_CN.toLowerCase(), zh_CN],
    [Locale.zh_TW.toLowerCase(), zh_TW],
]);

export const DefaultLocale: Locale = Locale.en_US;

export const DefaultTemplates: ILocalizationTemplates = en_US;

export function getLocalizationTemplates(locale: string): ILocalizationTemplates {
    return TemplatesByLocale.get(locale.toLowerCase()) || DefaultTemplates;
}
