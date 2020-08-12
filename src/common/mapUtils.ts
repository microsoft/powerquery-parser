// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from ".";

export function expectGet<K, V>(map: Map<K, V>, key: K): V {
    const maybeValue: V | undefined = map.get(key);
    Assert.isDefined(maybeValue, `key not found in given map`, { key });

    return maybeValue;
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
        const maybeValue: V | undefined = map.get(key);
        Assert.isDefined(maybeValue, `key from keys is not found in map`, { key });
        newMap.set(key, maybeValue);
    }

    return newMap;
}

export function assertDelete<K, V>(map: Map<K, V>, key: K, maybeMessage?: string): void {
    Assert.isTrue(map.delete(key), maybeMessage ?? `delete failed as key is absent`, { key });
}

export function assertHas<K, V>(map: Map<K, V>, key: K, maybeMessage?: string): void {
    Assert.isTrue(map.has(key), maybeMessage ?? `key is absent`, { key });
}
