// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Language } from "..";
import { ArrayUtils, Assert, CommonError, Result } from "../common";
import { ResultUtils } from "../common/result";
import { Ast, ExpressionKeywords } from "../language";
import { getLocalizationTemplates } from "../localization";
import {
    AncestryUtils,
    IParserState,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    ParseError,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "../parser";
import { CommonSettings } from "../settings";
import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils } from "./activeNode";
import { Position, PositionUtils } from "./position";

export type Autocomplete = ReadonlyArray<Language.KeywordKind>;

export type TriedAutocomplete = Result<Autocomplete, CommonError.CommonError>;

export const StartOfDocumentKeywords: ReadonlyArray<Language.KeywordKind> = [
    ...ExpressionKeywords,
    Language.KeywordKind.Section,
];

export function tryAutocomplete<S extends IParserState = IParserState>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeActiveNode: ActiveNode | undefined,
    maybeParseError: ParseError.ParseError<S> | undefined,
): TriedAutocomplete {
    if (maybeActiveNode === undefined || maybeActiveNode.ancestry.length === 0) {
        return ResultUtils.okFactory([...ExpressionAutocomplete, Language.KeywordKind.Section]);
    }

    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () =>
        inspectAutocomplete(
            nodeIdMapCollection,
            leafNodeIds,
            maybeActiveNode,
            maybeParseError !== undefined ? ParseError.maybeTokenFrom(maybeParseError.innerError) : undefined,
        ),
    );
}

interface InspectAutocompleteState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    readonly activeNode: ActiveNode;
    readonly maybeParseErrorToken: Language.Token | undefined;
    readonly maybeTrailingText: TrailingText | undefined;
    parent: TXorNode;
    child: TXorNode;
    ancestryIndex: number;
}

interface TrailingText {
    readonly text: string;
    readonly isInOrOnPosition: boolean;
}

const ExpressionAutocomplete: ReadonlyArray<Language.KeywordKind> = ExpressionKeywords;

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
const AutocompleteConstantMap: Map<string, Language.KeywordKind> = new Map<string, Language.KeywordKind>([
    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), Language.KeywordKind.Error],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), Language.KeywordKind.If],
    [createMapKey(Ast.NodeKind.IfExpression, 2), Language.KeywordKind.Then],
    [createMapKey(Ast.NodeKind.IfExpression, 4), Language.KeywordKind.Else],

    // Ast.NodeKind.LetExpression
    [createMapKey(Ast.NodeKind.LetExpression, 2), Language.KeywordKind.In],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 0), Language.KeywordKind.Otherwise],

    // Ast.NodeKind.Section
    [createMapKey(Ast.NodeKind.Section, 1), Language.KeywordKind.Section],
]);

// Used with maybeParseError to see if a user could be typing a conjunctive keyword such as 'or'. Eg.
// 'Details[UserName] <> "" o|'
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<Language.KeywordKind>> = new Map<
    string,
    ReadonlyArray<Language.KeywordKind>
>([
    ["a", [Language.KeywordKind.And, Language.KeywordKind.As]],
    ["i", [Language.KeywordKind.Is]],
    ["m", [Language.KeywordKind.Meta]],
    ["o", [Language.KeywordKind.Or]],
]);

const ConjunctionKeywords: ReadonlyArray<Language.KeywordKind> = [
    Language.KeywordKind.And,
    Language.KeywordKind.As,
    Language.KeywordKind.Is,
    Language.KeywordKind.Meta,
    Language.KeywordKind.Or,
];

