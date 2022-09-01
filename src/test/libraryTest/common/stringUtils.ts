// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { StringUtils } from "../../..";

describe("StringUtils", () => {
    describe(`ensureQuoted`, () => {
        it(``, () => expect(StringUtils.ensureQuoted(``)).to.equal(`""`));
        it(`a`, () => expect(StringUtils.ensureQuoted(`a`)).to.equal(`"a"`));
        it(`"`, () => expect(StringUtils.ensureQuoted(`"`)).to.equal(`""""`));
        it(`""`, () => expect(StringUtils.ensureQuoted(`""`)).to.equal(`""`));
        it(`"a"`, () => expect(StringUtils.ensureQuoted(`"a"`)).to.equal(`"a"`));
    });

    describe(`maybeFindQuote`, () => {
        it(`""`, () => {
            const actual: StringUtils.FoundQuotes | undefined = StringUtils.findQuotes(`""`, 0);

            const expected: StringUtils.FoundQuotes = {
                indexStart: 0,
                indexEnd: 2,
                quoteLength: 2,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`""""`, () => {
            const actual: StringUtils.FoundQuotes | undefined = StringUtils.findQuotes(`""""`, 0);

            const expected: StringUtils.FoundQuotes = {
                indexStart: 0,
                indexEnd: 4,
                quoteLength: 4,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`"""a"""`, () => {
            const actual: StringUtils.FoundQuotes | undefined = StringUtils.findQuotes(`"""a"""`, 0);

            const expected: StringUtils.FoundQuotes = {
                indexStart: 0,
                indexEnd: 7,
                quoteLength: 7,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`"""abc"""`, () => {
            const actual: StringUtils.FoundQuotes | undefined = StringUtils.findQuotes(`"""abc"""`, 0);

            const expected: StringUtils.FoundQuotes = {
                indexStart: 0,
                indexEnd: 9,
                quoteLength: 9,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`"`, () => expect(StringUtils.findQuotes(`"`, 0)).to.be.undefined);
        it(`"abc`, () => expect(StringUtils.findQuotes(`"abc`, 0)).to.be.undefined);

        it(`_""`, () => {
            const actual: StringUtils.FoundQuotes | undefined = StringUtils.findQuotes(`_""`, 1);

            const expected: StringUtils.FoundQuotes = {
                indexStart: 1,
                indexEnd: 3,
                quoteLength: 2,
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`_"a"`, () => {
            const actual: StringUtils.FoundQuotes | undefined = StringUtils.findQuotes(`_"a"`, 1);

            const expected: StringUtils.FoundQuotes = {
                indexStart: 1,
                indexEnd: 4,
                quoteLength: 3,
            };

            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`maybeNormalizeNumber`, () => {
        // tslint:disable-next-line: chai-vague-errors
        it(`foo`, () => expect(StringUtils.normalizeNumber(`foo`)).to.be.undefined);
        it(`1`, () => expect(StringUtils.normalizeNumber(`1`)).to.equal("1"));
        it(`-1`, () => expect(StringUtils.normalizeNumber(`-1`)).to.equal("-1"));
        it(`--1`, () => expect(StringUtils.normalizeNumber(`--1`)).to.equal("1"));
        it(`+1`, () => expect(StringUtils.normalizeNumber(`+1`)).to.equal("1"));
        it(`-+1`, () => expect(StringUtils.normalizeNumber(`-+1`)).to.equal("-1"));
        it(`+-1`, () => expect(StringUtils.normalizeNumber(`+-1`)).to.equal("-1"));
        it(`--1E1`, () => expect(StringUtils.normalizeNumber(`--1E1`)).to.equal("1E1"));
        it(`0x1`, () => expect(StringUtils.normalizeNumber(`0x1`)).to.equal("0x1"));
        it(`-0x1`, () => expect(StringUtils.normalizeNumber(`-0x1`)).to.equal("-0x1"));
        it(`0X1`, () => expect(StringUtils.normalizeNumber(`0X1`)).to.equal("0x1"));
        it(`-0X1`, () => expect(StringUtils.normalizeNumber(`-0X1`)).to.equal("-0x1"));
    });
});
