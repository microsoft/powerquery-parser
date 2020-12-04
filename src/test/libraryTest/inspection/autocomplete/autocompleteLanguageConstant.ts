// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../powerquery-parser/common";
import { LanguageConstantKind } from "../../../../powerquery-parser/language/constant/constant";
import { IParseState } from "../../../../powerquery-parser/parser";
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
        expect(actual).to.equal(LanguageConstantKind.Nullable);
    });

    it(`a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(LanguageConstantKind.Nullable);
    });

    it(`(a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a as |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(LanguageConstantKind.Nullable);
    });

    it(`(a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(LanguageConstantKind.Nullable);
    });

    it(`(x, |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(LanguageConstantKind.Optional);
    });

    it(`(x, op|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, op|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(DefaultSettings, text, position);
        expect(actual).to.equal(LanguageConstantKind.Optional);
    });
});
