// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert } from "../../../common";
import { IParserState, IParserStateUtils, ParseError } from "../../../parser";
import { TokenWithColumnNumber } from "../../../parser/error";
import { DefaultSettings } from "../../../settings";
import { TestAssertUtils } from "../../testUtils";

function assertGetExpectedTokenKindError(text: string): ParseError.ExpectedTokenKindError {
    const error: ParseError.ParseError<IParserState> = TestAssertUtils.assertGetParseErr(
        DefaultSettings,
        text,
        IParserStateUtils.stateFactory,
    );
    const innerError: ParseError.TInnerParseError = error.innerError;

    Assert.isTrue(
        innerError instanceof ParseError.ExpectedTokenKindError,
        "innerError instanceof ParseError.ExpectedTokenKindError",
    );

    return innerError as ParseError.ExpectedTokenKindError;
}

function assertErrorAt(text: string, lineNumber: number, columnNumber: number, codeUnit: number): void {
    const error: ParseError.ExpectedTokenKindError = assertGetExpectedTokenKindError(text);
    Assert.isDefined(error.maybeFoundToken);
    const foundToken: TokenWithColumnNumber = error.maybeFoundToken;

    expect(foundToken.token.positionStart.codeUnit).to.equal(codeUnit, "codeUnit");
    expect(foundToken.token.positionStart.lineNumber).to.equal(lineNumber, "lineNumber");
    expect(foundToken.columnNumber).to.equal(columnNumber, "columnNumber");
}

describe(`Parser.ColumnNumber`, () => {
    it(`if x foo`, () => {
        assertErrorAt(`if x foo`, 0, 5, 5);
    });

    it(`if x \\nfoo`, () => {
        assertErrorAt(`if x \nfoo`, 1, 0, 6);
    });

    it(`if x \\n foo`, () => {
        assertErrorAt(`if x \n foo`, 1, 1, 7);
    });

    it(`if \u006E\u0303 foo`, () => {
        assertErrorAt(`if \u006E\u0303 foo`, 0, 5, 6);
    });

    it(`if \u006E\u0303 \\nfoo`, () => {
        assertErrorAt(`if \u006E\u0303 \nfoo`, 1, 0, 7);
    });

    it(`if \u006E\u0303 \\n foo`, () => {
        assertErrorAt(`if \u006E\u0303 \n foo`, 1, 1, 8);
    });
});
