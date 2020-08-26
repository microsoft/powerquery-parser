// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { DefaultSettings, Settings } from "./settings";

export function defaultSettingsFfactory(maybeCancellationToken: ICancellationToken | undefined): Settings {
    return {
        ...DefaultSettings,
        maybeCancellationToken,
    };
}
