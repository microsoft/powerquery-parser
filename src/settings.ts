// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultTemplates, ILocalizationTemplates } from "./localization";

export interface Settings {
    readonly localizationTemplates: ILocalizationTemplates;
}

export const DefaultSettings: Settings = {
    localizationTemplates: DefaultTemplates,
};
