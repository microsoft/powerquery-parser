// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { KeywordKind, TExpressionKeywords, Token, TokenKind } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParseError } from "../parser";
import { ActiveNode } from "./activeNode";
import { Position, PositionUtils } from "./position";

export interface AutocompleteInspected {
    readonly maybeRequiredAutocomplete: Option<string>;
    readonly allowedAutocompleteKeywords: ReadonlyArray<KeywordKind>;
}

export function tryFrom(
    maybeActiveNode: Option<ActiveNode>,
    maybeParseError: Option<ParseError.ParseError>,
): Result<AutocompleteInspected, CommonError.CommonError> {
    if (maybeActiveNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: ExpressionAutocomplete,
        };
    }

    const maybeParseErrorToken: Option<Token> = maybeParseError
        ? ParseError.maybeTokenFrom(maybeParseError.innerError)
        : undefined;
    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;
    let maybeInspected: Option<AutocompleteInspected>;

    try {
        for (let index: number = 1; index < numNodes; index += 1) {
            const child: NodeIdMap.TXorNode = ancestry[index - 1];
            const parent: NodeIdMap.TXorNode = ancestry[index];

            // If a node is in a context state then it should be up to the parent to autocomplete.
            // Continue to let a later iteration handle autocomplete.
            if (
                parent.kind === NodeIdMap.XorNodeKind.Context &&
                PositionUtils.isOnContextNodeStart(activeNode.position, parent.node)
            ) {
                continue;
            }

            switch (parent.node.kind) {
                case Ast.NodeKind.ErrorHandlingExpression:
                    maybeInspected = autocompleteErrorHandlingExpression(activeNode.position, child);
                    break;

                default:
                    const mapKey: string = createMapKey(parent.node.kind, child.node.maybeAttributeIndex);
                    maybeInspected = AutocompleteMap.get(mapKey);
                    break;
            }

            if (maybeInspected !== undefined) {
                break;
            }
        }
    } catch (err) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(err),
        };
    }

    let inspected: AutocompleteInspected = maybeInspected || EmptyAutocomplete;
    if (activeNode.maybeIdentifierUnderPosition && isInKeywordContext(activeNode)) {
        inspected = updateWithPostionIdentifier(inspected, activeNode);
    }

    if (maybeParseErrorToken !== undefined && maybeParseErrorToken.kind === TokenKind.Identifier) {
        inspected = updateWithParseErrorToken(inspected, activeNode, maybeParseErrorToken);
    }

    return {
        kind: ResultKind.Ok,
        value: inspected,
    };
}

const EmptyAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: [],
};

const ExpressionAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: TExpressionKeywords,
};

const AutocompleteMap: Map<string, AutocompleteInspected> = new Map([
    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.Error)],
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.GeneralizedIdentifierPairedExpression
    [createMapKey(Ast.NodeKind.GeneralizedIdentifierPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IdentifierPairedExpression
    [createMapKey(Ast.NodeKind.IdentifierPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IdentifierExpressionPairedExpression
    [createMapKey(Ast.NodeKind.IdentifierExpressionPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.If)],
    [createMapKey(Ast.NodeKind.IfExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.IfExpression, 2), autocompleteConstantFactory(Ast.ConstantKind.Then)],
    [createMapKey(Ast.NodeKind.IfExpression, 3), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.IfExpression, 4), autocompleteConstantFactory(Ast.ConstantKind.Else)],
    [createMapKey(Ast.NodeKind.IfExpression, 5), ExpressionAutocomplete],

    // Ast.NodeKind.InvokeExpression
    [createMapKey(Ast.NodeKind.InvokeExpression, 0), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.InvokeExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.InvokeExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.ListExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.Otherwise)],
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.ParenthesizedExpression
    [createMapKey(Ast.NodeKind.ParenthesizedExpression, 1), ExpressionAutocomplete],
]);

// key is the first letter of ActiveNode.maybeIdentifierUnderPosition.
// Does not contain joining keywords, such as 'as', 'and', etc.
// For some reason as of now Typescript needs explicit typing for Map initialization
const PartialKeywordAutocompleteMap: Map<string, ReadonlyArray<KeywordKind>> = new Map<
    string,
    ReadonlyArray<KeywordKind>
>([
    ["e", [KeywordKind.Each, KeywordKind.Error]],
    ["i", [KeywordKind.If]],
    ["l", [KeywordKind.Let]],
    ["n", [KeywordKind.Not]],
    ["t", [KeywordKind.True, KeywordKind.Try, KeywordKind.Type]],
]);

