// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Keyword } from "../../../language";
import { AncestryUtils, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../../parser";
import { autocompleteKeywordRightMostLeaf } from "./common";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordSectionMember(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const maybeChildAttributeIndex: number | undefined = state.child.node.maybeAttributeIndex;

    // SectionMember.namePairedExpression
    if (maybeChildAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const maybeSharedConstant:
            | TXorNode
            | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
            state.nodeIdMapCollection,
            state.parent.node.id,
            1,
            [Ast.NodeKind.Constant],
        );

        // 'shared' was parsed so we can exit.
        if (maybeSharedConstant !== undefined) {
            return undefined;
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const maybeName: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
            state.activeNode.ancestry,
            state.ancestryIndex,
            2,
            [Ast.NodeKind.IdentifierPairedExpression, Ast.NodeKind.Identifier],
        );

        // Name hasn't been parsed yet so we can exit.
        if (maybeName?.kind !== XorNodeKind.Ast) {
            return undefined;
        }

        const name: Ast.Identifier = maybeName.node as Ast.Identifier;
        if (Keyword.KeywordKind.Shared.startsWith(name.literal)) {
            return [Keyword.KeywordKind.Shared];
        }

        return undefined;
    }
    // `section foo; bar = 1 |` would be expecting a semicolon.
    // The autocomplete should be for the IdentifierPairedExpression found on the previous child index.
    else if (maybeChildAttributeIndex === 3 && state.child.kind === XorNodeKind.Context) {
        const identifierPairedExpression: Ast.TNode = NodeIdMapUtils.assertGetChildAstByAttributeIndex(
            state.nodeIdMapCollection,
            state.parent.node.id,
            2,
            [Ast.NodeKind.IdentifierPairedExpression],
        );
        return autocompleteKeywordRightMostLeaf(state, identifierPairedExpression.id);
    } else {
        return undefined;
    }
}
