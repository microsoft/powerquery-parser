// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { MapUtils } from "../../..";

describe("MapUtils", () => {
    describe(`isEqualMap`, () => {
        it(`equal maps should return true`, () => {
            const left: Map<string, number> = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            const right: Map<string, number> = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            expect(MapUtils.isEqualMap(left, right, (left: number, right: number) => left === right)).to.equal(true);
        });

        it(`different values should return false`, () => {
            const left: Map<string, number> = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            const right: Map<string, number> = new Map([
                ["a", 1],
                ["b", 99],
            ]);

            expect(MapUtils.isEqualMap(left, right, (left: number, right: number) => left === right)).to.equal(false);
        });

        it(`maps with undefined values should be considered equal when both have the same undefined entry`, () => {
            const left: Map<string, number | undefined> = new Map([
                ["a", 1],
                ["b", undefined],
            ]);

            const right: Map<string, number | undefined> = new Map([
                ["a", 1],
                ["b", undefined],
            ]);

            expect(
                MapUtils.isEqualMap(
                    left,
                    right,
                    (left: number | undefined, right: number | undefined) => left === right,
                ),
            ).to.equal(true);
        });

        it(`maps with different sizes should return false`, () => {
            const left: Map<string, number> = new Map([["a", 1]]);

            const right: Map<string, number> = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            expect(MapUtils.isEqualMap(left, right, (left: number, right: number) => left === right)).to.equal(false);
        });
    });
});
