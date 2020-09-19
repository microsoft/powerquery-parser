// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils, ArrayUtils, Assert } from "../../common";
import { Ast, Type, Token } from "../../language";
import {
    NodeIdMap,
    NodeIdMapUtils,
    ParseError,
    TXorNode,
    XorNodeKind,
    ParseContext,
    XorNodeUtils,
    IParserState,
} from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";
import { PositionUtils } from "../position";
import { LexerSnapshot } from "../../lexer";
import { SequenceKind } from "../../parser/error";

export type TriedAutocompleteFieldSelection = Result<ReadonlyArray<string>, CommonError.CommonError>;

// export function autocompleteFieldSelection(
//     settings: CommonSettings,
//     lexerSnapshot: LexerSnapshot,
//     nodeIdMapCollection: NodeIdMap.Collection,
//     leafNodeIds: ReadonlyArray<number>,
//     activeNode: ActiveNode,
//     typeCache: TypeCache,
//     maybeParseError: ParseError.ParseError | undefined,
// ): ReadonlyArray<string> {
//     const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
//     let maybeInspectableNode: TXorNode;

//     // Check if a RPE exists in the context state.
//     const indexOfRecursivePrimaryExpression: number = ArrayUtils.indexOfPredicate(
//         ancestry,
//         (xorNode: TXorNode) => xorNode.node.kind === Ast.NodeKind.RecursivePrimaryExpression,
//     );
//     if (indexOfRecursivePrimaryExpression === -1) {
//         return [];
//     }
//     const recursivePrimaryExpression: TXorNode = ancestry[indexOfRecursivePrimaryExpression];

//     // `let x = [a=1] in x[|`
//     // An unclosed bracket causes a UnterminatedBracketError to be thrown,
//     // which also means we're dealing with a context state.

//     if (XorNodeUtils.isAst(recursivePrimaryExpression)) {
//         const earlierNode: TXorNode = ancestry[indexOfRecursivePrimaryExpression - 1];

//         // Ancestry travels through ArrayWrapper.
//         // Inspectable might either be the head or a previous sibling.
//         if (earlierNode.node.kind === Ast.NodeKind.ArrayWrapper) {
//             // Under an Ast, autocomplete only should be provided for a field selectors,
//             // and if it's either before or on the identifier.
//             const indexOfFieldSelector: number = ArrayUtils.indexOfPredicate(
//                 ancestry,
//                 (xorNode: TXorNode) => xorNode.node.kind === Ast.NodeKind.FieldSelector,
//             );
//             if (indexOfFieldSelector !== -1) {
//                 const fieldSelector: Ast.FieldSelector = ancestry[indexOfFieldSelector].node as Ast.FieldSelector;
//                 if (
//                     PositionUtils.isInAst(activeNode.position, fieldSelector.content, false, true) ||
//                     (PositionUtils.isAfterAst(activeNode.position, fieldSelector.openWrapperConstant, false) &&
//                         PositionUtils.isBeforeAst(activeNode.position, fieldSelector.content, false))
//                 ) {
//                     maybeInspectableNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
//                         nodeIdMapCollection,
//                         fieldSelector.id,
//                     );
//                 }
//             }
//         } else {
//             maybeInspectableNode = XorNodeUtils.astFactory(
//                 (recursivePrimaryExpression.node as Ast.RecursivePrimaryExpression).head,
//             );
//         }
//     } else if (
//         maybeParseError !== undefined &&
//         maybeParseError.innerError instanceof ParseError.UnterminatedBracketError &&
//         PositionUtils.isAfterTokenPosition(
//             activeNode.position,
//             maybeParseError.innerError.openBracketToken.positionStart,
//             true,
//         )
//     ) {
//         const indexOfArrayWrapper: number = ArrayUtils.indexOfPredicate(
//             ancestry,
//             (xorNode: TXorNode) => xorNode.node.kind === Ast.NodeKind.ArrayWrapper,
//         );
//         // Edge case for `x[|`, grab RPE.head
//         if (indexOfArrayWrapper === 0) {
//             maybeInspectableNode = NodeIdMapUtils.assertGetChildXorByAttributeIndex(
//                 nodeIdMapCollection,
//                 recursivePrimaryExpression.node.id,
//                 0,
//                 undefined,
//             );
//         } else {
//             // RPE -> ArrayWrapper -> TPrimaryExpression
//             maybeInspectableNode = ancestry[indexOfRecursivePrimaryExpression - 2];
//         }
//     }

//     return [];
//     // // An unclosed bracket leads to an UnterminatedBracketError error.
//     // // We shouldn't care about the scenario of autocompleting field names if
//     // if (
//     //     !(parseError.innerError instanceof ParseError.UnterminatedBracketError) ||
//     //     PositionUtils.isAfterTokenPosition(
//     //         activeNode.position,
//     //         parseError.innerError.openBracketToken.positionStart,
//     //         true,
//     //     )
//     // ) {
//     //     return [];
//     // }
//     // const parseErrorToken: Token.Token = parseError.innerError.openBracketToken;

