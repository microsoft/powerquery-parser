// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface ICancellationToken {
    isCancelled: () => boolean;
    throwExceptionIfCancelled: () => void;
    cancel: () => void;
}
