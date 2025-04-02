// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { IdentifierUtils } from "../../powerquery-parser/language";

describe("IdentifierUtils", () => {
    describe(`isRegularIdentifier`, () => {
        describe(`valid`, () => {
            it(`foo`, () => expect(IdentifierUtils.isRegularIdentifier("foo", false), "should be true").to.be.true);
            it(`foo`, () => expect(IdentifierUtils.isRegularIdentifier("foo", true), "should be true").to.be.true);
            it(`foo.`, () => expect(IdentifierUtils.isRegularIdentifier("foo.", true), "should be true").to.be.true);
            it(`foo.1`, () => expect(IdentifierUtils.isRegularIdentifier("foo.1", true), "should be true").to.be.true);

            it(`foo.bar123`, () =>
                expect(IdentifierUtils.isRegularIdentifier("foo.bar123", true), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it(`foo.`, () => expect(IdentifierUtils.isRegularIdentifier("foo.", false), "should be false").to.be.false);
        });
    });

    describe(`isGeneralizedIdentifier`, () => {
        describe(`valid`, () => {
            it("a", () => expect(IdentifierUtils.isGeneralizedIdentifier("a"), "should be true").to.be.true);
            it("a.1", () => expect(IdentifierUtils.isGeneralizedIdentifier("a.1"), "should be true").to.be.true);
            it("a b", () => expect(IdentifierUtils.isGeneralizedIdentifier("a b"), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it("a..1", () => expect(IdentifierUtils.isGeneralizedIdentifier("a..1"), "should be false").to.be.false);
        });
    });

    describe(`isQuotedIdentifier`, () => {
        describe(`valid`, () => {
            it(`#"foo"`, () => expect(IdentifierUtils.isQuotedIdentifier(`#"foo"`), "should be true").to.be.true);
            it(`#""`, () => expect(IdentifierUtils.isQuotedIdentifier(`#""`), "should be true").to.be.true);
            it(`#""""`, () => expect(IdentifierUtils.isQuotedIdentifier(`#""""`), "should be true").to.be.true);

            it(`#"a""b""c"`, () =>
                expect(IdentifierUtils.isQuotedIdentifier(`#"a""b""c"`), "should be true").to.be.true);

            it(`#"""b""c"`, () => expect(IdentifierUtils.isQuotedIdentifier(`#"""b""c"`), "should be true").to.be.true);
            it(`#"a""b"""`, () => expect(IdentifierUtils.isQuotedIdentifier(`#"a""b"""`), "should be true").to.be.true);
            it(`#"bar.1"`, () => expect(IdentifierUtils.isQuotedIdentifier(`#"foo"`), "should be true").to.be.true);
        });

        describe(`invalid`, () => {
            it(`#"`, () => expect(IdentifierUtils.isGeneralizedIdentifier(`#"`), "should be false").to.be.false);
            it(`""`, () => expect(IdentifierUtils.isGeneralizedIdentifier(`""`), "should be false").to.be.false);
        });
    });
});
