// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
import { expectTextWithPosition } from "../../../common";

describe(`Inspection - Scope - TokenRange`, () => {
    it(`let Function = () => 1, foo = Func|tion() in foo`, () => {
        const []: [string, Inspection.Position] = expectTextWithPosition(`let x = (let y = 1 in z) in |`);
    });
});
