// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Localization } from "../localization";
import { Option } from "./option";

export type TInnerCommonError = InvariantError | UnknownError;

export class CommonError extends Error {
    constructor(readonly innerError: TInnerCommonError) {
        super(innerError.message);
    }
}

export class InvariantError extends Error {
    constructor(readonly invariantBroken: string, readonly maybeDetails: Option<any> = undefined) {
        super(Localization.error_common_invariantError(invariantBroken, maybeDetails));
    }
}

export class UnknownError extends Error {
    constructor(readonly innerError: any) {
        super(Localization.error_common_unknown(innerError));
    }
}

export function isTInnerCommonError(x: any): x is TInnerCommonError {
    return x instanceof InvariantError || x instanceof UnknownError;
}

export function ensureCommonError(err: Error): CommonError {
    if (isTInnerCommonError(err)) {
        return new CommonError(err);
    } else {
        return new CommonError(new UnknownError(err));
    }
}
