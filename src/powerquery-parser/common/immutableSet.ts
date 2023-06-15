// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: this needs to be benchmarked
export class ImmutableSet<T> {
    public readonly size: number;
    private internalCollection: ReadonlyArray<T>;

    public constructor(
        iterable: Iterable<T> = [],
        private readonly comparer: (left: T, right: T) => boolean = (left: T, right: T): boolean => left === right,
    ) {
        this.internalCollection = [...iterable];
        this.size = this.internalCollection.length;
    }

    public add(value: T): ImmutableSet<T> {
        if (this.has(value)) {
            return this;
        } else {
            return new ImmutableSet(new Set([...this.values(), value]), this.comparer);
        }
    }

    public addMany(values: Iterable<T>): ImmutableSet<T> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let result: ImmutableSet<T> = this;

        for (const value of values) {
            result = result.add(value);
        }

        return result;
    }

    public clear(): void {
        this.internalCollection = [];
    }

    public delete(value: T): ImmutableSet<T> {
        const values: ReadonlyArray<T> = [...this.internalCollection.values()].filter(
            (item: T) => !this.comparer(item, value),
        );

        if (values.length === this.internalCollection.length) {
            return this;
        } else {
            return new ImmutableSet(new Set(values), this.comparer);
        }
    }

    public has(value: T): boolean {
        for (const element of this.internalCollection) {
            if (this.comparer(element, value)) {
                return true;
            }
        }

        return false;
    }

    public values(): IterableIterator<T> {
        return this.internalCollection.values();
    }
}
