// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Keyword } from "../../../language";
import { AncestryUtils, TXorNode, XorNodeKind } from "../../../parser";
import { ActiveNode } from "../../activeNode";
import { PositionUtils } from "../../position";
import { ExpressionAutocomplete, InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordListExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestryIndex: number = state.ancestryIndex;
    const child: TXorNode = state.child;

    // '{' or '}'
    if (child.node.maybeAttributeIndex === 0 || child.node.maybeAttributeIndex === 2) {
        return undefined;
    }
    Assert.isTrue(child.node.maybeAttributeIndex === 1, `must be in range [0, 2]`, {
        nodeId: child.node.id,
        maybeAttributeIndex: child.node.maybeAttributeIndex,
    });

    // ListExpression -> ArrayWrapper -> Csv -> X
    const nodeOrComma: TXorNode = AncestryUtils.assertGetNthPreviousXor(
        activeNode.ancestry,
        ancestryIndex,
        3,
        undefined,
    );
    if (nodeOrComma.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // We know it's the node component of the Csv,
    // but we have to drill down one more level if it's a RangeExpression.
    const itemNode: TXorNode =
        nodeOrComma.node.kind === Ast.NodeKind.RangeExpression
            ? AncestryUtils.assertGetNthPreviousXor(activeNode.ancestry, ancestryIndex, 4, undefined)
            : nodeOrComma;

    if (itemNode.kind === XorNodeKind.Context || PositionUtils.isBeforeXor(activeNode.position, itemNode, false)) {
        return ExpressionAutocomplete;
    } else {
        return undefined;
    }
}
