// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from ".";

export function assertDelete<K, V>(map: Map<K, V>, key: K, message?: string, details?: object): void {
    Assert.isTrue(map.delete(key), message ?? `failed to delete, key is absent`, details ?? { key });
}

export function assertGet<K, V>(map: Map<K, V> | ReadonlyMap<K, V>, key: K, message?: string, details?: object): V {
    return Assert.asDefined(map.get(key), message ?? `key not found in given map`, details ?? { key });
}

export function assertHas<K, V>(map: Map<K, V> | ReadonlyMap<K, V>, key: K, message?: string): void {
    Assert.isTrue(map.has(key), message ?? `key is absent`, { key });
}

export function assertNotIn<K, V>(map: Map<K, V> | ReadonlyMap<K, V>, key: K, message?: string): void {
    Assert.isFalse(map.has(key), message ?? `key is present`, { key });
}

export function filter<K, V>(map: Map<K, V> | ReadonlyMap<K, V>, predicate: (key: K, value: V) => boolean): Map<K, V> {
    const filtered: Map<K, V> = new Map();

    for (const [key, value] of map.entries()) {
        if (predicate(key, value)) {
            filtered.set(key, value);
        }
    }

    return filtered;
}

export function hasKeys<K, V>(map: Map<K, V> | ReadonlyMap<K, V>, keys: ReadonlyArray<K>): boolean {
    for (const key of keys) {
        if (!map.has(key)) {
            return false;
        }
    }

    return true;
}

export function isEqualMap<K, V>(
    left: Map<K, V> | ReadonlyMap<K, V>,
    right: Map<K, V> | ReadonlyMap<K, V>,
    comparer: (left: V, right: V) => boolean,
): boolean {
    if (left.size !== right.size) {
        return false;
    }

    for (const [leftKey, leftValue] of left.entries()) {
        if (!right.has(leftKey)) {
            return false;
        }

        const value: V = right.get(leftKey) as V;

        if (!comparer(leftValue, value)) {
            return false;
        }
    }

    return true;
}

export function isSubsetMap<K, V>(
    left: Map<K, V> | ReadonlyMap<K, V>,
    right: Map<K, V> | ReadonlyMap<K, V>,
    comparer: (left: V, right: V) => boolean,
): boolean {
    if (left.size > right.size) {
        return false;
    }

    for (const [key, leftType] of left.entries()) {
        if (!right.has(key)) {
            return false;
        }

        const rightType: V = right.get(key) as V;

        if (!comparer(leftType, rightType)) {
            return false;
        }
    }

    return true;
}

export function pick<K, V>(map: Map<K, V> | ReadonlyMap<K, V>, keys: ReadonlyArray<K>): Map<K, V> {
    const newMap: Map<K, V> = new Map();

    for (const key of keys) {
        newMap.set(key, Assert.asDefined(map.get(key), `key from keys is not found in map`, { key }));
    }

    return newMap;
}
