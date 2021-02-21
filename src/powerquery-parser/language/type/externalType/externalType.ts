// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TType } from "../type";

export type TExternalTypeRequest = ExternalValueTypeRequest | ExternalInvocationTypeRequest;

export type TExternalTypeResolverFn = (request: TExternalTypeRequest) => TType | undefined;

export type TExternalInvocationTypeResolverFn = (request: ExternalInvocationTypeRequest) => TType | undefined;

export type TExternalValueTypeResolverFn = (request: ExternalValueTypeRequest) => TType | undefined;

export const enum ExternalTypeRequestKind {
    Invocation = "Invocation",
    Value = "Value",
}

export interface IExternalType {
    readonly kind: ExternalTypeRequestKind;
    readonly identifierLiteral: string;
}

export interface ExternalValueTypeRequest extends IExternalType {
    readonly kind: ExternalTypeRequestKind.Value;
}

export interface ExternalInvocationTypeRequest extends IExternalType {
    readonly kind: ExternalTypeRequestKind.Invocation;
    readonly args: ReadonlyArray<TType>;
}

// A null/no-op resolver for when one is required but shouldn't resolve anything, eg. for test mocks.
export function noOpExternalTypeResolver(_request: TExternalTypeRequest): undefined {
    return undefined;
}
