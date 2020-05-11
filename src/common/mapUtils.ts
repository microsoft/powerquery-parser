// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";

export function expectGet<K, V>(map: Map<K, V>, key: K): V {
    const maybeValue: V | undefined = map.get(key);
    if (maybeValue === undefined) {
        const details: {} = { key };
        throw new CommonError.InvariantError(`key not found in given map`, details);
    }
    return maybeValue;
}

export function equalMaps<K, V>(
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
