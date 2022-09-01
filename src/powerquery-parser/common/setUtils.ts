import { Assert } from ".";

export function assertAddUnique<T>(collection: Set<T>, item: T, message?: string, details?: object): void {
    Assert.isFalse(
        collection.has(item),
        message ?? `collection expected to not already contain the given item`,
        details ?? { item },
    );

    collection.add(item);
}

export function assertDelete<T>(collection: Set<T>, item: T, message?: string, details?: object): void {
    Assert.isTrue(
        collection.delete(item),
        message ?? `collection expected to contain the given item`,
        details ?? { item },
    );
}