function inspectAutocomplete(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    activeNode: ActiveNode,
    maybeParseErrorToken: Language.Token | undefined,
): ReadonlyArray<Language.KeywordKind> {
    const maybeTrailingText: TrailingText | undefined =
        maybeParseErrorToken !== undefined ? trailingTextFactory(activeNode, maybeParseErrorToken) : undefined;

    const ancestryLeaf: TXorNode = ActiveNodeUtils.expectLeaf(activeNode);
    let maybePositionName: string | undefined;
    if (PositionUtils.isInXorNode(nodeIdMapCollection, activeNode.position, ancestryLeaf, false, true)) {
        if (activeNode.maybeIdentifierUnderPosition !== undefined) {
            maybePositionName = activeNode.maybeIdentifierUnderPosition.literal;
        }
        // Matches 'null', 'true', and 'false'.
        else if (
            ancestryLeaf.kind === XorNodeKind.Ast &&
            ancestryLeaf.node.kind === Ast.NodeKind.LiteralExpression &&
            (ancestryLeaf.node.literalKind === Ast.LiteralKind.Logical ||
                ancestryLeaf.node.literalKind === Ast.LiteralKind.Null)
        ) {
            maybePositionName = ancestryLeaf.node.literal;
        }
    }

    if (activeNode.ancestry.length < 2) {
        return filterRecommendations(handleConjunctions(activeNode, [], maybeTrailingText), maybePositionName);
    }

    const state: InspectAutocompleteState = {
        nodeIdMapCollection,
        leafNodeIds,
        activeNode,
        maybeParseErrorToken,
        maybeTrailingText,
        parent: activeNode.ancestry[1],
        child: ActiveNodeUtils.expectLeaf(activeNode),
        ancestryIndex: 0,
    };

    const maybeEarlyExitInspected: ReadonlyArray<Language.KeywordKind> | undefined = maybeEdgeCase(state);
    if (maybeEarlyExitInspected !== undefined) {
        return maybeEarlyExitInspected;
    }

    return filterRecommendations(
        handleConjunctions(state.activeNode, traverseAncestors(state), maybeTrailingText),
        maybePositionName,
    );
}

function trailingTextFactory(activeNode: ActiveNode, parseErrorToken: Language.Token): TrailingText {
    return {
        text: parseErrorToken.data,
        isInOrOnPosition: PositionUtils.isInToken(activeNode.position, parseErrorToken, false, true),
    };
}

// Travel the ancestry path in Active node in [parent, child] pairs.
// Without zipping the values we wouldn't know what we're completing for.
// For example 'if true |' gives us a pair something like [IfExpression, Constant].
// We can now know we failed to parse a 'then' constant.
function traverseAncestors(state: InspectAutocompleteState): ReadonlyArray<Language.KeywordKind> {
    const ancestry: ReadonlyArray<TXorNode> = state.activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let maybeInspected: ReadonlyArray<Language.KeywordKind> | undefined;
    for (let ancestryIndex: number = 1; ancestryIndex < numNodes; ancestryIndex += 1) {
        state.ancestryIndex = ancestryIndex;
        state.parent = ancestry[ancestryIndex];
        state.child = ancestry[ancestryIndex - 1];

        switch (state.parent.node.kind) {
            case Ast.NodeKind.ErrorHandlingExpression:
                maybeInspected = autocompleteErrorHandlingExpression(state);
                break;

            case Ast.NodeKind.IdentifierPairedExpression:
                maybeInspected = autocompleteIdentifierPairedExpression(state);
                break;

            case Ast.NodeKind.LetExpression:
                maybeInspected = autocompleteLetExpression(state);
                break;

            case Ast.NodeKind.ListExpression:
                maybeInspected = autocompleteListExpression(state);
                break;

            case Ast.NodeKind.SectionMember:
                maybeInspected = autocompleteSectionMember(state);
                break;

            default:
                maybeInspected = autocompleteDefault(state);
        }

        if (maybeInspected !== undefined) {
            return maybeInspected;
        }
    }

    return [];
}

// A tuple can't easily be used as a Map key as it does a shallow comparison.
// The work around is to stringify the tuple key, even though we lose typing by doing so.
// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: number | undefined): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}

