// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../../common";
import { Ast, Constant, Keyword, Token, Type } from "../../language";
import { IParserState, ParseError, TXorNode } from "../../parser";

export type TriedAutocomplete = Result<Autocomplete, CommonError.CommonError>;

export type TriedAutocompleteFieldAccess = Result<AutocompleteFieldAccess | undefined, CommonError.CommonError>;

export type TriedAutocompleteKeyword = Result<AutocompleteKeyword, CommonError.CommonError>;

export type TriedAutocompletePrimitiveType = Result<AutocompletePrimitiveType, CommonError.CommonError>;

export type AutocompleteKeyword = ReadonlyArray<Keyword.KeywordKind>;

export type AutocompletePrimitiveType = ReadonlyArray<Constant.PrimitiveTypeConstantKind>;

export const enum FieldAccessKind {
    Ok,
    Err,
    SelectionOk,
    SelectionErr,
}

export interface Autocomplete {
    readonly triedFieldAccess: TriedAutocompleteFieldAccess;
    readonly triedKeyword: TriedAutocompleteKeyword;
    readonly triedPrimitiveType: TriedAutocompletePrimitiveType;
}

export interface AutocompleteItem {
    readonly key: string;
    readonly type: Type.TType;
}

export interface AutocompleteFieldAccess {
    readonly field: TXorNode;
    readonly fieldType: Type.TType;
    readonly parsedFieldAccess: TParsedFieldAccess;
    readonly autocompleteItems: ReadonlyArray<AutocompleteItem>;
}

export interface TrailingToken extends Token.Token {
    readonly isInOrOnPosition: boolean;
}

export type TParsedFieldAccess =
    | ParsedFieldProjectionErr
    | ParsedFieldProjectionOk
    | ParsedFieldSelectionErr
    | ParsedFieldSelectionOk;

export interface IParsedFieldAccess {
    readonly hasError: boolean;
    readonly nodeKind: Ast.NodeKind;
}

export interface IParsedFieldAccessOk<
    T extends Ast.FieldProjection | Ast.FieldSelector,
    K extends Ast.NodeKind.FieldProjection | Ast.NodeKind.FieldSelector
> extends IParsedFieldAccess {
    readonly hasError: false;
    readonly nodeKind: K;
    readonly ast: T;
    readonly parserState: IParserState;
}

export interface IParsedFieldAccessErr<
    K extends Ast.NodeKind.FieldProjection | Ast.NodeKind.FieldSelector,
    S extends IParserState = IParserState
> extends IParsedFieldAccess {
    readonly hasError: true;
    readonly nodeKind: K;
    readonly parseError: ParseError.ParseError<S>;
}

export type ParsedFieldProjectionOk = IParsedFieldAccessOk<Ast.FieldProjection, Ast.NodeKind.FieldProjection>;
export type ParsedFieldProjectionErr<S extends IParserState = IParserState> = IParsedFieldAccessErr<
    Ast.NodeKind.FieldProjection,
    S
>;

export type ParsedFieldSelectionOk = IParsedFieldAccessOk<Ast.FieldSelector, Ast.NodeKind.FieldSelector>;
export type ParsedFieldSelectionErr<S extends IParserState = IParserState> = IParsedFieldAccessErr<
    Ast.NodeKind.FieldSelector,
    S
>;
