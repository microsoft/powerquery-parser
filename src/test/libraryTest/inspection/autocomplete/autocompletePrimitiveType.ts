// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { AutocompleteOption } from "../../../../inspection";
import { Constant } from "../../../../language";
import { DefaultSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it("type|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type|`);
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type |", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type |`);
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = type|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = type|`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = type |", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = type |`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type | number", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `type | number`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type n|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type n|`);
        const expected: ReadonlyArray<AutocompleteOption> = [
            Constant.PrimitiveTypeConstantKind.None,
            Constant.PrimitiveTypeConstantKind.Null,
            Constant.PrimitiveTypeConstantKind.Number,
        ];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x|) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x|) => 1`);
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as| number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as | number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as | number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as| nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as| nullable number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as | nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as | nullable number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as nullable| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as nullable| number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as nullable num|ber) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as nullable num|ber) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
