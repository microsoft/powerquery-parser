// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../common";
import { IParserState } from "../../../../parser";
import { DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

function assertGetParseErrAutocompleteOkLanguageConstant<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): ReadonlyArray<string> | undefined {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseErrAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedLanguageConstant);
    return actual.triedLanguageConstant.value;
}

describe(`Inspection - Autocomplete - Language constants`, () => {
    it(`let x = (a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = (a as |`,
        );
        const actual: ReadonlyArray<string> | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            DefaultSettings,
            text,
            position,
        );
        Assert.isUndefined(actual);
    });

    it(`(a, |`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(a, |`);
        const expected: ReadonlyArray<string> | undefined = ["optional"];
        const actual: ReadonlyArray<string> | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it(`(x, op|`, () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x, op|`);
        const expected: ReadonlyArray<string> | undefined = ["optional"];
        const actual: ReadonlyArray<string> | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
