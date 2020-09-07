// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../common";
import { Keyword } from "../../language";

export type Autocomplete = ReadonlyArray<AutocompleteOption>;

export type AutocompleteOption = Keyword.KeywordKind;

export type TriedAutocomplete = Result<Autocomplete, CommonError.CommonError>;
