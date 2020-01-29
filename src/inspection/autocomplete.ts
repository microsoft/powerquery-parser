// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { ResultUtils } from "../common/result";
import { KeywordKind, TExpressionKeywords, Token, TokenKind } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParseError } from "../parser";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { Position, PositionUtils } from "./position";

export interface AutocompleteInspected {
    readonly autocompleteKeywords: ReadonlyArray<KeywordKind>;
}

export type TriedAutocomplete = Result<AutocompleteInspected, CommonError.CommonError>;

export function tryFrom(
    maybeActiveNode: Option<ActiveNode>,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseError: Option<ParseError.ParseError>,
): TriedAutocomplete {
    if (maybeActiveNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: {
                autocompleteKeywords: ExpressionAutocomplete,
            },
        };
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const leaf: NodeIdMap.TXorNode = activeNode.ancestry[0];
    const maybeParseErrorToken: Option<Token> = maybeParseError
        ? ParseError.maybeTokenFrom(maybeParseError.innerError)
        : undefined;

    let maybePositionName: Option<string>;
    if (PositionUtils.isInXorNode(activeNode.position, nodeIdMapCollection, leaf, false, true)) {
        if (activeNode.maybeIdentifierUnderPosition !== undefined) {
            maybePositionName = activeNode.maybeIdentifierUnderPosition.literal;
        }
        // Matches 'null', 'true', and 'false'.
        else if (
            leaf.kind === NodeIdMap.XorNodeKind.Ast &&
            leaf.node.kind === Ast.NodeKind.LiteralExpression &&
            (leaf.node.literalKind === Ast.LiteralKind.Logical || leaf.node.literalKind === Ast.LiteralKind.Null)
        ) {
            maybePositionName = leaf.node.literal;
        }
    }

    const triedAutocomplete: Result<ReadonlyArray<KeywordKind>, CommonError.CommonError> = traverseAncestors(
        activeNode,
        nodeIdMapCollection,
        maybePositionName,
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

function traverseAncestors(
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybePositionName: Option<string>,
    maybeParseErrorToken: Option<Token>,
): Result<ReadonlyArray<KeywordKind>, CommonError.CommonError> {
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let maybeInspected: Option<ReadonlyArray<KeywordKind>>;
    try {
        for (let index: number = 1; index < numNodes; index += 1) {
            const parent: NodeIdMap.TXorNode = ancestry[index];
            const child: NodeIdMap.TXorNode = ancestry[index - 1];
            // If a node is in a Context state then it should be up to the parent to autocomplete.
            // Continue to let a later iteration handle autocomplete.
            if (
                parent.kind === NodeIdMap.XorNodeKind.Context &&
                PositionUtils.isOnContextNodeStart(activeNode.position, parent.node)
            ) {
                continue;
            }
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
                            child.kind === NodeIdMap.XorNodeKind.Context ||
                            PositionUtils.isBeforeAstNode(activeNode.position, child.node, false)
                        ) {
                            maybeInspected = ExpressionAutocomplete;
                        }
                    } else {
                        maybeInspected = AutocompleteMap.get(key);
                    }
                    break;
                }
            }

            if (maybeInspected !== undefined) {
                return ResultUtils.okFactory(maybeInspected);
            }
        }
    } catch (err) {
        return ResultUtils.errFactory(CommonError.ensureCommonError(err));
    }

    return ResultUtils.okFactory([]);
}

function handleEdgeCases(
    inspected: ReadonlyArray<KeywordKind>,
    activeNode: ActiveNode,
    maybeParseErrorToken: Option<Token>,
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
    maybePositionName: Option<string>,
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
const AutocompleteMap: Map<string, ReadonlyArray<KeywordKind>> = new Map<string, ReadonlyArray<KeywordKind>>([
    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), [KeywordKind.Error]],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), [KeywordKind.If]],
    [createMapKey(Ast.NodeKind.IfExpression, 2), [KeywordKind.Then]],
    [createMapKey(Ast.NodeKind.IfExpression, 4), [KeywordKind.Else]],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 0), [KeywordKind.Otherwise]],

    // Ast.NodeKind.Section
    [createMapKey(Ast.NodeKind.Section, 1), [KeywordKind.Section]],
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
    const key: string = parseErrorToken.data;
    const maybeAllowedKeywords: Option<ReadonlyArray<KeywordKind>> = PartialConjunctionKeywordAutocompleteMap.get(
        key[0].toLocaleLowerCase(),
    );
    if (maybeAllowedKeywords === undefined) {
        return inspected;
    }
    const allowedKeywords: ReadonlyArray<KeywordKind> = maybeAllowedKeywords;

    for (const ancestor of activeNode.ancestry) {
        if (NodeIdMapUtils.isTUnaryType(ancestor)) {
            return updateWithIdentifierKey(inspected, key, allowedKeywords);
        }
    }

    return inspected;
}

