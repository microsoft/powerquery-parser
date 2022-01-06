// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { StringUtils } from "../../..";

describe("StringUtils", () => {
    describe(`maybeFindQuote`, () => {
        it(`""`, () => {
            const actual: StringUtils.FoundQuote | undefined = StringUtils.maybefindQuote(`""`, 0);

            const expected: StringUtils.FoundQuote = {
                indexStart: 0,
                indexEnd: 2,
                quoteLength: 2,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`""""`, () => {
            const actual: StringUtils.FoundQuote | undefined = StringUtils.maybefindQuote(`""""`, 0);

            const expected: StringUtils.FoundQuote = {
                indexStart: 0,
                indexEnd: 4,
                quoteLength: 4,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`"""a"""`, () => {
            const actual: StringUtils.FoundQuote | undefined = StringUtils.maybefindQuote(`"""a"""`, 0);

            const expected: StringUtils.FoundQuote = {
                indexStart: 0,
                indexEnd: 7,
                quoteLength: 7,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`"""abc"""`, () => {
            const actual: StringUtils.FoundQuote | undefined = StringUtils.maybefindQuote(`"""abc"""`, 0);

            const expected: StringUtils.FoundQuote = {
                indexStart: 0,
                indexEnd: 9,
                quoteLength: 9,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`"`, () => expect(StringUtils.maybefindQuote(`"`, 0)).to.be.undefined);
        it(`"abc`, () => expect(StringUtils.maybefindQuote(`"abc`, 0)).to.be.undefined);

        it(`_""`, () => {
            const actual: StringUtils.FoundQuote | undefined = StringUtils.maybefindQuote(`_""`, 1);

            const expected: StringUtils.FoundQuote = {
                indexStart: 1,
                indexEnd: 3,
                quoteLength: 2,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`_"a"`, () => {
            const actual: StringUtils.FoundQuote | undefined = StringUtils.maybefindQuote(`_"a"`, 1);

            const expected: StringUtils.FoundQuote = {
                indexStart: 1,
                indexEnd: 4,
                quoteLength: 3,
            };

            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`maybeNormalizeNumber`, () => {
        // tslint:disable-next-line: chai-vague-errors
        it(`foo`, () => expect(StringUtils.maybeNormalizeNumber(`foo`)).to.be.undefined);
        it(`1`, () => expect(StringUtils.maybeNormalizeNumber(`1`)).to.equal("1"));
        it(`-1`, () => expect(StringUtils.maybeNormalizeNumber(`-1`)).to.equal("-1"));
        it(`--1`, () => expect(StringUtils.maybeNormalizeNumber(`--1`)).to.equal("1"));
        it(`+1`, () => expect(StringUtils.maybeNormalizeNumber(`+1`)).to.equal("1"));
        it(`-+1`, () => expect(StringUtils.maybeNormalizeNumber(`-+1`)).to.equal("-1"));
        it(`+-1`, () => expect(StringUtils.maybeNormalizeNumber(`+-1`)).to.equal("-1"));
        it(`--1E1`, () => expect(StringUtils.maybeNormalizeNumber(`--1E1`)).to.equal("1E1"));
    });
});
