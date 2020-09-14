// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword } from "..";

export function isKeyword(text: string): text is Keyword.KeywordKind {
    return Keyword.KeywordKinds.includes(text as Keyword.KeywordKind);
}
