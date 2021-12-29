// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from ".";
import { Localization, LocalizationUtils, Templates } from "../localization";
import { ICancellationToken } from "./cancellationToken/ICancellationToken";

export type TInnerCommonError = CancellationError | InvariantError | UnknownError;

export class CommonError extends Error {
    constructor(readonly innerError: TInnerCommonError) {
        super(innerError.message);
        Object.setPrototypeOf(this, CommonError.prototype);
    }
}

export class CancellationError extends Error {
    constructor(readonly cancellationToken: ICancellationToken) {
        super(Localization.error_common_cancellationError(Templates.DefaultTemplates));
        Object.setPrototypeOf(this, CancellationError.prototype);
    }
}

export class InvariantError extends Error {
    constructor(readonly invariantBroken: string, readonly maybeDetails?: object) {
        super(Localization.error_common_invariantError(Templates.DefaultTemplates, invariantBroken, maybeDetails));
        Object.setPrototypeOf(this, InvariantError.prototype);
    }
}

export class UnknownError extends Error {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(locale: string, readonly innerError: any) {
        super(Localization.error_common_unknown(LocalizationUtils.getLocalizationTemplates(locale), innerError));
        Object.setPrototypeOf(this, UnknownError.prototype);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertIsCommonError(error: any): error is CommonError {
    Assert.isTrue(isCommonError(error), "isCommonError(error)");
    return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCommonError(error: any): error is CommonError {
    return error instanceof CommonError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTInnerCommonError(x: any): x is TInnerCommonError {
    return x instanceof CancellationError || x instanceof InvariantError || x instanceof UnknownError;
}

export function ensureCommonError(locale: string, error: Error): CommonError {
    if (error instanceof CommonError) {
        return error;
    } else if (isTInnerCommonError(error)) {
        return new CommonError(error);
    } else {
        return new CommonError(new UnknownError(locale, error));
    }
}
