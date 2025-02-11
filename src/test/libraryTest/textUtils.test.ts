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
});
