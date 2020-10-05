// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../common";
import { Constant, Keyword, Token, Type } from "../../language";
import { BracketDisambiguation, IParserState, TXorNode } from "../../parser";

export type TriedAutocomplete = Result<Autocomplete, CommonError.CommonError>;

export type TriedAutocompleteFieldAccess = Result<AutocompleteFieldAccess | undefined, CommonError.CommonError>;

export type TriedAutocompleteKeyword = Result<AutocompleteKeyword, CommonError.CommonError>;

export type TriedAutocompletePrimitiveType = Result<AutocompletePrimitiveType, CommonError.CommonError>;

export type AutocompleteKeyword = ReadonlyArray<Keyword.KeywordKind>;

export type AutocompletePrimitiveType = ReadonlyArray<Constant.PrimitiveTypeConstantKind>;

export type FieldAccessKind = BracketDisambiguation.FieldProjection | BracketDisambiguation.FieldSelection;

export interface Autocomplete {
    readonly triedFieldAccess: TriedAutocompleteFieldAccess;
    readonly triedKeyword: TriedAutocompleteKeyword;
    readonly triedPrimitiveType: TriedAutocompletePrimitiveType;
}

export interface IAutocompleteItem {
    readonly key: string;
    readonly type: Type.TType;
}

export interface AutocompleteFieldAccess {
    readonly field: TXorNode;
    readonly fieldType: Type.TType;
    readonly access: FieldAccess;
    readonly autocompleteItems: ReadonlyArray<IAutocompleteItem>;
}

export interface TrailingToken extends Token.Token {
    readonly isInOrOnPosition: boolean;
}

export interface FieldAccess {
    readonly kind: FieldAccessKind;
    readonly parserState: IParserState;
}
