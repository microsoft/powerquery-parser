// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { StringUtils } from "../../common";

describe("StringUtils", () => {
    describe(`isIdentifier`, () => {
        describe(`valid`, () => {
            it(`foo`, () => expect(StringUtils.isIdentifier("foo", false), "should be true").to.be.true);
            it(`foo`, () => expect(StringUtils.isIdentifier("foo", true), "should be true").to.be.true);
            it(`WIP foo.`, () => expect(StringUtils.isIdentifier("foo.", true), "should be true").to.be.true);
        });
        describe(`invalid`, () => {
            it(`foo.`, () => expect(StringUtils.isIdentifier("foo.", false), "should be false").to.be.false);
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
});
