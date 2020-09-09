// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils } from "../../../common";
import { Ast, Constant, Keyword, Token } from "../../../language";
import { NodeIdMap, TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils } from "../../activeNode";
import { PositionUtils } from "../../position";
import { autocompleteKeywordDefault } from "./autocompleteKeywordDefault";
import { autocompleteKeywordErrorHandlingExpression } from "./autocompleteKeywordErrorHandlingExpression";
import { autocompleteKeywordIdentifierPairedExpression } from "./autocompleteKeywordIdentifierPairedExpression";
import { autocompleteKeywordLetExpression } from "./autocompleteKeywordLetExpression";
import { autocompleteKeywordListExpression } from "./autocompleteKeywordListExpression";
import { autocompleteKeywordSectionMember } from "./autocompleteKeywordSectionMember";
import { autocompleteKeywordTrailingText } from "./autocompleteKeywordTrailingText";
import { InspectAutocompleteKeywordState, TrailingText } from "./commonTypes";

export function autocompleteKeyword(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    activeNode: ActiveNode,
    maybeParseErrorToken: Token.Token | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    const maybeTrailingText: TrailingText | undefined =
        maybeParseErrorToken !== undefined ? trailingTextFactory(activeNode, maybeParseErrorToken) : undefined;

    const ancestryLeaf: TXorNode = ActiveNodeUtils.assertGetLeaf(activeNode);
    let maybePositionName: string | undefined;
    if (PositionUtils.isInXor(nodeIdMapCollection, activeNode.position, ancestryLeaf, false, true)) {
        if (activeNode.maybeIdentifierUnderPosition !== undefined) {
            maybePositionName = activeNode.maybeIdentifierUnderPosition.literal;
        }
        // Matches 'null', 'true', and 'false'.
        else if (
            ancestryLeaf.kind === XorNodeKind.Ast &&
            ancestryLeaf.node.kind === Ast.NodeKind.LiteralExpression &&
            (ancestryLeaf.node.literalKind === Constant.LiteralKind.Logical ||
                ancestryLeaf.node.literalKind === Constant.LiteralKind.Null)
        ) {
            maybePositionName = ancestryLeaf.node.literal;
        }
    }

    if (activeNode.ancestry.length < 2) {
        return filterRecommendations(handleConjunctions(activeNode, [], maybeTrailingText), maybePositionName);
    }

    const state: InspectAutocompleteKeywordState = {
        nodeIdMapCollection,
        leafNodeIds,
        activeNode,
        maybeParseErrorToken,
        maybeTrailingText,
        parent: activeNode.ancestry[1],
        child: ActiveNodeUtils.assertGetLeaf(activeNode),
        ancestryIndex: 0,
    };

    const maybeEarlyExitInspected: ReadonlyArray<Keyword.KeywordKind> | undefined = maybeEdgeCase(state);
    if (maybeEarlyExitInspected !== undefined) {
        return maybeEarlyExitInspected;
    }

    return filterRecommendations(
        handleConjunctions(state.activeNode, traverseAncestors(state), maybeTrailingText),
        maybePositionName,
    );
}

const ConjunctionKeywords: ReadonlyArray<Keyword.KeywordKind> = [
    Keyword.KeywordKind.And,
    Keyword.KeywordKind.As,
    Keyword.KeywordKind.Is,
    Keyword.KeywordKind.Meta,
    Keyword.KeywordKind.Or,
];

function trailingTextFactory(activeNode: ActiveNode, parseErrorToken: Token.Token): TrailingText {
    return {
        text: parseErrorToken.data,
        positionStart: parseErrorToken.positionStart,
        isInOrOnPosition: PositionUtils.isInToken(activeNode.position, parseErrorToken, false, true),
    };
}