//     // const indexOfRecursivePrimaryExpression: number = ArrayUtils.indexOfPredicate(
//     //     activeNode.ancestry,
//     //     (xorNode: TXorNode) => xorNode.node.kind === Ast.NodeKind.RecursivePrimaryExpression,
//     // );
//     // if (indexOfRecursivePrimaryExpression === -1) {
//     //     return [];
//     // }

//     // const recursivePrimaryExpression: TXorNode = activeNode.ancestry[indexOfRecursivePrimaryExpression];

//     // // Case 1: RPE is an Ast node.
//     // //  If there is a parse error, and it's on or before ActiveNode.position,
//     // //  then autocomplete.
//     // //  Else do nothing.
//     // if (recursivePrimaryExpression.kind === XorNodeKind.Ast) {
//     //     throw new Error();
//     // } else {
//     // }

//     // // Case 2: RPE is a context node.
//     // //  If the following are true:
//     // //      There is a parse error,
//     // //      and the parse error is on or before ActiveNode.position,
//     // //      and the previous node is either a record or table.

//     // // const maybeSelector: TXorNode | undefined = maybeThingy(nodeIdMapCollection, activeNode, maybeParseError);
//     // // if (maybeSelector === undefined) {
//     // //     return [];
//     // // }
//     // // const fieldSelector: TXorNode = maybeSelector;

//     // // const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
//     // //     nodeIdMapCollection,
//     // //     fieldSelector.node.id,
//     // // );

//     // // const triedType: TriedType = tryType(
//     // //     settings,
//     // //     nodeIdMapCollection,
//     // //     leafNodeIds,
//     // //     previousSibling.node.id,
//     // //     typeCache,
//     // // );
//     // // if (ResultUtils.isErr(triedType)) {
//     // //     throw triedType.error;
//     // // }
//     // // const type: Type.TType = triedType.value;

//     // // if (
//     // //     !(type.kind === Type.TypeKind.Record && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedRecord) &&
//     // //     !(type.kind === Type.TypeKind.Table && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedTable)
//     // // ) {
//     // //     return [];
//     // // }

//     // // return [...type.fields.keys()];
// }

type AutocompleteNodeKind =
    | Ast.NodeKind.FieldSelector
    | Ast.NodeKind.FieldProjection
    | Ast.NodeKind.ItemAccessExpression;

export function autocompleteField<S extends IParserState = IParserState>(
    settings: CommonSettings,
    parserState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
    maybeParseError: ParseError.ParseError | undefined,
): ReadonlyArray<string> {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    let maybeAutocompleteKind: AutocompleteNodeKind | undefined;
    if (maybeParseError !== undefined) {
        const innerParseError: ParseError.TInnerParseError = maybeParseError.innerError;
        if (innerParseError instanceof ParseError.UnterminatedSequence) {
            const unterminatedSequence: ParseError.UnterminatedSequence = innerParseError;
            switch (unterminatedSequence.kind) {
                case SequenceKind.Bracket:
                    break;

                case SequenceKind.Parenthesis:
                    break;

                default:
                    throw Assert.isNever(unterminatedSequence.kind);
            }
        } else if (
            innerParseError instanceof ParseError.ExpectedAnyTokenKindError &&
            innerParseError.maybeFoundToken?.token.kind === Token.TokenKind.LeftBrace
        ) {
        }
    }

    return [];

    // // Check if a RPE exists in the context state.
    // const indexOfRecursivePrimaryExpression: number = ArrayUtils.indexOfPredicate(
    //     ancestry,
    //     (xorNode: TXorNode) => xorNode.node.kind === Ast.NodeKind.RecursivePrimaryExpression,
    // );
    // if (indexOfRecursivePrimaryExpression === -1) {
    //     return [];
    // }
    // const recursivePrimaryExpression: TXorNode = ancestry[indexOfRecursivePrimaryExpression];

    // const indexOfField: number = ArrayUtils.indexOfPredicate(ancestry, (xorNode: TXorNode) => {
    //     const astNodeKind: Ast.NodeKind = xorNode.node.kind;
    //     return (
    //         astNodeKind === Ast.NodeKind.FieldProjection ||
    //         astNodeKind === Ast.NodeKind.FieldSelector ||
    //         astNodeKind === Ast.NodeKind.ItemAccessExpression
    //     );
    // });

    // // No field currently exists, but we might be able to get something out of the ParseError
    // if (indexOfField === 0) {
    //     if (maybeParseError === undefined || !(maybeParseError.innerError instanceof ParseError.UnterminatedSequence)) {
    //         return [];
    //     }

    //     const unterminatedSequence: ParseError.UnterminatedSequence = maybeParseError.innerError;
    //     switch (unterminatedSequence.kind) {
    //         case SequenceKind.Bracket:

    //             break;

    //         case SequenceKind.Parenthesis:
    //             break;

    //         default:
    //             throw Assert.isNever(unterminatedSequence.kind);
    //     }
    // }

    // return [];
}

// function maybePreviousPrimaryExpression(): TXorNode | undefined {

// }
