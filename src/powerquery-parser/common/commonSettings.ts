// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "./cancellationToken";
import { TraceManager } from "./trace";

export interface CommonSettings {
    readonly cancellationToken: ICancellationToken | undefined;
    readonly initialCorrelationId: number | undefined;
    readonly locale: string;
    readonly traceManager: TraceManager;
}
