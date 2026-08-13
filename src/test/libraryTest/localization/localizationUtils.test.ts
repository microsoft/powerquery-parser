// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { LocalizationUtils as FullLocalizationUtils, Templates as FullTemplates } from "../../..";
import { LocalizationUtils, Templates } from "../../../powerquery-parser/core";

describe("LocalizationUtils", () => {
    it("falls back to the default templates for an unregistered locale", () => {
        expect(LocalizationUtils.getLocalizationTemplates("not-a-locale")).to.equal(Templates.DefaultTemplates);
    });

    it("registers templates case-insensitively", () => {
        const locale: string = "test-locale";

        const templates: typeof Templates.DefaultTemplates = {
            ...Templates.DefaultTemplates,
            error_lex_endOfStream: "Localized end of stream",
        };

        LocalizationUtils.registerLocalizationTemplates(locale, templates);

        expect(LocalizationUtils.getLocalizationTemplates(locale.toUpperCase())).to.equal(templates);
    });

    it("registers every locale from the backwards-compatible package root", () => {
        expect(FullLocalizationUtils.getLocalizationTemplates("fr-FR")).to.equal(FullTemplates.fr_FR);
    });

    it("preserves direct access to TemplatesByLocale", () => {
        const locale: string = "map-locale";

        FullTemplates.TemplatesByLocale.set(locale, FullTemplates.fr_FR);

        expect(FullLocalizationUtils.getLocalizationTemplates(locale)).to.equal(FullTemplates.fr_FR);
    });
});
