import { CommonError } from ".";

export function removeFirstInstance<T>(collection: ReadonlyArray<T>, element: T): ReadonlyArray<T> {
    return removeAtIndex(collection, collection.indexOf(element));
}

export function removeAtIndex<T>(collection: ReadonlyArray<T>, index: number): ReadonlyArray<T> {
    if (index < 0 || index >= collection.length) {
        const details: {} = {
            index,
            collectionLength: collection.length,
        };
        throw new CommonError.InvariantError("index not within array bounds", details);
    }

    return [...collection.slice(0, index), ...collection.slice(index + 1)];
}

export function addElement<T>(collection: ReadonlyArray<T>, element: T): ReadonlyArray<T> {
    return [...collection, element];
}
