// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from "../../../common";
import { Keyword, Token } from "../../../language";
import { TrailingToken } from "../commonTypes";

export function autocompleteKeywordTrailingText(
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    trailingToken: TrailingToken,
    maybeAllowedKeywords: ReadonlyArray<Keyword.KeywordKind> | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    if (trailingToken.isInOrOnPosition === false) {
        return inspected;
    }
    Assert.isTrue(trailingToken.data.length > 0, "trailingToken.data.length > 0");
    const token: Token.Token = trailingToken;

    maybeAllowedKeywords = maybeAllowedKeywords ?? PartialConjunctionKeywordAutocompleteMap.get(token.data[0]);

    if (maybeAllowedKeywords !== undefined) {
        return ArrayUtils.concatUnique(
            inspected,
            maybeAllowedKeywords.filter((keyword: Keyword.KeywordKind) => keyword.startsWith(token.data)),
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
