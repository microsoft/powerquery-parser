// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    EachScopeItem,
    LetVariableScopeItem,
    ParameterScopeItem,
    RecordFieldScopeItem,
    ScopeItemKind,
    SectionMemberScopeItem,
    TScopeItem,
    UndefinedScopeItem,
} from "./scope";

export * from "./scope";
export * from "./scopeInspection";

export function isEach(maybeValue: TScopeItem | undefined): maybeValue is EachScopeItem {
    return maybeValue?.kind === ScopeItemKind.Each;
}

export function isLetVariable(maybeValue: TScopeItem | undefined): maybeValue is LetVariableScopeItem {
    return maybeValue?.kind === ScopeItemKind.LetVariable;
}

export function isParameter(maybeValue: TScopeItem | undefined): maybeValue is ParameterScopeItem {
    return maybeValue?.kind === ScopeItemKind.Parameter;
}

export function isRecordField(maybeValue: TScopeItem | undefined): maybeValue is RecordFieldScopeItem {
    return maybeValue?.kind === ScopeItemKind.RecordField;
}

export function isSectionMember(maybeValue: TScopeItem | undefined): maybeValue is SectionMemberScopeItem {
    return maybeValue?.kind === ScopeItemKind.SectionMember;
}

export function isUndefined(maybeValue: TScopeItem | undefined): maybeValue is UndefinedScopeItem {
    return maybeValue?.kind === ScopeItemKind.Undefined;
}
