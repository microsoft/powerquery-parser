// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../common";
import { IAutocompleteItem } from "../../../../inspection";
import { IParserState } from "../../../../parser";
import { DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

type AbridgedAutocompleteFieldAccess = ReadonlyArray<string>;

function abridgedFieldAccess(
    maybeAutocompleteFieldAccess: Inspection.AutocompleteFieldAccess | undefined,
): AbridgedAutocompleteFieldAccess {
    if (maybeAutocompleteFieldAccess === undefined) {
        return [];
    }

    return maybeAutocompleteFieldAccess.autocompleteItems.map((item: IAutocompleteItem) => item.key);
}

function assertGetParseOkAutocompleteOkFieldAccess<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseOkAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

function assertGetParseErrAutocompleteOkFieldAccess<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseOkAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    it("let x = [a = 1] in x[|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = [a = 1] in x[|`,
        );
        const expected: AbridgedAutocompleteFieldAccess = ["a"];
        const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = () => [a = 1] in x()[|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = () => [a = 1] in x()[|`,
        );
        const expected: AbridgedAutocompleteFieldAccess = [];
        const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("WIP", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`x[|`);
        const expected: AbridgedAutocompleteFieldAccess = [];
        const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = () => [a = 1] in x()|[", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = () => [a = 1] in x()|[`,
        );
        const expected: AbridgedAutocompleteFieldAccess = [];
        const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
