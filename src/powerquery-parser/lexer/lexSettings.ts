// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonSettings } from "../common";

export interface LexSettings extends CommonSettings {
    readonly isTypeDirectiveAllowed: boolean;
}
