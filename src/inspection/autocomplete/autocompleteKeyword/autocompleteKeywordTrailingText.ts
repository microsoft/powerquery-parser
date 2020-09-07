// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from "../../../common";
import { Keyword } from "../../../language";
import { TrailingText } from "./commonTypes";

export function autocompleteKeywordTrailingText(
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    trailingText: TrailingText,
    maybeAllowedKeywords: ReadonlyArray<Keyword.KeywordKind> | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    if (trailingText.isInOrOnPosition === false) {
        return inspected;
    }
    Assert.isTrue(trailingText.text.length > 0, "trailingText.length > 0");

    maybeAllowedKeywords = maybeAllowedKeywords ?? PartialConjunctionKeywordAutocompleteMap.get(trailingText.text[0]);

    if (maybeAllowedKeywords !== undefined) {
        return ArrayUtils.concatUnique(
            inspected,
            maybeAllowedKeywords.filter((keyword: Keyword.KeywordKind) => keyword.startsWith(trailingText.text)),
        );
    } else {
        return inspected;
    }
}

// Used with maybeParseError to see if a user could be typing a conjunctive keyword such as 'or'. Eg.
// 'Details[UserName] <> "" o|'
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<Keyword.KeywordKind>> = new Map<
    string,
    ReadonlyArray<Keyword.KeywordKind>
>([
    ["a", [Keyword.KeywordKind.And, Keyword.KeywordKind.As]],
    ["i", [Keyword.KeywordKind.Is]],
    ["m", [Keyword.KeywordKind.Meta]],
    ["o", [Keyword.KeywordKind.Or]],
]);
