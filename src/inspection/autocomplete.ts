// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { ResultUtils } from "../common/result";
import { KeywordKind, TExpressionKeywords, Token, TokenKind } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParseError, ParserContext } from "../parser";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { Position, PositionUtils } from "./position";

export type TriedAutocomplete = Result<AutocompleteInspected, CommonError.CommonError>;

export interface AutocompleteInspected {
    readonly maybeRequiredAutocomplete: Option<string>;
    readonly allowedAutocompleteKeywords: ReadonlyArray<KeywordKind>;
}

export function tryFrom(
    maybeActiveNode: Option<ActiveNode>,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseError: Option<ParseError.ParseError>,
): TriedAutocomplete {
    if (maybeActiveNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: ExpressionAutocomplete,
        };
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const leaf: NodeIdMap.TXorNode = activeNode.ancestry[0];
    const triedAutocomplete: TriedAutocomplete = tryAutocomplete(activeNode, nodeIdMapCollection, maybeParseError);

    if (ResultUtils.isErr(triedAutocomplete)) {
        return triedAutocomplete;
    }
    let autocomplete: AutocompleteInspected = triedAutocomplete.value;

    let maybePositionName: Option<string>;
    if (activeNode.maybeIdentifierUnderPosition !== undefined) {
        maybePositionName = activeNode.maybeIdentifierUnderPosition.literal;
    }
    // 'null', 'true', or 'false'.
    else if (
        leaf.kind === NodeIdMap.XorNodeKind.Ast &&
        leaf.node.kind === Ast.NodeKind.LiteralExpression &&
        (leaf.node.literalKind === Ast.LiteralKind.Logical || leaf.node.literalKind === Ast.LiteralKind.Null) &&
        PositionUtils.isInAstNode(activeNode.position, leaf.node, false, true)
    ) {
        maybePositionName = leaf.node.literal;
    }

    if (maybePositionName !== undefined) {
        const positionName: string = maybePositionName;
        const likelyKeywords: ReadonlyArray<KeywordKind> = autocomplete.allowedAutocompleteKeywords.filter(
            (kind: KeywordKind) => kind.startsWith(positionName),
        );
        autocomplete = {
            ...autocomplete,
            allowedAutocompleteKeywords: likelyKeywords,
        };
    }

    return ResultUtils.okFactory(autocomplete);

    // const maybeParseErrorToken: Option<Token> = maybeParseError
    //     ? ParseError.maybeTokenFrom(maybeParseError.innerError)
    //     : undefined;
    // const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    // const numNodes: number = ancestry.length;
    // let maybeInspected: Option<AutocompleteInspected>;

    // try {
    //     for (let index: number = 1; index < numNodes; index += 1) {
    //         const parent: NodeIdMap.TXorNode = ancestry[index];
    //         const child: NodeIdMap.TXorNode = ancestry[index - 1];

    //         // If a node is in a Context state then it should be up to the parent to autocomplete.
    //         // Continue to let a later iteration handle autocomplete.
    //         if (
    //             parent.kind === NodeIdMap.XorNodeKind.Context &&
    //             PositionUtils.isOnContextNodeStart(activeNode.position, parent.node)
    //         ) {
    //             continue;
    //         }

    //         switch (parent.node.kind) {
    //             case Ast.NodeKind.ErrorHandlingExpression:
    //                 maybeInspected = autocompleteErrorHandlingExpression(
    //                     activeNode.position,
    //                     child,
    //                     maybeParseErrorToken,
    //                 );
    //                 break;

    //             case Ast.NodeKind.SectionMember:
    //                 maybeInspected = autocompleteSectionMember(nodeIdMapCollection, activeNode, parent, child, index);
    //                 break;

    //             default:
    //                 const mapKey: string = createMapKey(parent.node.kind, child.node.maybeAttributeIndex);
    //                 maybeInspected = AutocompleteMap.get(mapKey);
    //                 break;
    //         }

    //         if (maybeInspected !== undefined) {
    //             break;
    //         }
    //     }
    // } catch (err) {
    //     return {
    //         kind: ResultKind.Err,
    //         error: CommonError.ensureCommonError(err),
    //     };
    // }

    // // Edge case for 'sect|'
    // const root: NodeIdMap.TXorNode = ancestry[ancestry.length - 1];
    // if (
    //     maybeInspected === undefined &&
    //     root.node.kind === Ast.NodeKind.IdentifierExpression &&
    //     PositionUtils.isInXorNode(activeNode.position, nodeIdMapCollection, root, false) &&
    //     KeywordKind.Section.startsWith((root.node as Ast.IdentifierExpression).identifier.literal)
    // ) {
    //     maybeInspected = {
    //         maybeRequiredAutocomplete: undefined,
    //         allowedAutocompleteKeywords: [KeywordKind.Section],
    //     };
    // }

    // // Naive autocomplete identifiers as keywords while in a keyword context.
    // let inspected: AutocompleteInspected = maybeInspected || EmptyAutocomplete;
    // if (activeNode.maybeIdentifierUnderPosition && isInKeywordContext(activeNode)) {
    //     inspected = updateWithPostionIdentifier(inspected, activeNode);
    // }

    // // Naive autocomplete a ParseError's token if it's an identifier.
    // if (
    //     maybeParseErrorToken !== undefined &&
    //     maybeParseErrorToken.kind === TokenKind.Identifier &&
    //     PositionUtils.isInToken(activeNode.position, maybeParseErrorToken, false) &&
    //     // Edge case for SectionExpression with a partial identifier match on 'section'
    //     // '[] s|'
    //     (maybeInspected === undefined || maybeInspected.allowedAutocompleteKeywords.indexOf(KeywordKind.Section) === -1)
    // ) {
    //     inspected = updateWithParseErrorToken(inspected, activeNode, maybeParseErrorToken);
    // }

    // return {
    //     kind: ResultKind.Ok,
    //     value: inspected,
    // };
}

