// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { DefaultSettings, Task } from "../../..";
import { TestAssertUtils } from "../../testUtils";

describe("Parser.Children", () => {
    it(`WIP let x = foo(){0} in x`, () => {
        const text: string = `let x = foo(){0} in x`;
        const expected: ReadonlyArray<number> = [2, 6, 7, 11, 12, 15, 17, 19, 22, 23, 24, 28];
        const lexParseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
        const actual: Set<number> = lexParseOk.nodeIdMapCollection.leafNodeIds;
        expect([...actual.values()]).to.have.members(expected);
    });
});
