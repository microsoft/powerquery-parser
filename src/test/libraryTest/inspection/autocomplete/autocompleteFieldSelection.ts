// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { AutocompleteOption } from "../../../../inspection";
import { DefaultSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

describe(`WIP Inspection - Autocomplete - FieldSelection`, () => {
    it("let x = [a = 1] in x[|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = [a = 1] in x[|`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = ["a"];
        const actual: ReadonlyArray<AutocompleteOption> = TestAssertUtils.assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