function tryAutocomplete(
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseError: Option<ParseError.ParseError>,
): Result<AutocompleteInspected, CommonError.CommonError> {
    const triedInspected: Result<AutocompleteInspected, CommonError.CommonError> = traverseAncestors(
        activeNode,
        nodeIdMapCollection,
        maybeParseError,
    );
    if (ResultUtils.isErr(triedInspected)) {
        return triedInspected;
    }

    // Check if they're typing for the first time at the start of the file,
    // which defaults to searching for an identifier.
    if (
        maybeParseError === undefined &&
        activeNode.ancestry.length === 2 &&
        activeNode.ancestry[0].node.kind === Ast.NodeKind.Identifier &&
        activeNode.ancestry[1].node.kind === Ast.NodeKind.IdentifierExpression
    ) {
        return ResultUtils.okFactory(ExpressionAutocomplete);
    }

    if (ResultUtils.isErr(triedInspected)) {
        return triedInspected;
    }

    let inspected: AutocompleteInspected = triedInspected.value;
    const maybeParseErrorToken: Option<Token> = maybeParseError
        ? ParseError.maybeTokenFrom(maybeParseError.innerError)
        : undefined;

    if (
        maybeParseError !== undefined &&
        maybeParseErrorToken &&
        PositionUtils.isInToken(activeNode.position, maybeParseErrorToken, false, true)
    ) {
        inspected = updateWithParseErrorToken(inspected, activeNode, maybeParseErrorToken);
    }

    return ResultUtils.okFactory(inspected);
}

function traverseAncestors(
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeParseError: Option<ParseError.ParseError>,
): Result<AutocompleteInspected, CommonError.CommonError> {
    const maybeParseErrorToken: Option<Token> = maybeParseError
        ? ParseError.maybeTokenFrom(maybeParseError.innerError)
        : undefined;
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let maybeInspected: Option<AutocompleteInspected>;
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

                case Ast.NodeKind.SectionMember:
                    maybeInspected = autocompleteSectionMember(nodeIdMapCollection, activeNode, parent, child, index);
                    break;

                default:
                    const mapKey: string = createMapKey(parent.node.kind, child.node.maybeAttributeIndex);
                    maybeInspected = AutocompleteMap.get(mapKey);
                    break;
            }

            if (maybeInspected !== undefined) {
                return ResultUtils.okFactory(maybeInspected);
            }
        }
    } catch (err) {
        return ResultUtils.errFactory(CommonError.ensureCommonError(err));
    }

    return ResultUtils.okFactory(EmptyAutocomplete);
}

// const maybeParseErrorToken: Option<Token> = maybeParseError
//     ? ParseError.maybeTokenFrom(maybeParseError.innerError)
//     : undefined;
// const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
// const numNodes: number = ancestry.length;
// let maybeInspected: Option<AutocompleteInspected>;