// Travel the ancestry path in Active node in [parent, child] pairs.
// Without zipping the values we wouldn't know what we're completing for.
// For example 'if true |' gives us a pair something like [IfExpression, Constant].
// We can now know we failed to parse a 'then' constant.
function traverseAncestors(state: InspectAutocompleteKeywordState): ReadonlyArray<Keyword.KeywordKind> {
    const ancestry: ReadonlyArray<TXorNode> = state.activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let maybeInspected: ReadonlyArray<Keyword.KeywordKind> | undefined;
    for (let ancestryIndex: number = 1; ancestryIndex < numNodes; ancestryIndex += 1) {
        state.ancestryIndex = ancestryIndex;
        state.parent = ancestry[ancestryIndex];
        state.child = ancestry[ancestryIndex - 1];

        switch (state.parent.node.kind) {
            case Ast.NodeKind.ErrorHandlingExpression:
                maybeInspected = autocompleteKeywordErrorHandlingExpression(state);
                break;

            case Ast.NodeKind.IdentifierPairedExpression:
                maybeInspected = autocompleteKeywordIdentifierPairedExpression(state);
                break;

            case Ast.NodeKind.LetExpression:
                maybeInspected = autocompleteKeywordLetExpression(state);
                break;

            case Ast.NodeKind.ListExpression:
                maybeInspected = autocompleteKeywordListExpression(state);
                break;

            case Ast.NodeKind.SectionMember:
                maybeInspected = autocompleteKeywordSectionMember(state);
                break;

            default:
                maybeInspected = autocompleteKeywordDefault(state);
        }

        if (maybeInspected !== undefined) {
            return maybeInspected;
        }
    }

    return [];
}

function maybeEdgeCase(state: InspectAutocompleteKeywordState): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const maybeParseErrorToken: Token.Token | undefined = state.maybeParseErrorToken;
    let maybeInspected: ReadonlyArray<Keyword.KeywordKind> | undefined;

    // The user is typing in a new file, which the parser defaults to searching for an identifier.
    // `l|` -> `let`
    if (
        maybeParseErrorToken === undefined &&
        ancestry.length === 2 &&
        ancestry[0].kind === XorNodeKind.Ast &&
        ancestry[0].node.kind === Ast.NodeKind.Identifier &&
        ancestry[1].node.kind === Ast.NodeKind.IdentifierExpression
    ) {
        const identifier: string = ancestry[0].node.literal;
        maybeInspected = Keyword.StartOfDocumentKeywords.filter((keywordKind: Keyword.KeywordKind) =>
            keywordKind.startsWith(identifier),
        );
    }

    // `(_ |) => _` -> `(_ as) => _`
    else if (
        ancestry[0].kind === XorNodeKind.Ast &&
        ancestry[0].node.kind === Ast.NodeKind.Identifier &&
        ancestry[1].node.kind === Ast.NodeKind.Parameter &&
        PositionUtils.isAfterAst(activeNode.position, ancestry[0].node, false)
    ) {
        maybeInspected = [Keyword.KeywordKind.As];
    }

    // `(foo a|) => foo` -> `(foo as) => foo
    else if (
        maybeParseErrorToken?.data === "a" &&
        ancestry[0].kind === XorNodeKind.Context &&
        ancestry[0].node.kind === Ast.NodeKind.Constant &&
        ancestry[1].node.kind === Ast.NodeKind.ParameterList &&
        ancestry[2].node.kind === Ast.NodeKind.FunctionExpression
    ) {
        maybeInspected = [Keyword.KeywordKind.As];
    }

    return maybeInspected;
}

function filterRecommendations(
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    maybePositionName: string | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    if (maybePositionName === undefined) {
        return inspected;
    }

    const positionName: string = maybePositionName;
    return inspected.filter((kind: Keyword.KeywordKind) => kind.startsWith(positionName));
}

function handleConjunctions(
    activeNode: ActiveNode,
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    maybeTrailingText: TrailingText | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    if (
        activeNode.leafKind !== ActiveNodeLeafKind.AfterAstNode &&
        activeNode.leafKind !== ActiveNodeLeafKind.ContextNode
    ) {
        return inspected;
    }

    const activeNodeLeaf: TXorNode = ActiveNodeUtils.assertGetLeaf(activeNode);
    // `let x = 1 a|`
    if (maybeTrailingText !== undefined && maybeTrailingText.isInOrOnPosition) {
        return autocompleteKeywordTrailingText(inspected, maybeTrailingText, undefined);
    }
    // `let x = |`
    // `let x = 1|`
    // `let x = 1 | a`
    else if (XorNodeUtils.isTUnaryType(activeNodeLeaf)) {
        // `let x = 1 | a`
        if (
            maybeTrailingText !== undefined &&
            PositionUtils.isAfterTokenPosition(activeNode.position, maybeTrailingText.positionStart, false)
        ) {
            return inspected;
        }
        // `let x = 1|`
        else if (activeNodeLeaf.kind === XorNodeKind.Ast) {
            return ArrayUtils.concatUnique(inspected, ConjunctionKeywords);
        }
        // `let x = |`
        else {
            return inspected;
        }
    } else {
        return inspected;
    }
}
