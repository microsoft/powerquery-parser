import { CommonError } from ".";

export function all<T>(
    collection: ReadonlyArray<T>,
    predicateFn: (value: T) => boolean = (value: T) => !!value,
): boolean {
    for (const element of collection) {
        if (!predicateFn(element)) {
            return false;
        }
    }

    return true;
}

export function removeFirstInstance<T>(collection: ReadonlyArray<T>, element: T): T[] {
    return removeAtIndex(collection, collection.indexOf(element));
}

export function removeAtIndex<T>(collection: ReadonlyArray<T>, index: number): T[] {
    if (index < 0 || index >= collection.length) {
        const details: {} = {
            index,
            collectionLength: collection.length,
        };
        throw new CommonError.InvariantError(`index not within array bounds`, details);
    }

    return [...collection.slice(0, index), ...collection.slice(index + 1)];
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

export function isSubset<T>(
    largerCollection: ReadonlyArray<T>,
    smallerCollection: ReadonlyArray<T>,
    valueCmpFn: (left: T, right: T) => boolean = (left: T, right: T) => left === right,
): boolean {
    if (smallerCollection.length > largerCollection.length) {
        return false;
    }

    for (const smallerCollectionValue of smallerCollection) {
        let foundMatch: boolean = false;
        for (const largerCollectionValue of largerCollection) {
            if (valueCmpFn(smallerCollectionValue, largerCollectionValue)) {
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
