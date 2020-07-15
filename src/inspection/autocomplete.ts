// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Language } from "..";
import { CommonError, Result } from "../common";
import { ResultUtils } from "../common/result";
import { Ast, ExpressionKeywords } from "../language";
import { getLocalizationTemplates } from "../localization";
import { AncestryUtils, IParserState, NodeIdMap, NodeIdMapUtils, ParseError, TXorNode, XorNodeKind } from "../parser";
import { CommonSettings } from "../settings";
import { ActiveNode } from "./activeNode";
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
    maybeActiveNode: ActiveNode | undefined,
    maybeParseError: ParseError.ParseError<S> | undefined,
): TriedAutocomplete {
    if (maybeActiveNode === undefined) {
        return ResultUtils.okFactory([...ExpressionAutocomplete, Language.KeywordKind.Section]);
    }
    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () =>
        inspectAutocomplete(nodeIdMapCollection, maybeActiveNode, maybeParseError),
    );
}

function inspectAutocomplete<S extends IParserState = IParserState>(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    maybeParseError: ParseError.ParseError<S> | undefined,
): ReadonlyArray<Language.KeywordKind> {
    const leaf: TXorNode = activeNode.ancestry[0];
    const maybeParseErrorToken: Language.Token | undefined = maybeParseError
        ? ParseError.maybeTokenFrom(maybeParseError.innerError)
        : undefined;

    const maybeInspected: ReadonlyArray<Language.KeywordKind> | undefined = handleEdgeCases(
        activeNode,
        maybeParseErrorToken,
    );
    if (maybeInspected !== undefined) {
        return maybeInspected;
    }

    let maybePositionName: string | undefined;
    if (PositionUtils.isInXorNode(nodeIdMapCollection, activeNode.position, leaf, false, true)) {
        if (activeNode.maybeIdentifierUnderPosition !== undefined) {
            maybePositionName = activeNode.maybeIdentifierUnderPosition.literal;
        }
        // Matches 'null', 'true', and 'false'.
        else if (
            leaf.kind === XorNodeKind.Ast &&
            leaf.node.kind === Ast.NodeKind.LiteralExpression &&
            (leaf.node.literalKind === Ast.LiteralKind.Logical || leaf.node.literalKind === Ast.LiteralKind.Null)
        ) {
            maybePositionName = leaf.node.literal;
        }
    }

    const autocomplete: ReadonlyArray<Language.KeywordKind> = traverseAncestors(
        activeNode,
        nodeIdMapCollection,
        maybeParseErrorToken,
    );

    return filterRecommendations(autocomplete, maybePositionName);
}

// Travel the ancestry path in Active node in [parent, child] pairs.
// Without zipping the values we wouldn't know what we're completing for.
// For example 'if true |' gives us a pair something like [IfExpression, Constant].
// We can now know we failed to parse a 'then' constant.
function traverseAncestors(
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseErrorToken: Language.Token | undefined,
): ReadonlyArray<Language.KeywordKind> {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let maybeInspected: ReadonlyArray<Language.KeywordKind> | undefined;
    for (let index: number = 1; index < numNodes; index += 1) {
        const parent: TXorNode = ancestry[index];
        const child: TXorNode = ancestry[index - 1];

        switch (parent.node.kind) {
            case Ast.NodeKind.ErrorHandlingExpression:
                maybeInspected = autocompleteErrorHandlingExpression(activeNode.position, child, maybeParseErrorToken);
                break;

            case Ast.NodeKind.ListExpression:
                maybeInspected = autocompleteListExpression(activeNode, child, index);
                break;

            case Ast.NodeKind.SectionMember:
                maybeInspected = autocompleteSectionMember(nodeIdMapCollection, activeNode, parent, child, index);
                break;

            default: {
                const key: string = createMapKey(parent.node.kind, child.node.maybeAttributeIndex);
                if (AutocompleteExpressionKeys.indexOf(key) !== -1) {
                    if (
                        child.kind === XorNodeKind.Context ||
                        PositionUtils.isBeforeAstNode(activeNode.position, child.node, false)
                    ) {
                        maybeInspected = ExpressionAutocomplete;
                    }
                } else {
                    const maybeMappedKeywordKind: Language.KeywordKind | undefined = AutocompleteConstantMap.get(key);
                    if (maybeMappedKeywordKind) {
                        maybeInspected = autocompleteKeywordConstant(activeNode, child, maybeMappedKeywordKind);
                    }
                }
            }
        }

        if (maybeInspected !== undefined) {
            return maybeInspected;
        }
    }

    return [];
}

