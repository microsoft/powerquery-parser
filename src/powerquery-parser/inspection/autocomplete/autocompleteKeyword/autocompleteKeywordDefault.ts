// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Keyword } from "../../../language";
import { TXorNode, XorNodeKind } from "../../../parser";
import { ActiveNode, ActiveNodeLeafKind } from "../../activeNode";
import { PositionUtils } from "../../position";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordDefault(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const child: TXorNode = state.child;
    const key: string = createMapKey(state.parent.node.kind, child.node.maybeAttributeIndex);

    if (AutocompleteExpressionKeys.indexOf(key) !== -1) {
        return autocompleteDefaultExpression(state);
    } else {
        const maybeMappedKeywordKind: Keyword.KeywordKind | undefined = AutocompleteConstantMap.get(key);
        return maybeMappedKeywordKind !== undefined
            ? autocompleteKeywordConstant(activeNode, child, maybeMappedKeywordKind)
            : undefined;
    }
}

const AutocompleteExpressionKeys: ReadonlyArray<string> = [
    createMapKey(Ast.NodeKind.ErrorRaisingExpression, 1),
    createMapKey(Ast.NodeKind.GeneralizedIdentifierPairedExpression, 2),
    createMapKey(Ast.NodeKind.FunctionExpression, 3),
    createMapKey(Ast.NodeKind.IdentifierPairedExpression, 2),
    createMapKey(Ast.NodeKind.IfExpression, 1),
    createMapKey(Ast.NodeKind.IfExpression, 3),
    createMapKey(Ast.NodeKind.IfExpression, 5),
    createMapKey(Ast.NodeKind.InvokeExpression, 1),
    createMapKey(Ast.NodeKind.LetExpression, 3),
    createMapKey(Ast.NodeKind.ListExpression, 1),
    createMapKey(Ast.NodeKind.OtherwiseExpression, 1),
    createMapKey(Ast.NodeKind.ParenthesizedExpression, 1),
];

// If we're coming from a constant then we can quickly evaluate using a map.
// This is possible because reading a Constant is binary.
// Either the Constant was read and you're in the next context, or you didn't and you're in the constant's context.
const AutocompleteConstantMap: Map<string, Keyword.KeywordKind> = new Map<string, Keyword.KeywordKind>([
    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), Keyword.KeywordKind.Error],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), Keyword.KeywordKind.If],
    [createMapKey(Ast.NodeKind.IfExpression, 2), Keyword.KeywordKind.Then],
    [createMapKey(Ast.NodeKind.IfExpression, 4), Keyword.KeywordKind.Else],

    // Ast.NodeKind.LetExpression
    [createMapKey(Ast.NodeKind.LetExpression, 2), Keyword.KeywordKind.In],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 0), Keyword.KeywordKind.Otherwise],

    // Ast.NodeKind.Section
    [createMapKey(Ast.NodeKind.Section, 1), Keyword.KeywordKind.Section],
]);

function autocompleteDefaultExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const child: TXorNode = state.child;

    // '[x=|1]
    if (activeNode.leafKind === ActiveNodeLeafKind.ShiftedRight) {
        return Keyword.ExpressionKeywordKinds;
    }
    // `if 1|`
    else if (
        child.kind === XorNodeKind.Ast &&
        child.node.kind === Ast.NodeKind.LiteralExpression &&
        child.node.literalKind === Ast.LiteralKind.Numeric
    ) {
        return [];
    }

    return Keyword.ExpressionKeywordKinds;
}

function autocompleteKeywordConstant(
    activeNode: ActiveNode,
    child: TXorNode,
    keywordKind: Keyword.KeywordKind,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    if (PositionUtils.isBeforeXor(activeNode.position, child, false)) {
        return undefined;
    } else if (child.kind === XorNodeKind.Ast) {
        // So long as you're inside of an Ast Constant there's nothing that can be recommended other than the constant.
        // Note that we previously checked isBeforeXorNode so we can use the quicker isOnAstNodeEnd to check
        // if we're inside of the Ast node.
        return PositionUtils.isOnAstEnd(activeNode.position, child.node) ? [] : [keywordKind];
    }

    return [keywordKind];
}

// A tuple can't easily be used as a Map key as it does a shallow comparison.
// The work around is to stringify the tuple key, even though we lose typing by doing so.
// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: number | undefined): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}
