// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Task } from "../../..";
import { Constant } from "../../../powerquery-parser/language";
import { ParseState } from "../../../powerquery-parser/parser/parseState/parseState";
import { ParseStateUtils } from "../../../powerquery-parser/parser";
import { AssertTestUtils } from "../../testUtils";

describe("ParseStateUtils", () => {
    describe(`isOnConstantKind`, () => {
        it(`should return true when positioned on a matching contextual keyword`, async () => {
            // "optional" is tokenized as Identifier (contextual keyword)
            const text: string = `type [optional x = number]`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

            // Tokens: type, [, optional, x, =, number, ]
            const state: ParseState = ParseStateUtils.newState(parseOk.lexerSnapshot, { tokenIndex: 2 });
            const result: boolean = ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Optional);
            expect(result).to.equal(true);
        });

        it(`should return false when positioned on a non-matching contextual keyword`, async () => {
            const text: string = `type [optional x = number]`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

            const state: ParseState = ParseStateUtils.newState(parseOk.lexerSnapshot, { tokenIndex: 2 });
            const result: boolean = ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Nullable);
            expect(result).to.equal(false);
        });

        it(`should return false when positioned on a non-identifier token`, async () => {
            const text: string = `type [optional x = number]`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

            // Token index 0 is "type" (KeywordType, not Identifier)
            const state: ParseState = ParseStateUtils.newState(parseOk.lexerSnapshot, { tokenIndex: 0 });
            const result: boolean = ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Optional);
            expect(result).to.equal(false);
        });
    });
});
