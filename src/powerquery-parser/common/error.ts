// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Localization, LocalizationUtils, Templates } from "../localization";
import { Assert } from ".";
import { ICancellationToken } from "./cancellationToken/ICancellationToken";

export type TInnerCommonError = CancellationError | InvariantError | UnknownError;

export class CommonError extends Error {
    constructor(readonly innerError: TInnerCommonError) {
        super(innerError.message);
        Object.setPrototypeOf(this, CommonError.prototype);
    }
}

export class CancellationError extends Error {
    constructor(readonly cancellationToken: ICancellationToken, readonly reason: string) {
        super(Localization.error_common_cancellationError(Templates.DefaultTemplates, reason));
        Object.setPrototypeOf(this, CancellationError.prototype);
    }
}

export class InvariantError extends Error {
    constructor(readonly invariantBroken: string, readonly details?: object) {
        super(Localization.error_common_invariantError(Templates.DefaultTemplates, invariantBroken, details));
        Object.setPrototypeOf(this, InvariantError.prototype);
    }
}

export class UnknownError extends Error {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(readonly innerError: any, locale: string) {
        super(Localization.error_common_unknown(LocalizationUtils.getLocalizationTemplates(locale), innerError));
        Object.setPrototypeOf(this, UnknownError.prototype);
    }
}

export function assertIsCommonError(error: unknown): error is CommonError {
    Assert.isTrue(isCommonError(error), "isCommonError(error)");

    return true;
}

export function isCommonError(error: unknown): error is CommonError {
    return error instanceof CommonError;
}

export function isCancellationError(error: Error): error is CancellationError {
    return error instanceof CancellationError;
}

export function isTInnerCommonError(error: unknown): error is TInnerCommonError {
    return error instanceof CancellationError || error instanceof InvariantError || error instanceof UnknownError;
}

export function throwIfCancellationError(error: Error): void {
    if (isCancellationError(error)) {
        throw error;
    }
}

export function ensureCommonError(error: Error, locale: string): CommonError {
    if (error instanceof CommonError) {
        return error;
    } else if (isTInnerCommonError(error)) {
        return new CommonError(error);
    } else {
        return new CommonError(new UnknownError(error, locale));
    }
}
