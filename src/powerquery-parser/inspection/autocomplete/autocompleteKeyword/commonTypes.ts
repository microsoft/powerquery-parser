// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword } from "../../../language";
import { NodeIdMap, TXorNode } from "../../../parser";
import { ActiveNode } from "../../activeNode";
import { TrailingToken } from "../commonTypes";

export interface InspectAutocompleteKeywordState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    readonly activeNode: ActiveNode;
    readonly maybeTrailingToken: TrailingToken | undefined;
    parent: TXorNode;
    child: TXorNode;
    ancestryIndex: number;
}

export const ExpressionAutocomplete: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
