// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import {
    Assert,
    DefaultSettings,
    Inspection,
    InspectionSettings,
    Language,
    LexSettings,
    Parser,
    ParseSettings,
} from "../../../..";
import { TestAssertUtils } from "../../../testUtils";

function assertGetParseErrAutocompleteOkLanguageConstant<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.AutocompleteLanguageConstant | undefined {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseErrAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedLanguageConstant);
    return actual.triedLanguageConstant.value;
}

describe(`Inspection - Autocomplete - Language constants`, () => {
    it(`a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`a as |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`(a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a as |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`(a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`(x, |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Language.Constant.LanguageConstantKind.Optional);
    });

    it(`(x, op|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, op|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Language.Constant.LanguageConstantKind.Optional);
    });
});
