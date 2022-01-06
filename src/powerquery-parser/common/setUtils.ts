import { Assert } from ".";

export function assertAddUnique<T>(collection: Set<T>, item: T, maybeMessage?: string, maybeDetails?: object): void {
    Assert.isFalse(
        collection.has(item),
        maybeMessage ?? `collection expected to not already contain the given item`,
        maybeDetails ?? { item },
    );

    collection.add(item);
}

export function assertDelete<T>(collection: Set<T>, item: T, maybeMessage?: string, maybeDetails?: object): void {
    Assert.isTrue(
        collection.delete(item),
        maybeMessage ?? `collection expected to contain the given item`,
        maybeDetails ?? { item },
    );
}
