// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultSettings, Settings } from "./settings";
import { ICancellationToken } from "../common";

export function createDefaultSettings(maybeCancellationToken: ICancellationToken | undefined): Settings {
    return {
        ...DefaultSettings,
        maybeCancellationToken,
    };
}