// try {
//     for (let index: number = 1; index < numNodes; index += 1) {
//         const parent: NodeIdMap.TXorNode = ancestry[index];
//         const child: NodeIdMap.TXorNode = ancestry[index - 1];
//         // If a node is in a Context state then it should be up to the parent to autocomplete.
//         // Continue to let a later iteration handle autocomplete.
//         if (
//             parent.kind === NodeIdMap.XorNodeKind.Context &&
//             PositionUtils.isOnContextNodeStart(activeNode.position, parent.node)
//         ) {
//             continue;
//         }
//         switch (parent.node.kind) {
//             case Ast.NodeKind.ErrorHandlingExpression:
//                 maybeInspected = autocompleteErrorHandlingExpression(
//                     activeNode.position,
//                     child,
//                     maybeParseErrorToken,
//                 );
//                 break;
//             case Ast.NodeKind.SectionMember:
//                 maybeInspected = autocompleteSectionMember(nodeIdMapCollection, activeNode, parent, child, index);
//                 break;
//             default:
//                 const mapKey: string = createMapKey(parent.node.kind, child.node.maybeAttributeIndex);
//                 maybeInspected = AutocompleteMap.get(mapKey);
//                 break;
//         }
//         if (maybeInspected !== undefined) {
//             break;
//         }
//     }
// } catch (err) {
//     return {
//         kind: ResultKind.Err,
//         error: CommonError.ensureCommonError(err),
//     };
// }

// const inspected: AutocompleteInspected = maybeInspected || EmptyAutocomplete;

