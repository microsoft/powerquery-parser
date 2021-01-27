// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../../common";
import { TType } from "../type";

export type TExternalTypeRequest = ExternalValueTypeRequest | ExternalInvocationTypeRequest;

export type TExternalTypeResolverFn = (request: TExternalTypeRequest) => TType | undefined;

export type TriedExternalType = Result<TType | undefined, CommonError.CommonError>;

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