function maybeEdgeCase(state: InspectAutocompleteState): ReadonlyArray<Language.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const maybeParseErrorToken: Language.Token | undefined = state.maybeParseErrorToken;
    let maybeInspected: ReadonlyArray<Language.KeywordKind> | undefined;

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
        maybeInspected = StartOfDocumentKeywords.filter((keywordKind: Language.KeywordKind) =>
            keywordKind.startsWith(identifier),
        );
    }

    // `(_ |) => _` -> `(_ as) => _`
    else if (
        ancestry[0].kind === XorNodeKind.Ast &&
        ancestry[0].node.kind === Ast.NodeKind.Identifier &&
        ancestry[1].node.kind === Ast.NodeKind.Parameter &&
        PositionUtils.isAfterAstNode(activeNode.position, ancestry[0].node, false)
    ) {
        maybeInspected = [Language.KeywordKind.As];
    }

    // `(foo a|) => foo` -> `(foo as) => foo
    else if (
        maybeParseErrorToken?.data === "a" &&
        ancestry[0].kind === XorNodeKind.Context &&
        ancestry[0].node.kind === Ast.NodeKind.Constant &&
        ancestry[1].node.kind === Ast.NodeKind.ParameterList &&
        ancestry[2].node.kind === Ast.NodeKind.FunctionExpression
    ) {
        maybeInspected = [Language.KeywordKind.As];
    }

    return maybeInspected;
}

function filterRecommendations(
    inspected: ReadonlyArray<Language.KeywordKind>,
    maybePositionName: string | undefined,
): ReadonlyArray<Language.KeywordKind> {
    if (maybePositionName === undefined) {
        return inspected;
    }

    const positionName: string = maybePositionName;
    return inspected.filter((kind: Language.KeywordKind) => kind.startsWith(positionName));
}

function handleConjunctions(
    activeNode: ActiveNode,
    inspected: ReadonlyArray<Language.KeywordKind>,
    maybeTrailingText: TrailingText | undefined,
): ReadonlyArray<Language.KeywordKind> {
    if (
        activeNode.leafKind !== ActiveNodeLeafKind.AfterAstNode &&
        activeNode.leafKind !== ActiveNodeLeafKind.ContextNode
    ) {
        return inspected;
    }

    const activeNodeLeaf: TXorNode = ActiveNodeUtils.expectLeaf(activeNode);
    if (!XorNodeUtils.isTUnaryType(activeNodeLeaf)) {
        if (maybeTrailingText !== undefined) {
            return autocompleteFromTrailingText(inspected, maybeTrailingText, undefined);
        } else {
            return inspected;
        }
    } else if (maybeTrailingText !== undefined) {
        return autocompleteFromTrailingText(inspected, maybeTrailingText, undefined);
    } else if (maybeTrailingText !== undefined) {
        return autocompleteFromTrailingText(inspected, maybeTrailingText, undefined);
    } else if (activeNodeLeaf.kind === XorNodeKind.Ast) {
        return ArrayUtils.concatUnique(inspected, ConjunctionKeywords);
    } else {
        return inspected;
    }
}

function autocompleteFromTrailingText(
    inspected: ReadonlyArray<Language.KeywordKind>,
    trailingText: TrailingText,
    maybeAllowedKeywords: ReadonlyArray<Language.KeywordKind> | undefined,
): ReadonlyArray<Language.KeywordKind> {
    if (trailingText.isInOrOnPosition === false) {
        return inspected;
    }
    Assert.isTrue(trailingText.text.length > 0, "trailingText.length > 0");

    maybeAllowedKeywords =
        maybeAllowedKeywords ?? PartialConjunctionKeywordAutocompleteMap.get(trailingText.text[0].toLocaleLowerCase());

    if (maybeAllowedKeywords !== undefined) {
        return ArrayUtils.concatUnique(
            inspected,
            maybeAllowedKeywords.filter((keyword: Language.KeywordKind) => keyword.startsWith(trailingText.text)),
        );
    } else {
        return inspected;
    }
}

function autocompleteKeywordConstant(
    activeNode: ActiveNode,
    child: TXorNode,
    keywordKind: Language.KeywordKind,
): ReadonlyArray<Language.KeywordKind> | undefined {
    if (PositionUtils.isBeforeXorNode(activeNode.position, child, false)) {
        return undefined;
    } else if (child.kind === XorNodeKind.Ast) {
        // So long as you're inside of an Ast Constant there's nothing that can be recommended other than the constant.
        // Note that we previously checked isBeforeXorNode so we can use the quicker isOnAstNodeEnd to check
        // if we're inside of the Ast node.
        return PositionUtils.isOnAstNodeEnd(activeNode.position, child.node) ? [] : [keywordKind];
    }

    return [keywordKind];
}