function updateWithIdentifierKey(
    inspected: ReadonlyArray<KeywordKind>,
    key: string,
    allowedKeywords: ReadonlyArray<KeywordKind>,
): ReadonlyArray<KeywordKind> {
    const newAllowedAutocompleteKeywords: KeywordKind[] = [...inspected];
    for (const keyword of allowedKeywords) {
        if (
            // allowedKeywords is a map of 'first character' -> 'all possible keywords that start with the character',
            // meaning 'an' maps 'a' to '["and", "as"].
            // This check prevents 'an' adding "and" as well.
            keyword.startsWith(key) &&
            // Keyword isn't already in the list of allowed keywords.
            newAllowedAutocompleteKeywords.indexOf(keyword) === -1
        ) {
            newAllowedAutocompleteKeywords.push(keyword);
        }
    }

    return newAllowedAutocompleteKeywords;
}

// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: Option<number>): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}

function autocompleteErrorHandlingExpression(
    position: Position,
    child: NodeIdMap.TXorNode,
    maybeParseErrorToken: Option<Token>,
): Option<ReadonlyArray<KeywordKind>> {
    const maybeChildAttributeIndex: Option<number> = child.node.maybeAttributeIndex;
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
        } else if (
            child.kind === NodeIdMap.XorNodeKind.Ast &&
            PositionUtils.isAfterAstNode(position, child.node, true)
        ) {
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
    child: NodeIdMap.TXorNode,
    ancestorIndex: number,
): Option<ReadonlyArray<KeywordKind>> {
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
    const nodeOrComma: NodeIdMap.TXorNode = ActiveNodeUtils.expectPreviousXorNode(
        activeNode,
        ancestorIndex,
        3,
        undefined,
    );
    if (nodeOrComma.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    let itemNode: NodeIdMap.TXorNode;
    if (nodeOrComma.node.kind === Ast.NodeKind.RangeExpression) {
        itemNode = ActiveNodeUtils.expectPreviousXorNode(activeNode, ancestorIndex, 4, undefined);
    } else {
        itemNode = nodeOrComma;
    }

    if (
        itemNode.kind === NodeIdMap.XorNodeKind.Context ||
        PositionUtils.isBeforeXorNode(activeNode.position, itemNode, false)
    ) {
        return ExpressionAutocomplete;
    } else {
        return undefined;
    }
}

function autocompleteSectionMember(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    parent: NodeIdMap.TXorNode,
    child: NodeIdMap.TXorNode,
    ancestorIndex: number,
): Option<ReadonlyArray<KeywordKind>> {
    if (child.node.maybeAttributeIndex === 2) {
        const maybeSharedConstant: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            parent.node.id,
            1,
            [Ast.NodeKind.Constant],
        );

        // 'shared' exists.
        if (maybeSharedConstant !== undefined) {
            return undefined;
        } else {
            // SectionMember -> IdentifierPairedExpression -> Identifier
            const maybeName: Option<NodeIdMap.TXorNode> = ActiveNodeUtils.maybePreviousXorNode(
                activeNode,
                ancestorIndex,
                2,
                [Ast.NodeKind.IdentifierPairedExpression, Ast.NodeKind.Identifier],
            );
            // Test if the currently typed name could be the start of 'shared'.
            if (maybeName && maybeName.kind === NodeIdMap.XorNodeKind.Ast) {
                const name: Ast.Identifier = maybeName.node as Ast.Identifier;
                if (KeywordKind.Shared.startsWith(name.literal)) {
                    return [KeywordKind.Shared];
                }
            } else {
                return undefined;
            }
        }
    }

    return undefined;
}
