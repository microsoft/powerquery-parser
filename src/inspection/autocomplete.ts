// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../common";
import { ResultUtils } from "../common/result";
import { KeywordKind, TExpressionKeywords, Token, TokenKind } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParseError, TXorNode, XorNodeKind } from "../parser";
import { InspectionSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { Position, PositionUtils } from "./position";

export interface AutocompleteInspected {
    readonly autocompleteKeywords: ReadonlyArray<KeywordKind>;
}

export type TriedAutocomplete = Result<AutocompleteInspected, CommonError.CommonError>;

export function tryFrom(
    settings: InspectionSettings,
    maybeActiveNode: ActiveNode | undefined,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseError: ParseError.ParseError | undefined,
): TriedAutocomplete {
    if (maybeActiveNode === undefined) {
        return ResultUtils.okFactory({
            autocompleteKeywords: ExpressionAutocomplete,
        });
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const leaf: TXorNode = activeNode.ancestry[0];
    const maybeParseErrorToken: Token | undefined = maybeParseError
        ? ParseError.maybeTokenFrom(maybeParseError.innerError)
        : undefined;

    let maybePositionName: string | undefined;
    if (PositionUtils.isInXorNode(activeNode.position, nodeIdMapCollection, leaf, false, true)) {
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

    const triedAutocomplete: Result<ReadonlyArray<KeywordKind>, CommonError.CommonError> = traverseAncestors(
        settings,
        activeNode,
        nodeIdMapCollection,
        maybeParseErrorToken,
    );
    if (ResultUtils.isErr(triedAutocomplete)) {
        return triedAutocomplete;
    }

    let inspected: ReadonlyArray<KeywordKind> = handleEdgeCases(
        triedAutocomplete.value,
        activeNode,
        maybeParseErrorToken,
    );
    inspected = filterRecommendations(inspected, maybePositionName);

    return ResultUtils.okFactory({ autocompleteKeywords: inspected });
}

// Travel the ancestry path in Active node in [parent, child] pairs.
// Without zipping the values we wouldn't know what we're autocompleting.
// For example 'if true |' gives us a pair something like [IfExpression, Constant].
// We can now know we failed to parse a 'then' constant.
function traverseAncestors(
    settings: InspectionSettings,
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseErrorToken: Token | undefined,
): Result<ReadonlyArray<KeywordKind>, CommonError.CommonError> {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let maybeInspected: ReadonlyArray<KeywordKind> | undefined;
    try {
        for (let index: number = 1; index < numNodes; index += 1) {
            const parent: TXorNode = ancestry[index];
            const child: TXorNode = ancestry[index - 1];

            switch (parent.node.kind) {
                case Ast.NodeKind.ErrorHandlingExpression:
                    maybeInspected = autocompleteErrorHandlingExpression(
                        activeNode.position,
                        child,
                        maybeParseErrorToken,
                    );
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
                        const maybeMappedKeywordKind: KeywordKind | undefined = AutocompleteConstantMap.get(key);
                        if (maybeMappedKeywordKind) {
                            maybeInspected = autocompleteKeywordConstant(activeNode, child, maybeMappedKeywordKind);
                        }
                    }
                    break;
                }
            }

            if (maybeInspected !== undefined) {
                return ResultUtils.okFactory(maybeInspected);
            }
        }
    } catch (err) {
        return ResultUtils.errFactory(CommonError.ensureCommonError(settings.localizationTemplates, err));
    }

    return ResultUtils.okFactory([]);
}

function handleEdgeCases(
    inspected: ReadonlyArray<KeywordKind>,
    activeNode: ActiveNode,
    maybeParseErrorToken: Token | undefined,
): ReadonlyArray<KeywordKind> {
    // Check if they're typing for the first time at the start of the file,
    // which defaults to searching for an identifier.
    if (
        maybeParseErrorToken === undefined &&
        activeNode.ancestry.length === 2 &&
        activeNode.ancestry[0].node.kind === Ast.NodeKind.Identifier &&
        activeNode.ancestry[1].node.kind === Ast.NodeKind.IdentifierExpression
    ) {
        inspected = ExpressionAndSectionAutocomplete;
    }

    if (
        maybeParseErrorToken !== undefined &&
        PositionUtils.isInToken(activeNode.position, maybeParseErrorToken, false, true)
    ) {
        inspected = updateWithParseErrorToken(inspected, activeNode, maybeParseErrorToken);
    }

    return inspected;
}

function filterRecommendations(
    inspected: ReadonlyArray<KeywordKind>,
    maybePositionName: string | undefined,
): ReadonlyArray<KeywordKind> {
    if (maybePositionName === undefined) {
        return inspected;
    }

    const positionName: string = maybePositionName;
    return inspected.filter((kind: KeywordKind) => kind.startsWith(positionName));
}

const ExpressionAutocomplete: ReadonlyArray<KeywordKind> = TExpressionKeywords;

const ExpressionAndSectionAutocomplete: ReadonlyArray<KeywordKind> = [...TExpressionKeywords, KeywordKind.Section];

const AutocompleteExpressionKeys: ReadonlyArray<string> = [
    createMapKey(Ast.NodeKind.ErrorRaisingExpression, 1),
    createMapKey(Ast.NodeKind.GeneralizedIdentifierPairedExpression, 2),
    createMapKey(Ast.NodeKind.IdentifierPairedExpression, 2),
    createMapKey(Ast.NodeKind.IdentifierExpressionPairedExpression, 2),
    createMapKey(Ast.NodeKind.IfExpression, 1),
    createMapKey(Ast.NodeKind.IfExpression, 3),
    createMapKey(Ast.NodeKind.IfExpression, 5),
    createMapKey(Ast.NodeKind.InvokeExpression, 0),
    createMapKey(Ast.NodeKind.InvokeExpression, 1),
    createMapKey(Ast.NodeKind.InvokeExpression, 2),
    createMapKey(Ast.NodeKind.ListExpression, 1),
    createMapKey(Ast.NodeKind.OtherwiseExpression, 1),
    createMapKey(Ast.NodeKind.ParenthesizedExpression, 1),
];

// Autocompletes that are coming from a constant can be resolved using a map.
// This is possible because reading constants are binary.
// Either the constant was read and you're in the next context, or you didn't and you're in the constant's context.
const AutocompleteConstantMap: Map<string, KeywordKind> = new Map<string, KeywordKind>([
    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), KeywordKind.Error],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), KeywordKind.If],
    [createMapKey(Ast.NodeKind.IfExpression, 2), KeywordKind.Then],
    [createMapKey(Ast.NodeKind.IfExpression, 4), KeywordKind.Else],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 0), KeywordKind.Otherwise],

    // Ast.NodeKind.Section
    [createMapKey(Ast.NodeKind.Section, 1), KeywordKind.Section],
]);

