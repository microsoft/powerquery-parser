// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TType } from "../type";
import { ExternalInvocationTypeRequest, ExternalTypeRequestKind, ExternalValueTypeRequest } from "./externalType";

export function valueTypeRequestFactory(identifierLiteral: string): ExternalValueTypeRequest {
    return {
        kind: ExternalTypeRequestKind.Value,
        identifierLiteral,
    };
}

export function invocationTypeRequestFactory(
    identifierLiteral: string,
    args: ReadonlyArray<TType>,
): ExternalInvocationTypeRequest {
    return {
        kind: ExternalTypeRequestKind.Invocation,
        identifierLiteral,
        args,
    };
}
