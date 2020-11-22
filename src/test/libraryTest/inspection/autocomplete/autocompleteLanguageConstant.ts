// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Language } from "../../../..";
import { Assert } from "../../../../common";
import { Constant } from "../../../../language";
import { IParseState } from "../../../../parser";
import { DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

function assertGetParseErrAutocompleteOkLanguageConstant<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
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
        expect(actual).to.equal(Constant.LanguageConstantKind.Nullable);
    });

    it(`a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Constant.LanguageConstantKind.Nullable);
    });

    it(`(a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a as |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Constant.LanguageConstantKind.Nullable);
    });

    it(`(a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(Constant.LanguageConstantKind.Nullable);
    });

    it(`(x, |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, |`);
        const expected: Constant.LanguageConstantKind = Language.Constant.LanguageConstantKind.Optional;
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(expected);
    });

    it(`(x, op|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, op|`);
        const expected: Constant.LanguageConstantKind = Language.Constant.LanguageConstantKind.Optional;
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(expected);
    });
});