function autocompleteErrorHandlingExpression(
    state: InspectAutocompleteState,
): ReadonlyArray<Language.KeywordKind> | undefined {
    const position: Position = state.activeNode.position;
    const child: TXorNode = state.child;
    const maybeParseErrorToken: Language.Token | undefined = state.maybeParseErrorToken;

    const maybeChildAttributeIndex: number | undefined = child.node.maybeAttributeIndex;
    if (maybeChildAttributeIndex === 0) {
        return [Language.KeywordKind.Try];
    } else if (maybeChildAttributeIndex === 1) {
        // 'try true o|' creates a ParseError.
        // It's ambiguous if the next token should be either 'otherwise' or 'or'.
        if (maybeParseErrorToken !== undefined) {
            const errorToken: Language.Token = maybeParseErrorToken;

            // First we test if we can autocomplete using the error token.
            if (
                errorToken.kind === Language.TokenKind.Identifier &&
                PositionUtils.isInToken(position, maybeParseErrorToken, false, true)
            ) {
                const tokenData: string = maybeParseErrorToken.data;

                // If we can exclude 'or' then the only thing we can autocomplete is 'otherwise'.
                if (tokenData.length > 1 && Language.KeywordKind.Otherwise.startsWith(tokenData)) {
                    return [Language.KeywordKind.Otherwise];
                }
                // In the ambiguous case we don't know what they're typing yet, so we suggest both.
                // In the case of an identifier that doesn't match a 'or' or 'otherwise'
                // we still suggest the only valid keywords allowed.
                // In both cases the return is the same.
                else {
                    return [Language.KeywordKind.Or, Language.KeywordKind.Otherwise];
                }
            }

            // There exists an error token we can't map it to an OtherwiseExpression.
            else {
                return undefined;
            }
        } else if (child.kind === XorNodeKind.Ast && PositionUtils.isAfterAstNode(position, child.node, true)) {
            return [Language.KeywordKind.Otherwise];
        } else {
            return ExpressionAutocomplete;
        }
    } else {
        return undefined;
    }
}

function autocompleteIdentifierPairedExpression(
    state: InspectAutocompleteState,
): ReadonlyArray<Language.KeywordKind> | undefined {
    const childAttributeIndex: number | undefined = state.child.node.maybeAttributeIndex;

    // `section; s|`
    // `section; [] |`
    if (
        childAttributeIndex === 0 &&
        AncestryUtils.maybeNextXorNode(state.activeNode.ancestry, state.ancestryIndex, [Ast.NodeKind.SectionMember])
    ) {
        return [Language.KeywordKind.Shared];
    } else if (childAttributeIndex !== 2) {
        return [];
    }
    const maybeLeaf: Ast.TNode | undefined = NodeIdMapUtils.maybeLeftMostLeaf(
        state.nodeIdMapCollection,
        state.child.node.id,
    );
    // `x = |`
    // `x = |1`
    if (maybeLeaf === undefined || PositionUtils.isBeforeAstNode(state.activeNode.position, maybeLeaf, false)) {
        return ExpressionKeywords;
    } else {
        return undefined;
    }
}

function autocompleteLetExpression(state: InspectAutocompleteState): ReadonlyArray<Language.KeywordKind> | undefined {
    // LetExpressions can trigger another inspection which will always hit the same LetExpression.
    // Make sure that it doesn't trigger an infinite recursive call.
    const child: TXorNode = state.child;

    if (child.kind === XorNodeKind.Context && child.node.maybeAttributeIndex === 2) {
        const maybeInpsected: ReadonlyArray<Language.KeywordKind> | undefined = autocompleteLastKeyValuePair(
            state,
            NodeIdMapIterator.iterLetExpression(state.nodeIdMapCollection, state.parent),
        );
        if (maybeInpsected === undefined || state.maybeTrailingText !== undefined) {
            return undefined;
        }

        return [...maybeInpsected, Language.KeywordKind.In];
    }

    return autocompleteDefault(state);
}

