// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultLocale } from "./locale";
import { DefaultTemplates } from "./defaultTemplates";
import type { ILocalizationTemplates } from "./templates";

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([
    [DefaultLocale.toLowerCase(), DefaultTemplates],
]);

export function getLocalizationTemplates(locale: string): ILocalizationTemplates {
    return TemplatesByLocale.get(locale.toLowerCase()) ?? DefaultTemplates;
}

export function registerLocalizationTemplates(locale: string, templates: ILocalizationTemplates): void {
    TemplatesByLocale.set(locale.toLowerCase(), templates);
}
