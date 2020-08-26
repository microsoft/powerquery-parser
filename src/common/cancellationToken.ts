// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface ICancellationToken {
    isCancelled: () => boolean;
    cancel: () => void;
}

// Cancelled after X milliseconds.
export class TimedCancellationToken implements ICancellationToken {
    private wasForceCancelled: boolean;

    constructor(private readonly cancellationThreshold: number = performance.now()) {
        this.wasForceCancelled = false;
    }

    public isCancelled(): boolean {
        return this.wasForceCancelled || performance.now() >= this.cancellationThreshold;
    }

    public cancel(): void {
        this.wasForceCancelled = true;
    }
}

// Cancelled after X calls of isCancelled.
export class CounterCancellationToken implements ICancellationToken {
    private wasForceCancelled: boolean;
    private counter: number;

    constructor(private readonly cancellationThreshold: number = 1000) {
        this.wasForceCancelled = false;
        this.counter = 0;
    }

    public isCancelled(): boolean {
        this.counter += 1;
        return this.wasForceCancelled || this.counter >= this.cancellationThreshold;
    }

    public cancel(): void {
        this.wasForceCancelled = true;
    }
}
