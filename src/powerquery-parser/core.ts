// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LocalizationUtils from "./localization/localizationUtils";
import * as Templates from "./localization/defaultTemplates";

export { LocalizationUtils, Templates };
export * as Language from "./language";
export * as Lexer from "./lexer";
export * as Parser from "./parser";
export * from "./common";
export { Localization } from "./localization/localization";
export { DefaultLocale, Locale } from "./localization/locale";
export { DefaultTemplates } from "./localization/defaultTemplates";
export type { ILocalizationTemplates } from "./localization/templates";
export * from "./settings";
export * from "./task";
