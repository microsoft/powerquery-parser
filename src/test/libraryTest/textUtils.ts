// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { TextUtils } from "../../powerquery-parser/language";

describe("TextUtils", () => {
    it(`escape`, () => {
        const unescaped: string = 'Encode \t\t and \r\n and "quotes" but not this #(tab)';
        const escaped: string = 'Encode #(tab)#(tab) and #(cr,lf) and ""quotes"" but not this #(#)(tab)';

        expect(TextUtils.escape(unescaped)).to.equal(escaped);
        expect(TextUtils.unescape(escaped)).to.equal(unescaped);
    });

    describe(`isRegularIdentifier`, () => {
        describe(`valid`, () => {
            it(`foo`, () => expect(TextUtils.isRegularIdentifier("foo", false), "should be true").to.be.true);
            it(`foo`, () => expect(TextUtils.isRegularIdentifier("foo", true), "should be true").to.be.true);
            it(`foo.`, () => expect(TextUtils.isRegularIdentifier("foo.", true), "should be true").to.be.true);
            it(`foo.1`, () => expect(TextUtils.isRegularIdentifier("foo.1", true), "should be true").to.be.true);

            it(`foo.bar123`, () =>
                expect(TextUtils.isRegularIdentifier("foo.bar123", true), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it(`foo.`, () => expect(TextUtils.isRegularIdentifier("foo.", false), "should be false").to.be.false);
        });
    });

    describe(`isGeneralizedIdentifier`, () => {
        describe(`valid`, () => {
            it("a", () => expect(TextUtils.isGeneralizedIdentifier("a"), "should be true").to.be.true);
            it("a.1", () => expect(TextUtils.isGeneralizedIdentifier("a.1"), "should be true").to.be.true);
            it("a b", () => expect(TextUtils.isGeneralizedIdentifier("a b"), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it("a..1", () => expect(TextUtils.isGeneralizedIdentifier("a..1"), "should be false").to.be.false);
        });
    });

    describe(`isQuotedIdentifier`, () => {
        describe(`valid`, () => {
            it(`#"foo"`, () => expect(TextUtils.isQuotedIdentifier(`#"foo"`), "should be true").to.be.true);
            it(`#""`, () => expect(TextUtils.isQuotedIdentifier(`#""`), "should be true").to.be.true);
            it(`#""""`, () => expect(TextUtils.isQuotedIdentifier(`#""""`), "should be true").to.be.true);
            it(`#"a""b""c"`, () => expect(TextUtils.isQuotedIdentifier(`#"a""b""c"`), "should be true").to.be.true);
            it(`#"""b""c"`, () => expect(TextUtils.isQuotedIdentifier(`#"""b""c"`), "should be true").to.be.true);
            it(`#"a""b"""`, () => expect(TextUtils.isQuotedIdentifier(`#"a""b"""`), "should be true").to.be.true);
            it(`#"bar.1"`, () => expect(TextUtils.isQuotedIdentifier(`#"foo"`), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it(`#"`, () => expect(TextUtils.isGeneralizedIdentifier(`#"`), "should be false").to.be.false);
            it(`""`, () => expect(TextUtils.isGeneralizedIdentifier(`""`), "should be false").to.be.false);
        });
    });
});
