// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { IParserStateUtils } from "../../../parser";
import { DefaultSettings } from "../../../settings";
import { LexParseOk } from "../../../task";
import { TestAssertUtils } from "../../testUtils";

describe("Parser.Children", () => {
    it(`let x = foo(){0} in x`, () => {
        const text: string = `let x = foo(){0} in x`;
        const expected: ReadonlyArray<number> = [2, 6, 7, 12, 15, 17, 19, 22, 23, 24, 28];
        const lexParseOk: LexParseOk = TestAssertUtils.assertLexParseOk(
            DefaultSettings,
            text,
            IParserStateUtils.stateFactory,
        );
        const actual: ReadonlyArray<number> = lexParseOk.state.contextState.leafNodeIds;
        expect(expected).to.have.members(actual);
    });
});