// // // Edge case for 'sect|'
// // const root: NodeIdMap.TXorNode = ancestry[ancestry.length - 1];
// // if (
// //     maybeInspected === undefined &&
// //     root.node.kind === Ast.NodeKind.IdentifierExpression &&
// //     PositionUtils.isInXorNode(activeNode.position, nodeIdMapCollection, root, false) &&
// //     KeywordKind.Section.startsWith((root.node as Ast.IdentifierExpression).identifier.literal)
// // ) {
// //     maybeInspected = {
// //         maybeRequiredAutocomplete: undefined,
// //         allowedAutocompleteKeywords: [KeywordKind.Section],
// //     };
// // }
// // // Naive autocomplete identifiers as keywords while in a keyword context.
// // let inspected: AutocompleteInspected = maybeInspected || EmptyAutocomplete;
// // if (activeNode.maybeIdentifierUnderPosition && isInKeywordContext(activeNode)) {
// //     inspected = updateWithPostionIdentifier(inspected, activeNode);
// // }
// // // Naive autocomplete a ParseError's token if it's an identifier.
// // if (
// //     maybeParseErrorToken !== undefined &&
// //     maybeParseErrorToken.kind === TokenKind.Identifier &&
// //     PositionUtils.isInToken(activeNode.position, maybeParseErrorToken, false) &&
// //     // Edge case for SectionExpression with a partial identifier match on 'section'
// //     // '[] s|'
// //     (maybeInspected === undefined || maybeInspected.allowedAutocompleteKeywords.indexOf(KeywordKind.Section) === -1)
// // ) {
// //     inspected = updateWithParseErrorToken(inspected, activeNode, maybeParseErrorToken);
// // }
// return {
//     kind: ResultKind.Ok,
//     value: inspected,
// };

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
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), autocompleteRequiredFactory(Ast.ConstantKind.Error)],
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.GeneralizedIdentifierPairedExpression
    [createMapKey(Ast.NodeKind.GeneralizedIdentifierPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IdentifierPairedExpression
    [createMapKey(Ast.NodeKind.IdentifierPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IdentifierExpressionPairedExpression
    [createMapKey(Ast.NodeKind.IdentifierExpressionPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), autocompleteRequiredFactory(Ast.ConstantKind.If)],
    [createMapKey(Ast.NodeKind.IfExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.IfExpression, 2), autocompleteRequiredFactory(Ast.ConstantKind.Then)],
    [createMapKey(Ast.NodeKind.IfExpression, 3), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.IfExpression, 4), autocompleteRequiredFactory(Ast.ConstantKind.Else)],
    [createMapKey(Ast.NodeKind.IfExpression, 5), ExpressionAutocomplete],

    // Ast.NodeKind.InvokeExpression
    [createMapKey(Ast.NodeKind.InvokeExpression, 0), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.InvokeExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.InvokeExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.ListExpression
    [createMapKey(Ast.NodeKind.ListExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 0), autocompleteRequiredFactory(Ast.ConstantKind.Otherwise)],
    [createMapKey(Ast.NodeKind.OtherwiseExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.ParenthesizedExpression
    [createMapKey(Ast.NodeKind.ParenthesizedExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.Section
    [
        createMapKey(Ast.NodeKind.Section, 1),
        {
            maybeRequiredAutocomplete: undefined,
            allowedAutocompleteKeywords: [KeywordKind.Section],
        },
    ],
]);

// key is the first letter of ActiveNode.maybeIdentifierUnderPosition.
// Does not contain joining keywords, such as 'as', 'and', etc.
// For some reason as of now Typescript needs explicit typing for Map initialization.
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
// For some reason as of now Typescript needs explicit typing for Map initialization.
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<KeywordKind>> = new Map<
    string,
    ReadonlyArray<KeywordKind>
>([["a", [KeywordKind.And, KeywordKind.As]], ["o", [KeywordKind.Or]], ["m", [KeywordKind.Meta]]]);

function updateWithParseErrorToken(
    inspected: AutocompleteInspected,
    activeNode: ActiveNode,
    parseErrorToken: Token,
): AutocompleteInspected {
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
            keyword.startsWith(key) &&
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

function isInExpressionContext(activeNode: ActiveNode): boolean {
    return true;
}

function isInKeywordContext(activeNode: ActiveNode): boolean {
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    const maybePrevious: Option<NodeIdMap.TXorNode> = ancestry[1];
    if (maybePrevious === undefined) {
        return true;
    }

    // Possibly: InvokeExpression
    if (maybePrevious.node.kind === Ast.NodeKind.IdentifierExpression) {
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

function autocompleteRequiredFactory(constantKind: Ast.ConstantKind): AutocompleteInspected {
    return {
        maybeRequiredAutocomplete: constantKind,
        allowedAutocompleteKeywords: [],
    };
}

function autocompleteErrorHandlingExpression(
    position: Position,
    child: NodeIdMap.TXorNode,
    maybeErrorToken: Option<Token>,
): Option<AutocompleteInspected> {
    const maybeChildAttributeIndex: Option<number> = child.node.maybeAttributeIndex;
    if (maybeChildAttributeIndex === 0) {
        return autocompleteRequiredFactory(Ast.ConstantKind.Try);
    } else if (maybeChildAttributeIndex === 1) {
        // 'try true o|' creates a ParseError.
        // It's ambigous if the next token should be either 'otherwise' or 'or'.
        if (maybeErrorToken !== undefined) {
            const errorToken: Token = maybeErrorToken;

            // First we test if we can autocomplete using the error token.
            if (
                errorToken.kind === TokenKind.Identifier &&
                PositionUtils.isInToken(position, maybeErrorToken, false, true)
            ) {
                const tokenData: string = maybeErrorToken.data;

                // If we can exclude 'or' then the only thing we can autocomplete is 'otherwise'.
                if (tokenData.length > 1 && KeywordKind.Otherwise.startsWith(tokenData)) {
                    return {
                        allowedAutocompleteKeywords: [],
                        maybeRequiredAutocomplete: KeywordKind.Otherwise,
                    };
                }
                // In the ambigous case we don't know what they're typing yet, so we suggest both.
                // In the case of an identifier that doesn't match a 'or' or 'otherwise'
                // we still suggest the only valid keywords allowed.
                // In both cases the return is the same.
                else {
                    return {
                        allowedAutocompleteKeywords: [KeywordKind.Or, KeywordKind.Otherwise],
                        maybeRequiredAutocomplete: undefined,
                    };
                }
            }

            // There exists an error token we can't map it to an OtherwiseExpression.
            else {
                return undefined;
            }
        } else if (
            child.kind === NodeIdMap.XorNodeKind.Ast &&
            PositionUtils.isAfterAstNode(position, child.node, false)
        ) {
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

function autocompleteSectionMember(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    parent: NodeIdMap.TXorNode,
    child: NodeIdMap.TXorNode,
    ancestorIndex: number,
): Option<AutocompleteInspected> {
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
                    return {
                        maybeRequiredAutocomplete: undefined,
                        allowedAutocompleteKeywords: [KeywordKind.Shared],
                    };
                }
            } else {
                return undefined;
            }
        }
    }

    return undefined;
}
