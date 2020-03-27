// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, TXorNode } from "../../parser";

export type TScopeItem2 =
    | EachScopeItem2
    | KeyValuePairScopeItem2
    | ParameterScopeItem2
    | SectionMemberScopeItem2
    | UndefinedScopeItem2;

export const enum ScopeItemKind2 {
    KeyValuePair = "KeyValuePair",
    Undefined = "Undefined",
    Each = "Each",
    Parameter = "Parameter",
    SectionMember = "SectionMember",
}

export interface IScopeItem2 {
    readonly kind: ScopeItemKind2;
}

export interface KeyValuePairScopeItem2 extends IScopeItem2 {
    readonly kind: ScopeItemKind2.KeyValuePair;
    readonly key: Ast.Identifier | Ast.GeneralizedIdentifier;
    readonly maybeValue: TXorNode | undefined;
}

export interface SectionMemberScopeItem2 extends IScopeItem2 {
    readonly kind: ScopeItemKind2.SectionMember;
    readonly key: Ast.Identifier;
    readonly maybeValue: TXorNode | undefined;
}

export interface UndefinedScopeItem2 extends IScopeItem2 {
    readonly kind: ScopeItemKind2.Undefined;
    readonly xorNode: TXorNode;
}

export interface EachScopeItem2 extends IScopeItem2 {
    readonly kind: ScopeItemKind2.Each;
    readonly each: TXorNode;
}

export interface ParameterScopeItem2 extends IScopeItem2 {
    readonly kind: ScopeItemKind2.Parameter;
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: Ast.PrimitiveTypeConstantKind | undefined;
}