// Used with maybeParseError to see if a user could be typing a conjunctive keyword such as 'or'. Eg.
// 'Details[UserName] <> "" o|'
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<KeywordKind>> = new Map<
    string,
    ReadonlyArray<KeywordKind>
>([["a", [KeywordKind.And, KeywordKind.As]], ["o", [KeywordKind.Or]], ["m", [KeywordKind.Meta]]]);

function updateWithParseErrorToken(
    inspected: ReadonlyArray<KeywordKind>,
    activeNode: ActiveNode,
    parseErrorToken: Token,
): ReadonlyArray<KeywordKind> {
    const parseErrorTokenData: string = parseErrorToken.data;
    const maybeAllowedKeywords: ReadonlyArray<KeywordKind> | undefined = PartialConjunctionKeywordAutocompleteMap.get(
        parseErrorTokenData[0].toLocaleLowerCase(),
    );
    if (maybeAllowedKeywords === undefined) {
        return inspected;
    }
    const allowedKeywords: ReadonlyArray<KeywordKind> = maybeAllowedKeywords;

    for (const ancestor of activeNode.ancestry) {
        if (NodeIdMapUtils.isTUnaryType(ancestor)) {
            return updateUsingConjunctionKeywords(inspected, parseErrorTokenData, allowedKeywords);
        }
    }

    return inspected;
}

