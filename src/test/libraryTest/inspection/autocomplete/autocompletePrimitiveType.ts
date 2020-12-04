// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../powerquery-parser/common";
import { Constant } from "../../../../language";
import { IParseState } from "../../../../powerquery-parser/parser";
import { DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

function assertGetParseOkAutocompleteOkPrimitiveType<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): Inspection.AutocompletePrimitiveType {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseOkAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedPrimitiveType);
    return actual.triedPrimitiveType.value;
}

function assertGetParseErrAutocompleteOkPrimitiveType<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): Inspection.AutocompletePrimitiveType {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseErrAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedPrimitiveType);
    return actual.triedPrimitiveType.value;
}

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it("type|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type|`);
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type |", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type |`);
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type n|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type n|`);
        const expected: Inspection.AutocompletePrimitiveType = [
            Constant.PrimitiveTypeConstantKind.None,
            Constant.PrimitiveTypeConstantKind.Null,
            Constant.PrimitiveTypeConstantKind.Number,
        ];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x|) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x|) => 1`);
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
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
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let a = 1 is |", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let a = 1 is |`,
        );
        const expected: Inspection.AutocompletePrimitiveType = Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
