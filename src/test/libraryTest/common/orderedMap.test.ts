// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { OrderedMap } from "../../../powerquery-parser/common/orderedMap";

describe("OrderedMap", () => {
    describe("constructor", () => {
        it("empty when no entries provided", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            expect(map.size).to.equal(0);
            expect([...map.keys()]).to.deep.equal([]);
        });

        it("from array entries", () => {
            const map: OrderedMap<string, number> = new OrderedMap([
                ["a", 1],
                ["b", 2],
            ]);

            expect(map.size).to.equal(2);
            expect(map.get("a")).to.equal(1);
            expect(map.get("b")).to.equal(2);
        });

        it("from Map", () => {
            const source: Map<string, number> = new Map([
                ["x", 10],
                ["y", 20],
            ]);

            const map: OrderedMap<string, number> = new OrderedMap(source);
            expect(map.size).to.equal(2);
            expect(map.get("x")).to.equal(10);
            expect(map.get("y")).to.equal(20);
        });

        it("from null", () => {
            const map: OrderedMap<string, number> = new OrderedMap(null);
            expect(map.size).to.equal(0);
        });

        it("from undefined", () => {
            const map: OrderedMap<string, number> = new OrderedMap(undefined);
            expect(map.size).to.equal(0);
        });
    });

    describe("set", () => {
        it("adds a new key and increments size", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            expect(map.size).to.equal(1);
            expect(map.get("a")).to.equal(1);
        });

        it("updates value for existing key without changing size", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("a", 99);
            expect(map.size).to.equal(1);
            expect(map.get("a")).to.equal(99);
        });

        it("moves existing key to end by default", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);
            map.set("c", 3);
            map.set("a", 99);
            expect([...map.keys()]).to.deep.equal(["b", "c", "a"]);
        });

        it("preserves position with maintainIndex", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);
            map.set("c", 3);
            map.set("a", 99, true);
            expect([...map.keys()]).to.deep.equal(["a", "b", "c"]);
            expect(map.get("a")).to.equal(99);
        });

        it("returns this for chaining", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            const result: OrderedMap<string, number> = map.set("a", 1);
            expect(result).to.equal(map);
        });
    });

    describe("get", () => {
        it("returns value for existing key", () => {
            const map: OrderedMap<string, number> = new OrderedMap([["a", 1]]);
            expect(map.get("a")).to.equal(1);
        });

        it("returns undefined for missing key", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            expect(map.get("missing")).to.equal(undefined);
        });
    });

    describe("has", () => {
        it("returns true for existing key", () => {
            const map: OrderedMap<string, number> = new OrderedMap([["a", 1]]);
            expect(map.has("a")).to.equal(true);
        });

        it("returns false for missing key", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            expect(map.has("missing")).to.equal(false);
        });
    });

    describe("delete", () => {
        it("removes existing key and decrements size", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);
            expect(map.delete("a")).to.equal(true);
            expect(map.size).to.equal(1);
            expect(map.has("a")).to.equal(false);
            expect(map.get("a")).to.equal(undefined);
        });

        it("returns false for missing key without changing size", () => {
            const map: OrderedMap<string, number> = new OrderedMap([["a", 1]]);
            expect(map.delete("missing")).to.equal(false);
            expect(map.size).to.equal(1);
        });

        it("removes key from iteration order", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);
            map.set("c", 3);
            map.delete("b");
            expect([...map.keys()]).to.deep.equal(["a", "c"]);
        });
    });

    describe("clear", () => {
        it("removes all entries and resets size to 0", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);
            map.set("c", 3);
            expect(map.size).to.equal(3);
            map.clear();
            expect(map.size).to.equal(0);
            expect([...map.keys()]).to.deep.equal([]);
            expect([...map.entries()]).to.deep.equal([]);
        });
    });

    describe("keys", () => {
        it("returns keys in insertion order", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("c", 3);
            map.set("a", 1);
            map.set("b", 2);
            expect([...map.keys()]).to.deep.equal(["c", "a", "b"]);
        });

        it("returns empty iterator for empty map", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            expect([...map.keys()]).to.deep.equal([]);
        });
    });

    describe("values", () => {
        it("returns all values", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);
            expect([...map.values()]).to.have.members([1, 2]);
        });

        it("returns empty iterator for empty map", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            expect([...map.values()]).to.deep.equal([]);
        });
    });

    describe("entries", () => {
        it("returns key-value pairs in insertion order", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("c", 3);
            map.set("a", 1);

            expect([...map.entries()]).to.deep.equal([
                ["c", 3],
                ["a", 1],
            ]);
        });

        it("returns empty iterator for empty map", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            expect([...map.entries()]).to.deep.equal([]);
        });
    });

    describe("forEach", () => {
        it("iterates over all entries in order", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("a", 1);
            map.set("b", 2);

            const collected: [string, number][] = [];
            map.forEach((value: number, key: string) => collected.push([key, value]));

            expect(collected).to.deep.equal([
                ["a", 1],
                ["b", 2],
            ]);
        });

        it("does not call callback for empty map", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            let called: boolean = false;
            map.forEach(() => (called = true));
            expect(called).to.equal(false);
        });
    });

    describe("[Symbol.iterator]", () => {
        it("supports for-of iteration in insertion order", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("b", 2);
            map.set("a", 1);

            const collected: [string, number][] = [];

            for (const entry of map) {
                collected.push(entry);
            }

            expect(collected).to.deep.equal([
                ["b", 2],
                ["a", 1],
            ]);
        });

        it("supports spread", () => {
            const map: OrderedMap<string, number> = new OrderedMap();
            map.set("x", 10);
            expect([...map]).to.deep.equal([["x", 10]]);
        });
    });
});
