// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from ".";

export function all<T>(
    collection: ReadonlyArray<T>,
    predicate: (value: T) => boolean = (value: T): boolean => Boolean(value),
): boolean {
    for (const element of collection) {
        if (!predicate(element)) {
            return false;
        }
    }

    return true;
}

export function assertGet<T>(collection: ReadonlyArray<T>, index: number, message?: string, details?: object): T {
    return Assert.asDefined(collection[index], message, details);
}

export function assertIncludes<T>(collection: ReadonlyArray<T>, element: T, message?: string, details?: object): void {
    Assert.isTrue(
        collection.includes(element),
        message ?? "collection.includes(element) failed",
        details ?? { collection, element },
    );
}

export function assertNonZeroLength<T>(collection: ReadonlyArray<T>, message?: string, details?: object): void {
    Assert.isTrue(
        collection.length > 0,
        message ?? `collection should have at least one element in it`,
        details ?? {
            collectionLength: collection.length,
        },
    );
}

export function assertReplaceAtIndex<T>(collection: ReadonlyArray<T>, value: T, index: number): T[] {
    Assert.isFalse(index < 0 || index >= collection.length, "index < 0 || index >= collection.length", {
        index,
        collectionLength: collection.length,
    });

    return [...collection.slice(0, index), value, ...collection.slice(index + 1)];
}

export function assertRemoveFirstInstance<T>(collection: ReadonlyArray<T>, element: T): T[] {
    return assertRemoveAtIndex(collection, collection.indexOf(element));
}

export function assertReplaceFirstInstance<T>(collection: ReadonlyArray<T>, oldValue: T, newValue: T): T[] {
    return assertReplaceAtIndex(collection, newValue, collection.indexOf(oldValue));
}

export function assertRemoveAtIndex<T>(collection: ReadonlyArray<T>, index: number): T[] {
    Assert.isFalse(index < 0 || index >= collection.length, "index < 0 || index >= collection.length", {
        index,
        collectionLength: collection.length,
    });

    return [...collection.slice(0, index), ...collection.slice(index + 1)];
}

export function concatUnique<T>(left: ReadonlyArray<T>, right: ReadonlyArray<T>): ReadonlyArray<T> {
    const partial: T[] = [...left];

    for (const element of right) {
        if (partial.indexOf(element) === -1) {
            partial.push(element);
        }
    }

    return partial;
}

export function enumerate<T>(collection: ReadonlyArray<T>): ReadonlyArray<[T, number]> {
    return collection.map((value: T, index: number) => [value, index]);
}

export function isSubset<T>(
    largerCollection: ReadonlyArray<T>,
    smallerCollection: ReadonlyArray<T>,
    comparer: (left: T, right: T) => boolean = (left: T, right: T): boolean => left === right,
): boolean {
    if (smallerCollection.length > largerCollection.length) {
        return false;
    }

    for (const smallerCollectionValue of smallerCollection) {
        let foundMatch: boolean = false;

        for (const largerCollectionValue of largerCollection) {
            if (comparer(smallerCollectionValue, largerCollectionValue)) {
                foundMatch = true;
                break;
            }
        }

        if (foundMatch === false) {
            return false;
        }
    }

    return true;
}

export async function mapAsync<T, U>(
    collection: ReadonlyArray<T>,
    map: (value: T) => Promise<U>,
): Promise<ReadonlyArray<U>> {
    const tasks: ReadonlyArray<Promise<U>> = collection.map(map);

    return await Promise.all(tasks);
}

export function range(size: number, startAt: number = 0): ReadonlyArray<number> {
    // tslint:disable-next-line: prefer-array-literal
    return [...Array(size).keys()].map((index: number) => index + startAt);
}
