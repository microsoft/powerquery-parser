// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option } from "../common";
import { NodeIdMap } from "../parser";
import { KeywordState } from "./state";

export const enum KeywordKind {
    Required = "Required",
    Allowed = "Allowed",
}

export interface InspectedKeyword {
    readonly maybeKeywords: Option<ReadonlyArray<Keyword>>;
}

export interface Keyword {
    readonly kind: KeywordKind;
    readonly literal: string;
}

export function visitNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): void {}
