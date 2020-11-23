// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../common";
import { Constant, Keyword, Token, Type } from "../../language";
import { TXorNode } from "../../parser";

export type TriedAutocompleteFieldAccess = Result<AutocompleteFieldAccess | undefined, CommonError.CommonError>;

export type TriedAutocompleteKeyword = Result<AutocompleteKeyword, CommonError.CommonError>;

export type TriedAutocompleteLanguageConstant = Result<
    AutocompleteLanguageConstant | undefined,
    CommonError.CommonError
>;

export type TriedAutocompletePrimitiveType = Result<AutocompletePrimitiveType, CommonError.CommonError>;

export type AutocompleteKeyword = ReadonlyArray<Keyword.KeywordKind>;

export type AutocompleteLanguageConstant = Constant.LanguageConstantKind;

export type AutocompletePrimitiveType = ReadonlyArray<Constant.PrimitiveTypeConstantKind>;

export interface Autocomplete {
    readonly triedFieldAccess: TriedAutocompleteFieldAccess;
    readonly triedKeyword: TriedAutocompleteKeyword;
    readonly triedLanguageConstant: TriedAutocompleteLanguageConstant;
    readonly triedPrimitiveType: TriedAutocompletePrimitiveType;
}

export interface AutocompleteItem {
    readonly key: string;
    readonly type: Type.TType;
}

export interface AutocompleteFieldAccess {
    readonly field: TXorNode;
    readonly fieldType: Type.TType;
    readonly inspectedFieldAccess: InspectedFieldAccess;
    readonly autocompleteItems: ReadonlyArray<AutocompleteItem>;
}

export interface InspectedFieldAccess {
    readonly isAutocompleteAllowed: boolean;
    readonly maybeIdentifierUnderPosition: string | undefined;
    readonly fieldNames: ReadonlyArray<string>;
}

export interface TrailingToken extends Token.Token {
    readonly isInOrOnPosition: boolean;
}
