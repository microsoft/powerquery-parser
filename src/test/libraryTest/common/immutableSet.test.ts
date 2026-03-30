// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { ImmutableSet } from "../../../powerquery-parser/common/immutableSet";

describe("ImmutableSet", () => {
    describe("constructor", () => {
        it("empty when no iterable provided", () => {
            const set: ImmutableSet<number> = new ImmutableSet();
            expect(set.size).to.equal(0);
            expect([...set.values()]).to.deep.equal([]);
        });

        it("from array", () => {
            const set: ImmutableSet<number> = new ImmutableSet([1, 2, 3]);
            expect(set.size).to.equal(3);
            expect(set.has(1)).to.equal(true);
            expect(set.has(2)).to.equal(true);
            expect(set.has(3)).to.equal(true);
        });

        it("from Set", () => {
            const set: ImmutableSet<string> = new ImmutableSet(new Set(["a", "b"]));
            expect(set.size).to.equal(2);
            expect(set.has("a")).to.equal(true);
            expect(set.has("b")).to.equal(true);
        });

        it("with custom comparer", () => {
            const caseInsensitive: (a: string, b: string) => boolean = (a: string, b: string) =>
                a.toLowerCase() === b.toLowerCase();

            const set: ImmutableSet<string> = new ImmutableSet(["Hello"], caseInsensitive);
            expect(set.has("hello")).to.equal(true);
            expect(set.has("HELLO")).to.equal(true);
        });
    });

    describe("has", () => {
        it("returns true for existing value", () => {
            const set: ImmutableSet<number> = new ImmutableSet([10, 20]);
            expect(set.has(10)).to.equal(true);
        });

        it("returns false for missing value", () => {
            const set: ImmutableSet<number> = new ImmutableSet([10, 20]);
            expect(set.has(99)).to.equal(false);
        });

        it("returns false on empty set", () => {
            const set: ImmutableSet<number> = new ImmutableSet();
            expect(set.has(1)).to.equal(false);
        });
    });

    describe("add", () => {
        it("returns a new set containing the value", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1]);
            const result: ImmutableSet<number> = original.add(2);
            expect(result.size).to.equal(2);
            expect(result.has(2)).to.equal(true);
        });

        it("does not mutate the original", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1]);
            original.add(2);
            expect(original.size).to.equal(1);
            expect(original.has(2)).to.equal(false);
        });

        it("returns same instance when value already exists", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2]);
            const result: ImmutableSet<number> = original.add(1);
            expect(result).to.equal(original);
        });

        it("respects custom comparer for duplicate detection", () => {
            const caseInsensitive: (a: string, b: string) => boolean = (a: string, b: string) =>
                a.toLowerCase() === b.toLowerCase();

            const set: ImmutableSet<string> = new ImmutableSet(["Hello"], caseInsensitive);
            const result: ImmutableSet<string> = set.add("hello");
            expect(result).to.equal(set);
        });
    });

    describe("addMany", () => {
        it("adds multiple new values", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1]);
            const result: ImmutableSet<number> = original.addMany([2, 3, 4]);
            expect(result.size).to.equal(4);
            expect(result.has(2)).to.equal(true);
            expect(result.has(4)).to.equal(true);
        });

        it("does not mutate the original", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1]);
            original.addMany([2, 3]);
            expect(original.size).to.equal(1);
        });

        it("skips values that already exist", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2]);
            const result: ImmutableSet<number> = original.addMany([2, 3]);
            expect(result.size).to.equal(3);
        });

        it("returns same instance when all values already exist", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2]);
            const result: ImmutableSet<number> = original.addMany([1, 2]);
            expect(result).to.equal(original);
        });
    });

    describe("delete", () => {
        it("returns a new set without the value", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2, 3]);
            const result: ImmutableSet<number> = original.delete(2);
            expect(result.size).to.equal(2);
            expect(result.has(2)).to.equal(false);
            expect(result.has(1)).to.equal(true);
            expect(result.has(3)).to.equal(true);
        });

        it("does not mutate the original", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2]);
            original.delete(1);
            expect(original.size).to.equal(2);
            expect(original.has(1)).to.equal(true);
        });

        it("returns same instance when value does not exist", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2]);
            const result: ImmutableSet<number> = original.delete(99);
            expect(result).to.equal(original);
        });

        it("respects custom comparer", () => {
            const caseInsensitive: (a: string, b: string) => boolean = (a: string, b: string) =>
                a.toLowerCase() === b.toLowerCase();

            const set: ImmutableSet<string> = new ImmutableSet(["Hello", "World"], caseInsensitive);
            const result: ImmutableSet<string> = set.delete("hello");
            expect(result.size).to.equal(1);
            expect(result.has("Hello")).to.equal(false);
            expect(result.has("World")).to.equal(true);
        });
    });

    describe("clear", () => {
        it("returns a new empty set", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2, 3]);
            const cleared: ImmutableSet<number> = original.clear();
            expect(cleared.size).to.equal(0);
            expect([...cleared.values()]).to.deep.equal([]);
        });

        it("does not mutate the original", () => {
            const original: ImmutableSet<number> = new ImmutableSet([1, 2, 3]);
            original.clear();
            expect(original.size).to.equal(3);
            expect(original.has(1)).to.equal(true);
        });

        it("cleared set preserves the comparer", () => {
            const caseInsensitive: (a: string, b: string) => boolean = (a: string, b: string) =>
                a.toLowerCase() === b.toLowerCase();

            const original: ImmutableSet<string> = new ImmutableSet(["Hello"], caseInsensitive);
            const cleared: ImmutableSet<string> = original.clear();
            const result: ImmutableSet<string> = cleared.add("World").add("world");
            expect(result.size).to.equal(1);
        });
    });

    describe("values", () => {
        it("returns all values", () => {
            const set: ImmutableSet<number> = new ImmutableSet([1, 2, 3]);
            expect([...set.values()]).to.have.members([1, 2, 3]);
        });

        it("returns empty iterator for empty set", () => {
            const set: ImmutableSet<number> = new ImmutableSet();
            expect([...set.values()]).to.deep.equal([]);
        });
    });

    describe("size", () => {
        it("reflects the number of elements", () => {
            expect(new ImmutableSet().size).to.equal(0);
            expect(new ImmutableSet([1]).size).to.equal(1);
            expect(new ImmutableSet([1, 2, 3]).size).to.equal(3);
        });
    });
});
