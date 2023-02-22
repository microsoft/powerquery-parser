// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "..";
import { ICancellationToken } from "./ICancellationToken";

// Cancelled after X calls are made to isCancelled.
// Not really useful other than as an example of how to create your own cancellation token.
export class CounterCancellationToken implements ICancellationToken {
    private cancelReason: string | undefined;
    private counter: number;
    private wasForceCancelled: boolean;

    constructor(private readonly cancellationThreshold: number) {
        this.wasForceCancelled = false;
        this.counter = 0;
    }

    public isCancelled(): boolean {
        this.counter += 1;

        return this.wasForceCancelled || this.counter >= this.cancellationThreshold;
    }

    public throwIfCancelled(): void {
        if (this.isCancelled()) {
            throw new CommonError.CancellationError(
                this,
                this.cancelReason ?? `Exceeded ${this.cancellationThreshold} calls`,
            );
        }
    }

    public cancel(reason: string): void {
        this.wasForceCancelled = true;
        this.cancelReason = reason;
    }
}

// In case you need to provide a cancellation token but don't want to support cancellation.
export const NoOpCancellationToken: ICancellationToken = {
    isCancelled: () => false,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    throwIfCancelled: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    cancel: () => {},
};

// Cancelled after X milliseconds.
export class TimedCancellationToken implements ICancellationToken {
    private readonly threshold: number;
    private cancelReason: string | undefined;
    private wasForceCancelled: boolean;

    constructor(private readonly milliseconds: number) {
        this.threshold = Date.now() + milliseconds;
        this.wasForceCancelled = false;
    }

    public throwIfCancelled(): void {
        if (this.isCancelled()) {
            throw new CommonError.CancellationError(this, this.cancelReason ?? `Exceeded ${this.milliseconds}ms`);
        }
    }

    public isCancelled(): boolean {
        return this.wasForceCancelled || Date.now() >= this.threshold;
    }

    public cancel(reason: string): void {
        this.wasForceCancelled = true;
        this.cancelReason = reason;
    }
}
