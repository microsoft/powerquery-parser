// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { StringUtils } from "../../..";

describe("StringUtils", () => {
    describe(`isRegularIdentifier`, () => {
        describe(`valid`, () => {
            it(`foo`, () => expect(StringUtils.isRegularIdentifier("foo", false), "should be true").to.be.true);
            it(`foo`, () => expect(StringUtils.isRegularIdentifier("foo", true), "should be true").to.be.true);
            it(`foo.`, () => expect(StringUtils.isRegularIdentifier("foo.", true), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it(`foo.`, () => expect(StringUtils.isRegularIdentifier("foo.", false), "should be false").to.be.false);
        });
    });

    describe(`isGeneralizedIdentifier`, () => {
        describe(`valid`, () => {
            it("a", () => expect(StringUtils.isGeneralizedIdentifier("a"), "should be true").to.be.true);
            it("a.1", () => expect(StringUtils.isGeneralizedIdentifier("a.1"), "should be true").to.be.true);
            it("a b", () => expect(StringUtils.isGeneralizedIdentifier("a b"), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it("a..1", () => expect(StringUtils.isGeneralizedIdentifier("a..1"), "should be false").to.be.false);
        });
    });

    describe(`isQuotedIdentifier`, () => {
        describe(`valid`, () => {
            it(`#"foo"`, () => expect(StringUtils.isQuotedIdentifier(`#"foo"`), "should be true").to.be.true);
            it(`#""`, () => expect(StringUtils.isQuotedIdentifier(`#""`), "should be true").to.be.true);
            it(`#""""`, () => expect(StringUtils.isQuotedIdentifier(`#""""`), "should be true").to.be.true);
            it(`#"a""b""c"`, () => expect(StringUtils.isQuotedIdentifier(`#"a""b""c"`), "should be true").to.be.true);
            it(`#"""b""c"`, () => expect(StringUtils.isQuotedIdentifier(`#"""b""c"`), "should be true").to.be.true);
            it(`#"a""b"""`, () => expect(StringUtils.isQuotedIdentifier(`#"a""b"""`), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it(`#"`, () => expect(StringUtils.isGeneralizedIdentifier(`#"`), "should be false").to.be.false);
            it(`""`, () => expect(StringUtils.isGeneralizedIdentifier(`""`), "should be false").to.be.false);
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
