// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { KeywordKind, KeywordKinds } from "./keyword";

export function isKeyword(text: string): text is KeywordKind {
    return KeywordKinds.includes(text as KeywordKind);
}
