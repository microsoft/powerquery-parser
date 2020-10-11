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
    readonly fieldAccessParse: TParseFieldAccess;
    readonly autocompleteItems: ReadonlyArray<AutocompleteItem>;
}

export interface TrailingToken extends Token.Token {
    readonly isInOrOnPosition: boolean;
}

export type TParseFieldAccess =
    | ParseFieldProjectionErr
    | ParseFieldProjectionOk
    | ParseFieldSelectionErr
    | ParseFieldSelectionOk;

export interface IParseFieldAccess {
    readonly hasError: boolean;
    readonly nodeKind: Ast.NodeKind;
}

export interface IParseFieldAccessOk<
    T extends Ast.FieldProjection | Ast.FieldSelector,
    K extends Ast.NodeKind.FieldProjection | Ast.NodeKind.FieldSelector
> extends IParseFieldAccess {
    readonly hasError: false;
    readonly nodeKind: K;
    readonly ast: T;
    readonly parserState: IParserState;
}

export interface IParseFieldAccessErr<
    K extends Ast.NodeKind.FieldProjection | Ast.NodeKind.FieldSelector,
    S extends IParserState = IParserState
> extends IParseFieldAccess {
    readonly hasError: true;
    readonly nodeKind: K;
    readonly parseError: ParseError.ParseError<S>;
}

export type ParseFieldProjectionOk = IParseFieldAccessOk<Ast.FieldProjection, Ast.NodeKind.FieldProjection>;
export type ParseFieldProjectionErr<S extends IParserState = IParserState> = IParseFieldAccessErr<
    Ast.NodeKind.FieldProjection,
    S
>;

export type ParseFieldSelectionOk = IParseFieldAccessOk<Ast.FieldSelector, Ast.NodeKind.FieldSelector>;
export type ParseFieldSelectionErr<S extends IParserState = IParserState> = IParseFieldAccessErr<
    Ast.NodeKind.FieldSelector,
    S
>;
