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

export function assertIn<T>(collection: ReadonlyArray<T>, item: T, message?: string, details?: object): number {
    const index: number = collection.indexOf(item);
    Assert.isTrue(index !== -1, message, details ?? { item });

    return index;
}

export function assertGet<T>(collection: ReadonlyArray<T>, index: number, message?: string, details?: object): T {
    return Assert.asDefined(collection[index], message, details);
}

export function assertIndexOfPredicate<T>(
    collection: ReadonlyArray<T>,
    predicate: (element: T) => boolean,
    message?: string,
    details?: object,
): number {
    const index: number = indexOfPredicate(collection, predicate);
    Assert.isTrue(index !== -1, message, details);

    return index;
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

export async function mapAsync<T, U>(
    collection: ReadonlyArray<T>,
    map: (value: T) => Promise<U>,
): Promise<ReadonlyArray<U>> {
    const tasks: ReadonlyArray<Promise<U>> = collection.map(map);

    return await Promise.all(tasks);
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

export function enumerate<T>(collection: ReadonlyArray<T>): ReadonlyArray<[number, T]> {
    return range(collection.length, 0).map((index: number) => [index, collection[index]]);
}

export function findReverse<T>(collection: ReadonlyArray<T>, predicate: (t: T) => boolean): T | undefined {
    const numElements: number = collection.length;

    for (let index: number = numElements - 1; index >= 0; index -= 1) {
        const element: T = collection[index];

        if (predicate(element)) {
            return element;
        }
    }

    return undefined;
}

export function includesPredicate<T>(collection: ReadonlyArray<T>, predicate: (element: T) => boolean): boolean {
    const numElements: number = collection.length;

    for (let index: number = 0; index < numElements; index += 1) {
        if (predicate(collection[index])) {
            return true;
        }
    }

    return false;
}

export function includesUnique<T>(
    collection: ReadonlyArray<T>,
    testValue: T,
    comparer: (left: T, right: T) => boolean,
): boolean {
    return includesPredicate(collection, (collectionItem: T) => comparer(testValue, collectionItem));
}

export function indexOfPredicate<T>(collection: ReadonlyArray<T>, predicate: (element: T) => boolean): number {
    const numElements: number = collection.length;

    for (let index: number = 0; index < numElements; index += 1) {
        if (predicate(collection[index])) {
            return index;
        }
    }

    return -1;
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

export function range(size: number, startAt: number = 0): ReadonlyArray<number> {
    // tslint:disable-next-line: prefer-array-literal
    return [...Array(size).keys()].map((index: number) => index + startAt);
}

export function replaceAtIndex<T>(collection: ReadonlyArray<T>, value: T, index: number): T[] {
    Assert.isFalse(index < 0 || index >= collection.length, "index < 0 || index >= collection.length", {
        index,
        collectionLength: collection.length,
    });

    return [...collection.slice(0, index), value, ...collection.slice(index + 1)];
}

export function removeFirstInstance<T>(collection: ReadonlyArray<T>, element: T): T[] {
    return removeAtIndex(collection, collection.indexOf(element));
}

export function replaceFirstInstance<T>(collection: ReadonlyArray<T>, oldValue: T, newValue: T): T[] {
    return replaceAtIndex(collection, newValue, collection.indexOf(oldValue));
}

export function removeAtIndex<T>(collection: ReadonlyArray<T>, index: number): T[] {
    Assert.isFalse(index < 0 || index >= collection.length, "index < 0 || index >= collection.length", {
        index,
        collectionLength: collection.length,
    });

    return [...collection.slice(0, index), ...collection.slice(index + 1)];
}

export function split<T>(
    collection: ReadonlyArray<T>,
    splitter: (value: T) => boolean,
): [ReadonlyArray<T>, ReadonlyArray<T>] {
    const left: T[] = [];
    const right: T[] = [];

    for (const value of collection) {
        if (splitter(value) === true) {
            left.push(value);
        } else {
            right.push(value);
        }
    }

    return [left, right];
}
