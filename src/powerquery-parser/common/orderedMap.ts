// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from ".";
import { TPowerQueryType } from "../language/type/type";

export class OrderedMap implements Map<string, TPowerQueryType> {
    public size: number;
    public [Symbol.toStringTag]: string;

    private readonly map: Map<string, TPowerQueryType>;
    private order: ReadonlyArray<string>;

    constructor(entries?: readonly (readonly [string, TPowerQueryType])[] | null | undefined) {
        if (!entries) {
            this.map = new Map();
            this.order = [];
            this.size = 0;
        } else {
            this.map = new Map(entries);
            this.order = entries.map(pair => pair[0]);
            this.size = entries.length;
        }
    }
    public [Symbol.iterator](): IterableIterator<[string, TPowerQueryType]> {
        return this.entries();
    }

    public clear(): void {
        this.map.clear();
        this.order = [];
    }

    public delete(key: string): boolean {
        if (this.map.delete(key)) {
            this.order = ArrayUtils.removeFirstInstance(this.order, key);
            return true;
        } else {
            return false;
        }
    }

    public *entries(): IterableIterator<[string, TPowerQueryType]> {
        for (const key of this.order) {
            yield [key, Assert.asDefined(this.map.get(key))];
        }
    }

    public forEach(callbackfn: (value: TPowerQueryType, key: string, map: Map<string, TPowerQueryType>) => void): void {
        for (const [key, value] of this.entries()) {
            callbackfn(value, key, this.map);
        }
    }

    public get(key: string): TPowerQueryType | undefined {
        return this.map.get(key);
    }

    public has(key: string): boolean {
        return this.map.has(key);
    }

    public keys(): IterableIterator<string> {
        return this.map.keys();
    }

    public set(key: string, value: TPowerQueryType, maintainIndex?: boolean): this {
        if (this.has(key)) {
            if (!maintainIndex) {
                this.order = [...ArrayUtils.removeFirstInstance(this.order, key), key];
            }
        } else {
            this.order = [...this.order, key];
        }

        this.map.set(key, value);
        return this;
    }

    public values(): IterableIterator<TPowerQueryType> {
        return this.map.values();
    }
}
