import { Assert } from ".";

export function all<T>(
    collection: ReadonlyArray<T>,
    predicateFn: (value: T) => boolean = (value: T) => Boolean(value),
): boolean {
    for (const element of collection) {
        if (!predicateFn(element)) {
            return false;
        }
    }

    return true;
}

export function assertIn<T>(
    collection: ReadonlyArray<T>,
    item: T,
    maybeMessage?: string,
    maybeDetails?: object,
): number {
    const index: number = collection.indexOf(item);
    Assert.isTrue(index !== -1, maybeMessage, maybeDetails ?? { item });
    return index;
}

export function assertGet<T>(
    collection: ReadonlyArray<T>,
    index: number,
    maybeMessage?: string,
    maybeDetails?: object,
): T {
    return Assert.asDefined(collection[index], maybeMessage, maybeDetails);
}

export function assertIndexOfPredicate<T>(
    collection: ReadonlyArray<T>,
    predicateFn: (element: T) => boolean,
    maybeMessage?: string,
    maybeDetails?: object,
): number {
    const index: number = indexOfPredicate(collection, predicateFn);
    Assert.isTrue(index !== -1, maybeMessage, maybeDetails);
    return index;
}

export function assertNonZeroLength<T>(
    collection: ReadonlyArray<T>,
    maybeMessage?: string,
    maybeDetails?: object,
): void {
    Assert.isTrue(
        collection.length > 0,
        maybeMessage ?? `collection should have at least one element in it`,
        maybeDetails ?? {
            collectionLength: collection.length,
        },
    );
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

export function includesPredicate<T>(collection: ReadonlyArray<T>, predicateFn: (element: T) => boolean): boolean {
    const numElements: number = collection.length;
    for (let index: number = 0; index < numElements; index += 1) {
        if (predicateFn(collection[index])) {
            return true;
        }
    }

    return false;
}

export function includesUnique<T>(
    collection: ReadonlyArray<T>,
    testValue: T,
    equalityFn: (left: T, right: T) => boolean,
): boolean {
    return includesPredicate(collection, (collectionItem: T) => equalityFn(testValue, collectionItem));
}

export function indexOfPredicate<T>(collection: ReadonlyArray<T>, predicateFn: (element: T) => boolean): number {
    const numElements: number = collection.length;
    for (let index: number = 0; index < numElements; index += 1) {
        if (predicateFn(collection[index])) {
            return index;
        }
    }

    return -1;
}

export function isSubset<T>(
    largerCollection: ReadonlyArray<T>,
    smallerCollection: ReadonlyArray<T>,
    equalityFn: (left: T, right: T) => boolean = (left: T, right: T) => left === right,
): boolean {
    if (smallerCollection.length > largerCollection.length) {
        return false;
    }

    for (const smallerCollectionValue of smallerCollection) {
        let foundMatch: boolean = false;
        for (const largerCollectionValue of largerCollection) {
            if (equalityFn(smallerCollectionValue, largerCollectionValue)) {
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
    splitFn: (value: T) => boolean,
): [ReadonlyArray<T>, ReadonlyArray<T>] {
    const left: T[] = [];
    const right: T[] = [];

    for (const value of collection) {
        if (splitFn(value) === true) {
            left.push(value);
        } else {
            right.push(value);
        }
    }

    return [left, right];
}
