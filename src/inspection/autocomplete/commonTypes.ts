// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../common";
import { Constant, Keyword } from "../../language";

export type Autocomplete = ReadonlyArray<AutocompleteOption>;

export type AutocompleteOption = Constant.PrimitiveTypeConstantKind | Keyword.KeywordKind;

export type TriedAutocomplete = Result<Autocomplete, CommonError.CommonError>;
