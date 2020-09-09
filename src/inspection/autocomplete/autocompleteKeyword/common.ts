// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Keyword } from "../../../language";
import { AncestryUtils, NodeIdMapUtils, TXorNode } from "../../../parser";
import { ActiveNode } from "../../activeNode";
import { autocompleteKeyword } from "./autocompleteKeyword";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordRightMostLeaf(
    state: InspectAutocompleteKeywordState,
    xorNodeId: number,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    // Grab the right-most Ast node in the last value.
    const maybeRightMostAstLeafForLastValue: Ast.TNode | undefined = NodeIdMapUtils.maybeRightMostLeaf(
        state.nodeIdMapCollection,
        xorNodeId,
        undefined,
    );
    if (maybeRightMostAstLeafForLastValue === undefined) {
        return undefined;
    }

    // Start a new autocomplete inspection where the ActiveNode's ancestry is the right-most Ast node in the last value.
    const shiftedAncestry: ReadonlyArray<TXorNode> = AncestryUtils.assertGetAncestry(
        state.nodeIdMapCollection,
        maybeRightMostAstLeafForLastValue.id,
    );
    Assert.isTrue(shiftedAncestry.length >= 2, "shiftedAncestry.length >= 2");
    const shiftedActiveNode: ActiveNode = {
        ...state.activeNode,
        ancestry: shiftedAncestry,
    };
    const inspected: ReadonlyArray<Keyword.KeywordKind> = autocompleteKeyword(
        state.nodeIdMapCollection,
        state.leafNodeIds,
        shiftedActiveNode,
        state.maybeTrailingToken,
    );

    return inspected;
}
