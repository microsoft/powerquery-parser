// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../common";
import { AutocompleteItem } from "../../../../inspection";
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

    return maybeAutocompleteFieldAccess.autocompleteItems.map((item: AutocompleteItem) => item.key);
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
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseErrAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        it(`[a = 1][|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[a = 1][|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["a"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`[a = 1, alpha = 2][|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[a = 1, alpha = 2][|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["a", "alpha"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`[a = 1, alpha = 2][a|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[a = 1, alpha = 2][a|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["alpha"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`[a = 1, alpha = 2][a |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[a = 1, alpha = 2][a |`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`[a = 1, alpha = 2][b|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[a = 1, alpha = 2][b|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

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

        it("WIP let x = () => [a = 1, alpha = 2] in x()[|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = () => [a = 1, alpha = 2] in x()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["a", "alpha"];
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

        it("x[|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`x[|`);
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[x = 1][x|]", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[x = 1][x|]`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[xavier = 1][x|]", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[xavier = 1][x|]`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["xavier"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[x = 1, xavier = 2][x|]", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[x = 1, xavier = 2][x|]`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["xavier"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[x = 1, xavier = 2][x |]", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[x = 1, xavier = 2][x |]`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[x = 1, xavier = 2]|[x]", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[x = 1, xavier = 2]|[x]`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[x = 1, xavier = 2]|[x]", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[x = 1, xavier = 2]|[x]`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });
    describe(`Projection`, () => {});
});