// key is the first letter of ParseError.maybeTokenFrom(maybeParseError.innerError) if it's an identifier.
// For some reason as of now Typescript needs explicit typing for Map initialization
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<KeywordKind>> = new Map<
    string,
    ReadonlyArray<KeywordKind>
>([["a", [KeywordKind.And, KeywordKind.As]], ["o", [KeywordKind.Or]], ["m", [KeywordKind.Meta]]]);

function updateWithPostionIdentifier(inspected: AutocompleteInspected, activeNode: ActiveNode): AutocompleteInspected {
    const key: string = activeNode.maybeIdentifierUnderPosition!.literal;
    const maybeAllowedKeywords: Option<ReadonlyArray<KeywordKind>> = PartialKeywordAutocompleteMap.get(
        key[0].toLocaleLowerCase(),
    );

    return maybeAllowedKeywords !== undefined
        ? updateWithIdentifierKey(inspected, key, maybeAllowedKeywords)
        : inspected;
}

function updateWithParseErrorToken(
    inspected: AutocompleteInspected,
    activeNode: ActiveNode,
    token: Token,
): AutocompleteInspected {
    const key: string = token.data;
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
    inspected: AutocompleteInspected,
    key: string,
    allowedKeywords: ReadonlyArray<KeywordKind>,
): AutocompleteInspected {
    const newAllowedAutocompleteKeywords: KeywordKind[] = [...inspected.allowedAutocompleteKeywords];
    for (const keyword of allowedKeywords) {
        if (
            // allowedKeywords is a map of 'first character' -> 'all possible keywords that start with the character',
            // meaning 'an' maps 'a' to '["and", "as"].
            // This check prevents 'an' adding "and" as well.
            keyword.indexOf(key) === 0 &&
            // Keyword isn't already in the list of allowed keywords.
            newAllowedAutocompleteKeywords.indexOf(keyword) === -1
        ) {
            newAllowedAutocompleteKeywords.push(keyword);
        }
    }

    return {
        ...inspected,
        allowedAutocompleteKeywords: newAllowedAutocompleteKeywords,
    };
}

function isInKeywordContext(activeNode: ActiveNode): boolean {
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    const maybePrevious: NodeIdMap.TXorNode = ancestry[1];
    if (maybePrevious === undefined) {
        return true;
    }
    // Possibly: InvokeExpression
    else if (maybePrevious.node.kind === Ast.NodeKind.IdentifierExpression) {
        if (
            isAncestryOfNodeKindChain(ancestry, 2, [
                Ast.NodeKind.Csv,
                Ast.NodeKind.ArrayWrapper,
                Ast.NodeKind.InvokeExpression,
            ])
        ) {
            return false;
        }
    }

    return true;
}

function isAncestryOfNodeKindChain(
    ancestry: ReadonlyArray<NodeIdMap.TXorNode>,
    start: number,
    chain: ReadonlyArray<Ast.NodeKind>,
): boolean {
    const ancestryLength: number = ancestry.length;
    if (start < 0) {
        const details: {} = {
            start,
            ancestryLength,
        };
        throw new CommonError.InvariantError("invalid start", details);
    } else if (start >= ancestryLength) {
        return false;
    }

    const chainLength: number = chain.length;
    for (let index: number = 0; index < chainLength; index += 1) {
        const maybeAncestor: Option<NodeIdMap.TXorNode> = ancestry[index + start];
        if (maybeAncestor === undefined) {
            return false;
        } else if (maybeAncestor.node.kind !== chain[index]) {
            return false;
        }
    }

    return true;
}

// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: Option<number>): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}

function autocompleteConstantFactory(constantKind: Ast.ConstantKind): AutocompleteInspected {
    return {
        maybeRequiredAutocomplete: constantKind,
        allowedAutocompleteKeywords: [],
    };
}

function autocompleteErrorHandlingExpression(
    position: Position,
    child: NodeIdMap.TXorNode,
): Option<AutocompleteInspected> {
    const maybeChildAttributeIndex: Option<number> = child.node.maybeAttributeIndex;
    if (maybeChildAttributeIndex === 0) {
        return autocompleteConstantFactory(Ast.ConstantKind.Try);
    } else if (maybeChildAttributeIndex === 1) {
        if (child.kind === NodeIdMap.XorNodeKind.Ast && PositionUtils.isAfterAstNode(position, child.node, false)) {
            return {
                allowedAutocompleteKeywords: [],
                maybeRequiredAutocomplete: KeywordKind.Otherwise,
            };
        } else {
            return ExpressionAutocomplete;
        }
    } else {
        return undefined;
    }
}
