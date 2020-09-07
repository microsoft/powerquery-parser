// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword, Token } from "../../../language";
import { TokenPosition } from "../../../language/token";
import { NodeIdMap, TXorNode } from "../../../parser";
import { ActiveNode } from "../../activeNode";

export interface InspectAutocompleteKeywordState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    readonly activeNode: ActiveNode;
    readonly maybeParseErrorToken: Token.Token | undefined;
    readonly maybeTrailingText: TrailingText | undefined;
    parent: TXorNode;
    child: TXorNode;
    ancestryIndex: number;
}

export interface TrailingText {
    readonly text: string;
    readonly positionStart: TokenPosition;
    readonly isInOrOnPosition: boolean;
}

export const ExpressionAutocomplete: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
