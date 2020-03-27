import { Ast, TXorNode } from "../../parser";

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TScopeItem =
    | EachScopeItem
    | KeyValuePairScopeItem
    | ParameterScopeItem
    | SectionMemberScopeItem
    | UndefinedScopeItem;

export const enum ScopeItemKind {
    KeyValuePair = "KeyValuePair",
    Undefined = "Undefined",
    Each = "Each",
    Parameter = "Parameter",
    SectionMember = "SectionMember",
}

export interface IScopeItem {
    readonly kind: ScopeItemKind;
}

export interface KeyValuePairScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.KeyValuePair;
    readonly key: Ast.Identifier | Ast.GeneralizedIdentifier;
    readonly maybeValue: TXorNode | undefined;
}

export interface SectionMemberScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.SectionMember;
    readonly key: Ast.Identifier;
    readonly maybeValue: TXorNode | undefined;
}

export interface UndefinedScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Undefined;
    readonly xorNode: TXorNode;
}

export interface EachScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Each;
    readonly each: TXorNode;
}

export interface ParameterScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Parameter;
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: Ast.PrimitiveTypeConstantKind | undefined;
}
