// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Templates } from ".";
import { Locale } from "./locale";
import { DefaultTemplates, ILocalizationTemplates } from "./templates";

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([
    [Locale.bg_BG.toLowerCase(), Templates.bg_BG],
    [Locale.ca_EZ.toLowerCase(), Templates.ca_ES],
    [Locale.cs_CZ.toLowerCase(), Templates.cs_CZ],
    [Locale.da_DK.toLowerCase(), Templates.da_DK],
    [Locale.de_DE.toLowerCase(), Templates.de_DE],
    [Locale.el_GR.toLowerCase(), Templates.el_GR],
    [Locale.en_US.toLowerCase(), Templates.en_US],
    [Locale.es_ES.toLowerCase(), Templates.es_ES],
    [Locale.et_EE.toLowerCase(), Templates.et_EE],
    [Locale.eu_ES.toLowerCase(), Templates.eu_ES],
    [Locale.fi_FI.toLowerCase(), Templates.fi_FI],
    [Locale.fr_FR.toLowerCase(), Templates.fr_FR],
    [Locale.gl_ES.toLowerCase(), Templates.gl_ES],
    [Locale.hi_IN.toLowerCase(), Templates.hi_IN],
    [Locale.hr_HR.toLowerCase(), Templates.hr_HR],
    [Locale.hu_HU.toLowerCase(), Templates.hu_HU],
    [Locale.id_ID.toLowerCase(), Templates.id_ID],
    [Locale.it_IT.toLowerCase(), Templates.it_IT],
    [Locale.ja_JP.toLowerCase(), Templates.ja_JP],
    [Locale.kk_KZ.toLowerCase(), Templates.kk_KZ],
    [Locale.ko_KR.toLowerCase(), Templates.ko_KR],
    [Locale.lt_LT.toLowerCase(), Templates.lt_LT],
    [Locale.lv_LV.toLowerCase(), Templates.lv_LV],
    [Locale.ms_MY.toLowerCase(), Templates.ms_MY],
    [Locale.nb_NO.toLowerCase(), Templates.nb_NO],
    [Locale.nl_NL.toLowerCase(), Templates.nl_NL],
    [Locale.pl_PL.toLowerCase(), Templates.pl_PL],
    [Locale.pt_BR.toLowerCase(), Templates.pt_BR],
    [Locale.pt_PT.toLowerCase(), Templates.pt_PT],
    [Locale.ro_RO.toLowerCase(), Templates.ro_RO],
    [Locale.ru_RU.toLowerCase(), Templates.ru_RU],
    [Locale.sk_SK.toLowerCase(), Templates.sk_SK],
    [Locale.sl_SI.toLowerCase(), Templates.sl_SI],
    [Locale.sr_Cyrl_RS.toLowerCase(), Templates.sr_Cyrl_RS],
    [Locale.sr_Latn_RS.toLowerCase(), Templates.sr_Latn_RS],
    [Locale.sv_SE.toLowerCase(), Templates.sv_SE],
    [Locale.th_TH.toLowerCase(), Templates.th_TH],
    [Locale.tr_TR.toLowerCase(), Templates.tr_TR],
    [Locale.uk_UA.toLowerCase(), Templates.uk_UA],
    [Locale.vi_VN.toLowerCase(), Templates.vi_VN],
    [Locale.zh_CN.toLowerCase(), Templates.zh_CN],
    [Locale.zh_TW.toLowerCase(), Templates.zh_TW],
]);

export function getLocalizationTemplates(locale: string): ILocalizationTemplates {
    return TemplatesByLocale.get(locale.toLowerCase()) ?? DefaultTemplates;
}