function autocompleteListExpression(state: InspectAutocompleteState): ReadonlyArray<Language.KeywordKind> | undefined {
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
    const nodeOrComma: TXorNode = AncestryUtils.expectNthPreviousXorNode(
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
            ? AncestryUtils.expectNthPreviousXorNode(activeNode.ancestry, ancestryIndex, 4, undefined)
            : nodeOrComma;

    if (itemNode.kind === XorNodeKind.Context || PositionUtils.isBeforeXorNode(activeNode.position, itemNode, false)) {
        return ExpressionAutocomplete;
    } else {
        return undefined;
    }
}

// Test if 'shared' could be what's being typed. Eg.
// 'section s' -> could either be interpreted as either the 'shared' keyword, or the key-value-pair key is 's'.
function autocompleteSectionMember(state: InspectAutocompleteState): ReadonlyArray<Language.KeywordKind> | undefined {
    // SectionMember.namePairedExpression
    if (state.child.node.maybeAttributeIndex === 2) {
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
        const maybeName: TXorNode | undefined = AncestryUtils.maybeNthPreviousXorNode(
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
        if (Language.KeywordKind.Shared.startsWith(name.literal)) {
            return [Language.KeywordKind.Shared];
        }
    }

    return [];
}

function autocompleteLastKeyValuePair(
    state: InspectAutocompleteState,
    keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<Ast.GeneralizedIdentifier | Ast.Identifier>>,
): ReadonlyArray<Language.KeywordKind> | undefined {
    if (keyValuePairs.length === 0) {
        return undefined;
    }

    // Grab the last value (if one exists)
    const maybeLastValue: TXorNode | undefined = keyValuePairs[keyValuePairs.length - 1].maybeValue;
    if (maybeLastValue === undefined) {
        return undefined;
    }

    // Grab the right-most Ast node in the last value.
    const maybeRightMostAstLeafForLastValue: Ast.TNode | undefined = NodeIdMapUtils.maybeRightMostLeaf(
        state.nodeIdMapCollection,
        maybeLastValue.node.id,
        undefined,
    );
    if (maybeRightMostAstLeafForLastValue === undefined) {
        return undefined;
    }

    // Start a new autocomplete inspection where the ActiveNode's ancestry is the right-most Ast node in the last value.
    const shiftedAncestry: ReadonlyArray<TXorNode> = AncestryUtils.expectAncestry(
        state.nodeIdMapCollection,
        maybeRightMostAstLeafForLastValue.id,
    );
    Assert.isTrue(shiftedAncestry.length >= 2, "shiftedAncestry.length >= 2");
    const shiftedActiveNode: ActiveNode = {
        ...state.activeNode,
        ancestry: shiftedAncestry,
    };
    const inspected: ReadonlyArray<Language.KeywordKind> = inspectAutocomplete(
        state.nodeIdMapCollection,
        state.leafNodeIds,
        shiftedActiveNode,
        state.maybeParseErrorToken,
    );

    return inspected;
}

function autocompleteDefault(state: InspectAutocompleteState): ReadonlyArray<Language.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const child: TXorNode = state.child;
    const key: string = createMapKey(state.parent.node.kind, child.node.maybeAttributeIndex);

    if (AutocompleteExpressionKeys.indexOf(key) !== -1) {
        return autocompleteDefaultExpression(state);
    } else {
        const maybeMappedKeywordKind: Language.KeywordKind | undefined = AutocompleteConstantMap.get(key);
        return maybeMappedKeywordKind !== undefined
            ? autocompleteKeywordConstant(activeNode, child, maybeMappedKeywordKind)
            : undefined;
    }
}

function autocompleteDefaultExpression(
    state: InspectAutocompleteState,
): ReadonlyArray<Language.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const child: TXorNode = state.child;

    // '[x=|1]
    if (activeNode.leafKind === ActiveNodeLeafKind.ShiftedRight) {
        return ExpressionKeywords;
    }
    // `if 1|`
    else if (
        child.kind === XorNodeKind.Ast &&
        child.node.kind === Ast.NodeKind.LiteralExpression &&
        child.node.literalKind === Ast.LiteralKind.Numeric
    ) {
        return [];
    }

    return ExpressionKeywords;
}