function handleEdgeCases(
    activeNode: ActiveNode,
    maybeParseErrorToken: Language.Token | undefined,
): ReadonlyArray<Language.KeywordKind> | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
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
        maybeInspected = trailingConjunctionKeywords(activeNode, maybeParseErrorToken.data, [Language.KeywordKind.As]);
    }

    // The user is typing beyond what was succesfully parsed.
    // Autocomplete conjunction keywords ('as', 'or', etc.).
    // `if foo o|` -> `if foo or`
    else if (
        maybeParseErrorToken !== undefined &&
        PositionUtils.isInToken(activeNode.position, maybeParseErrorToken, false, true) &&
        // `if true then 1 e|` shouldn't be checked.
        !(ancestry[0].node.maybeAttributeIndex === 4 && ancestry[1].node.kind === Ast.NodeKind.IfExpression) &&
        // `try x o|` shouldn't be checked.
        !(ancestry[0].node.maybeAttributeIndex === 1 && ancestry[1].node.kind === Ast.NodeKind.ErrorHandlingExpression)
    ) {
        maybeInspected = trailingConjunctionKeywords(activeNode, maybeParseErrorToken.data);
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
    ["o", [Language.KeywordKind.Or]],
    ["m", [Language.KeywordKind.Meta]],
]);

function trailingConjunctionKeywords(
    activeNode: ActiveNode,
    trailingText: string,
    maybeAllowedKeywords:
        | ReadonlyArray<Language.KeywordKind>
        | undefined = PartialConjunctionKeywordAutocompleteMap.get(trailingText[0].toLocaleLowerCase()),
): ReadonlyArray<Language.KeywordKind> | undefined {
    if (maybeAllowedKeywords === undefined) {
        return undefined;
    }
    const allowedKeywords: ReadonlyArray<Language.KeywordKind> = maybeAllowedKeywords;

    const inspected: Language.KeywordKind[] = [];
    for (const ancestor of activeNode.ancestry) {
        if (NodeIdMapUtils.isTUnaryType(ancestor)) {
            for (const keyword of allowedKeywords) {
                if (keyword.startsWith(trailingText) && inspected.indexOf(keyword) === -1) {
                    inspected.push(keyword);
                }
            }
        }
    }

    return inspected;
}

// A tuple can't easily be used as a Map key as it does a shallow comparison.
// The work around is to stringify the tuple key, even though we lose typing by doing so.
// Hopefully by having a 'createMapKey' function this will prevent bugs.
// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: number | undefined): string {
    return [nodeKind, maybeAttributeIndex].join(",");
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

    // !isBeforeXorNode && child.kind === XorNodeKind.Context
    return [keywordKind];
}

function autocompleteErrorHandlingExpression(
    position: Position,
    child: TXorNode,
    maybeParseErrorToken: Language.Token | undefined,
): ReadonlyArray<Language.KeywordKind> | undefined {
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

function autocompleteListExpression(
    activeNode: ActiveNode,
    child: TXorNode,
    ancestryIndex: number,
): ReadonlyArray<Language.KeywordKind> | undefined {
    // '{' or '}'
    if (child.node.maybeAttributeIndex === 0 || child.node.maybeAttributeIndex === 2) {
        return undefined;
    } else if (child.node.maybeAttributeIndex !== 1) {
        const details: {} = {
            nodeId: child.node.id,
            maybeAttributeIndex: child.node.maybeAttributeIndex,
        };
        throw new CommonError.InvariantError(`maybeAttributeIndex not in range [0, 2]`, details);
    }

    // ListExpression -> ArrayWrapper -> Csv -> X
    const nodeOrComma: TXorNode = AncestryUtils.expectPreviousXorNode(activeNode.ancestry, ancestryIndex, 3, undefined);
    if (nodeOrComma.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // We know it's the node component of the Csv,
    // but we have to drill down one more level if it's a RangeExpression.
    const itemNode: TXorNode =
        nodeOrComma.node.kind === Ast.NodeKind.RangeExpression
            ? AncestryUtils.expectPreviousXorNode(activeNode.ancestry, ancestryIndex, 4, undefined)
            : nodeOrComma;

    if (itemNode.kind === XorNodeKind.Context || PositionUtils.isBeforeXorNode(activeNode.position, itemNode, false)) {
        return ExpressionAutocomplete;
    } else {
        return undefined;
    }
}

// Test if 'shared' could be what's being typed. Eg.
// 'section s' -> could either be interpreted as either the 'shared' keyword, or the key-value-pair key is 's'.
function autocompleteSectionMember(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    parent: TXorNode,
    child: TXorNode,
    ancestryIndex: number,
): ReadonlyArray<Language.KeywordKind> | undefined {
    // SectionMember.namePairedExpression
    if (child.node.maybeAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const maybeSharedConstant:
            | TXorNode
            | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, parent.node.id, 1, [
            Ast.NodeKind.Constant,
        ]);

        // 'shared' was parsed so we can exit.
        if (maybeSharedConstant !== undefined) {
            return undefined;
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const maybeName: TXorNode | undefined = AncestryUtils.maybePreviousXorNode(
            activeNode.ancestry,
            ancestryIndex,
            2,
            [Ast.NodeKind.IdentifierPairedExpression, Ast.NodeKind.Identifier],
        );

        // Name hasn't been parsed yet so we can exit.
        if (maybeName === undefined || maybeName.kind !== XorNodeKind.Ast) {
            return undefined;
        }

        const name: Ast.Identifier = maybeName.node as Ast.Identifier;
        if (Language.KeywordKind.Shared.startsWith(name.literal)) {
            return [Language.KeywordKind.Shared];
        }
    }

    return [];
}
