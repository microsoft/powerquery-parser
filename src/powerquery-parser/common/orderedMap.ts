// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from ".";

export class OrderedMap<K, V> implements Map<K, V> {
    public size: number;

    private readonly map: Map<K, V>;
    private order: ReadonlyArray<K>;

    constructor(entries?: readonly (readonly [K, V])[] | null | undefined | Map<K, V>) {
        if (!entries) {
            this.map = new Map();
            this.order = [];
            this.size = 0;
        } else {
            this.map = new Map(entries);

            if (entries instanceof Map) {
                this.order = [...entries.keys()];
                this.size = entries.size;
            } else {
                this.order = entries.map((pair: readonly [K, V]) => pair[0]);
                this.size = entries.length;
            }
        }
    }
    [Symbol.toStringTag]: string = "OrderedMap";

    public [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries();
    }

    public clear(): void {
        this.map.clear();
        this.order = [];
    }

    public delete(key: K): boolean {
        if (this.map.delete(key)) {
            this.order = ArrayUtils.assertRemoveFirstInstance(this.order, key);

            return true;
        } else {
            return false;
        }
    }

    public *entries(): IterableIterator<[K, V]> {
        for (const key of this.order) {
            yield [key, Assert.asDefined(this.map.get(key))];
        }
    }

    public forEach(callback: (value: V, key: K, map: Map<K, V>) => void): void {
        for (const [key, value] of this.entries()) {
            callback(value, key, this.map);
        }
    }

    public get(key: K): V | undefined {
        return this.map.get(key);
    }

    public has(key: K): boolean {
        return this.map.has(key);
    }

    public keys(): IterableIterator<K> {
        return this.map.keys();
    }

    public set(key: K, value: V, maintainIndex?: boolean): this {
        if (this.has(key)) {
            if (!maintainIndex) {
                this.order = [...ArrayUtils.assertRemoveFirstInstance(this.order, key), key];
            }
        } else {
            this.order = [...this.order, key];
        }

        this.map.set(key, value);

        return this;
    }

    public values(): IterableIterator<V> {
        return this.map.values();
    }
}
