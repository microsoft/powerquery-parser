// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultTemplates, ILocalizationTemplates, TemplatesByLocale } from "./templates";

export function getLocalizationTemplates(locale: string): ILocalizationTemplates {
    return TemplatesByLocale.get(locale.toLowerCase()) ?? DefaultTemplates;
}
