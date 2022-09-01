// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultSettings, Settings } from "./settings";
import { ICancellationToken } from "../common";

export function createDefaultSettings(cancellationToken: ICancellationToken | undefined): Settings {
    return {
        ...DefaultSettings,
        cancellationToken,
    };
}
