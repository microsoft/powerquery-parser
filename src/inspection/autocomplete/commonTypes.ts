// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../common";
import { Token } from "../../language";

export type Autocomplete = ReadonlyArray<AutocompleteOption>;

// Originally `Constant.PrimitiveTypeConstantKind | Keyword.KeywordKind`
// Made into string to support table/record fields.
export type AutocompleteOption = string;

export type TriedAutocomplete = Result<Autocomplete, CommonError.CommonError>;

export interface TrailingToken extends Token.Token {
    readonly isInOrOnPosition: boolean;
}
