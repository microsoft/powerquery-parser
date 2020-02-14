// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultTemplates, ILocalizationTemplates, Localization } from "../localization";
export type TInnerCommonError = InvariantError | UnknownError;

export class CommonError extends Error {
    constructor(readonly innerError: TInnerCommonError) {
        super(innerError.message);
    }
}

export class InvariantError extends Error {
    constructor(readonly invariantBroken: string, readonly maybeDetails: any | undefined = undefined) {
        super(Localization.error_common_invariantError(DefaultTemplates, invariantBroken, maybeDetails));
    }
}

export class UnknownError extends Error {
    constructor(templates: ILocalizationTemplates, readonly innerError: any) {
        super(Localization.error_common_unknown(templates, innerError));
    }
}

export function isTInnerCommonError(x: any): x is TInnerCommonError {
    return x instanceof InvariantError || x instanceof UnknownError;
}

export function ensureCommonError(templates: ILocalizationTemplates, err: Error): CommonError {
    if (isTInnerCommonError(err)) {
        return new CommonError(err);
    } else {
        return new CommonError(new UnknownError(templates, err));
    }
}