// Given a list of possible conjunction keywords, update inspected with any matching conjunction keywords.
function updateUsingConjunctionKeywords(
    inspected: ReadonlyArray<KeywordKind>,
    parseErrorTokenData: string,
    allowedKeywords: ReadonlyArray<KeywordKind>,
): ReadonlyArray<KeywordKind> {
    const newAllowedAutocompleteKeywords: KeywordKind[] = [...inspected];
    for (const keyword of allowedKeywords) {
        if (keyword.startsWith(parseErrorTokenData) && newAllowedAutocompleteKeywords.indexOf(keyword) === -1) {
            newAllowedAutocompleteKeywords.push(keyword);
        }
    }

    return newAllowedAutocompleteKeywords;
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
    keywordKind: KeywordKind,
): ReadonlyArray<KeywordKind> | undefined {
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
    maybeParseErrorToken: Token | undefined,
): ReadonlyArray<KeywordKind> | undefined {
    const maybeChildAttributeIndex: number | undefined = child.node.maybeAttributeIndex;
    if (maybeChildAttributeIndex === 0) {
        return [KeywordKind.Try];
    } else if (maybeChildAttributeIndex === 1) {
        // 'try true o|' creates a ParseError.
        // It's ambigous if the next token should be either 'otherwise' or 'or'.
        if (maybeParseErrorToken !== undefined) {
            const errorToken: Token = maybeParseErrorToken;

            // First we test if we can autocomplete using the error token.
            if (
                errorToken.kind === TokenKind.Identifier &&
                PositionUtils.isInToken(position, maybeParseErrorToken, false, true)
            ) {
                const tokenData: string = maybeParseErrorToken.data;

                // If we can exclude 'or' then the only thing we can autocomplete is 'otherwise'.
                if (tokenData.length > 1 && KeywordKind.Otherwise.startsWith(tokenData)) {
                    return [KeywordKind.Otherwise];
                }
                // In the ambigous case we don't know what they're typing yet, so we suggest both.
                // In the case of an identifier that doesn't match a 'or' or 'otherwise'
                // we still suggest the only valid keywords allowed.
                // In both cases the return is the same.
                else {
                    return [KeywordKind.Or, KeywordKind.Otherwise];
                }
            }

            // There exists an error token we can't map it to an OtherwiseExpression.
            else {
                return undefined;
            }
        } else if (child.kind === XorNodeKind.Ast && PositionUtils.isAfterAstNode(position, child.node, true)) {
            return [KeywordKind.Otherwise];
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
    ancestorIndex: number,
): ReadonlyArray<KeywordKind> | undefined {
    // '{' or '}'
    if (child.node.maybeAttributeIndex === 0 || child.node.maybeAttributeIndex === 2) {
        return undefined;
    } else if (child.node.maybeAttributeIndex !== 1) {
        const details: {} = {
            nodeId: child.node.id,
            maybeAttributeIndex: child.node.maybeAttributeIndex,
        };
        throw new CommonError.InvariantError("ListExpression child has an invalid maybeAttributeIndex", details);
    }

    // ListExpression -> ArrayWrapper -> Csv -> X
    const nodeOrComma: TXorNode = ActiveNodeUtils.expectPreviousXorNode(activeNode, ancestorIndex, 3, undefined);
    if (nodeOrComma.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // We know it's the node component of the Csv,
    // but we have to drilldown one more level if it's a RangeExpression.
    const itemNode: TXorNode =
        nodeOrComma.node.kind === Ast.NodeKind.RangeExpression
            ? ActiveNodeUtils.expectPreviousXorNode(activeNode, ancestorIndex, 4, undefined)
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
    ancestorIndex: number,
): ReadonlyArray<KeywordKind> | undefined {
    // SectionMember.namePairedExpression
    if (child.node.maybeAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const maybeSharedConstant: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            parent.node.id,
            1,
            [Ast.NodeKind.Constant],
        );

        // 'shared' was parsed so we can exit.
        if (maybeSharedConstant !== undefined) {
            return undefined;
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const maybeName: TXorNode | undefined = ActiveNodeUtils.maybePreviousXorNode(activeNode, ancestorIndex, 2, [
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
        ]);

        // Name hasn't been parsed yet so we can exit.
        if (maybeName === undefined || maybeName.kind !== XorNodeKind.Ast) {
            return undefined;
        }

        const name: Ast.Identifier = maybeName.node as Ast.Identifier;
        if (KeywordKind.Shared.startsWith(name.literal)) {
            return [KeywordKind.Shared];
        }
    }

    return undefined;
}
