// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from ".";

export function assertDelete<K, V>(map: Map<K, V>, key: K, maybeMessage?: string, maybeDetails?: object): void {
    Assert.isTrue(map.delete(key), maybeMessage ?? `failed to delete, key is absent`, maybeDetails ?? { key });
}

export function assertGet<K, V>(map: Map<K, V>, key: K, maybeMessage?: string, maybeDetails?: object): V {
    return Assert.asDefined(map.get(key), maybeMessage ?? `key not found in given map`, maybeDetails ?? { key });
}

export function assertIn<K, V>(map: Map<K, V>, key: K, maybeMessage?: string): void {
    Assert.isTrue(map.has(key), maybeMessage ?? `key is absent`, { key });
}

export function assertNotIn<K, V>(map: Map<K, V>, key: K, maybeMessage?: string): void {
    Assert.isFalse(map.has(key), maybeMessage ?? `key is present`, { key });
}

export function isEqualMap<K, V>(
    left: Map<K, V>,
    right: Map<K, V>,
    valueCmpFn: (left: V, right: V) => boolean,
): boolean {
    if (left.size !== right.size) {
        return false;
    }

    for (const [leftKey, leftValue] of left.entries()) {
        const maybeRightValue: V | undefined = right.get(leftKey);
        if (maybeRightValue === undefined) {
            return false;
        } else if (valueCmpFn(leftValue, maybeRightValue) === false) {
            return false;
        }
    }
    return true;
}

export function isSubsetMap<K, V>(
    left: Map<K, V>,
    right: Map<K, V>,
    valueCmpFn: (left: V, right: V) => boolean,
): boolean {
    if (left.size > right.size) {
        return false;
    }

    for (const [key, leftType] of left.entries()) {
        const maybeRightType: V | undefined = right.get(key);
        if (maybeRightType === undefined || !valueCmpFn(leftType, maybeRightType)) {
            return false;
        }
    }

    return true;
}

export function hasCollection<K, V>(map: Map<K, V>, keys: ReadonlyArray<K>): boolean {
    return keys.map((key: K) => map.has(key)).indexOf(false) === -1;
}

export function pick<K, V>(map: Map<K, V>, keys: ReadonlyArray<K>): Map<K, V> {
    const newMap: Map<K, V> = new Map();

    for (const key of keys) {
        newMap.set(key, Assert.asDefined(map.get(key), `key from keys is not found in map`, { key }));
    }

    return newMap;
}
