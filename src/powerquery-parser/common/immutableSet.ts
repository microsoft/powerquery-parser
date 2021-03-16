// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export class ImmutableSet<T> {
    public readonly size: number;
    private readonly internalSet: Set<T>;

    public constructor(
        iterable: Iterable<T> = [],
        private readonly predicateFn: (left: T, right: T) => boolean = (left: T, right: T) => left === right,
    ) {
        this.internalSet = new Set(iterable);
        this.size = this.internalSet.size;
    }

    public add(value: T): ImmutableSet<T> {
        if (this.has(value)) {
            return this;
        } else {
            return new ImmutableSet(new Set([...this.values(), value]), this.predicateFn);
        }
    }

    public clear(): void {
        this.internalSet.clear();
    }

    public delete(value: T): ImmutableSet<T> {
        const values: ReadonlyArray<T> = [...this.internalSet.values()].filter(
            (item: T) => !this.predicateFn(item, value),
        );

        if (values.length === this.internalSet.size) {
            return this;
        } else {
            return new ImmutableSet(new Set(values), this.predicateFn);
        }
    }

    public has(value: T): boolean {
        for (const internalValue of this.values()) {
            if (this.predicateFn(value, internalValue)) {
                return true;
            }
        }

        return false;
    }

    public values(): IterableIterator<T> {
        return this.internalSet.keys();
    }
}
