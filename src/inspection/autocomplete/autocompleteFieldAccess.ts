// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ResultUtils } from "../../common";
import { Ast, Token, Type } from "../../language";
import { getLocalizationTemplates } from "../../localization";
import { IParser, IParserState, NodeIdMap, NodeIdMapUtils, ParseError, TXorNode, XorNodeUtils } from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";
import {
    AutocompleteFieldAccess,
    AutocompleteItem,
    IParseFieldAccessErr,
    IParseFieldAccessOk,
    ParseFieldProjectionErr,
    ParseFieldProjectionOk,
    ParseFieldSelectionErr,
    ParseFieldSelectionOk,
    TParseFieldAccess,
    TriedAutocompleteFieldAccess,
} from "./commonTypes";

export function tryAutocompleteFieldAccess<S extends IParserState = IParserState>(
    parseSettings: ParseSettings,
    parserState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
    maybeParseError: ParseError.ParseError | undefined,
): TriedAutocompleteFieldAccess {
    return ResultUtils.ensureResult(getLocalizationTemplates(parseSettings.locale), () => {
        return autocompleteFieldAccess(parseSettings, parserState, activeNode, typeCache, maybeParseError);
    });
}

const AllowedTrailingOpenWrapperConstants: ReadonlyArray<Token.TokenKind> = [
    Token.TokenKind.LeftBrace,
    Token.TokenKind.LeftBracket,
];

function autocompleteFieldAccess<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
    maybeParseError: ParseError.ParseError | undefined,
): AutocompleteFieldAccess | undefined {
    let hasTrailingOpenConstant: boolean;
    if (maybeParseError !== undefined) {
        const maybeTrailingToken: Token.Token | undefined = ParseError.maybeTokenFrom(maybeParseError.innerError);
        hasTrailingOpenConstant =
            maybeTrailingToken !== undefined &&
            AllowedTrailingOpenWrapperConstants.includes(maybeTrailingToken.kind) &&
            PositionUtils.isAfterTokenPosition(activeNode.position, maybeTrailingToken.positionStart, true);
    } else {
        hasTrailingOpenConstant = false;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;

    const maybeInspectable: TXorNode | undefined = maybeInspectablePrimaryExpression(
        nodeIdMapCollection,
        activeNode,
        hasTrailingOpenConstant,
    );
    if (maybeInspectable === undefined) {
        return undefined;
    }
    const inspectable: TXorNode = maybeInspectable;

    const maybeFieldAccessParse: TParseFieldAccess | undefined = maybeFieldAccessFromParse<S>(
        parseSettings,
        parserState,
    );
    if (maybeFieldAccessParse === undefined) {
        return undefined;
    }
    const fieldAccessParse: TParseFieldAccess = maybeFieldAccessParse;

    const triedInspectableType: TriedType = tryType(
        parseSettings,
        nodeIdMapCollection,
        parserState.contextState.leafNodeIds,
        inspectable.node.id,
        typeCache,
    );
    if (ResultUtils.isErr(triedInspectableType)) {
        throw triedInspectableType.error;
    }
    const inspectableType: Type.TType = triedInspectableType.value;

    if (
        inspectableType.maybeExtendedKind !== Type.ExtendedTypeKind.DefinedRecord &&
        inspectableType.maybeExtendedKind !== Type.ExtendedTypeKind.DefinedTable
    ) {
        return undefined;
    }

    return {
        field: inspectable,
        fieldType: inspectableType,
        fieldAccessParse,
        autocompleteItems: autoCompleteItemsFactory(activeNode, inspectableType),
    };
}

function autoCompleteItemsFactory(
    activeNode: ActiveNode,
    inspectableType: Type.DefinedRecord | Type.DefinedTable,
): ReadonlyArray<AutocompleteItem> {
    let possibleAutocompleteItems: AutocompleteItem[] = [];
    for (const [key, type] of inspectableType.fields.entries()) {
        possibleAutocompleteItems.push({
            key,
            type,
        });
    }

    // switch (fieldAccess.kind) {
    //     case FieldAccessKind.Selection:
    //         break;

    //     case FieldAccessKind.Projection:
    //         break;

    //     default:
    //         throw Assert.shouldNeverBeReachedTypescript();
    // }

    if (activeNode.maybeIdentifierUnderPosition !== undefined) {
        const positionIdentifierLiteral: string | undefined = activeNode.maybeIdentifierUnderPosition.literal;
        possibleAutocompleteItems = possibleAutocompleteItems.filter((autocompleteItem: AutocompleteItem) =>
            positionIdentifierLiteral.startsWith(autocompleteItem.key),
        );
    }

    return possibleAutocompleteItems;
}

function maybeInspectablePrimaryExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    hasTrailingOpenConstant: boolean,
): TXorNode | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    let maybeContiguousPrimaryExpression: TXorNode | undefined;
    let matchingContiguousPrimaryExpression: boolean = true;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        if (xorNode.node.kind === Ast.NodeKind.RecursivePrimaryExpression) {
            // The previous ancestor must be an attribute of Rpe, which is either its head or ArrrayWrapper.
            const xorNodeBeforeRpe: TXorNode = ancestry[index - 1];

            // If the previous ancestor is the head.
            if (xorNodeBeforeRpe.node.maybeAttributeIndex === 0) {
                // Only valid if there's a trailing bracket, Eg. `foo[|`
                if (hasTrailingOpenConstant === true) {
                    // Return Rpe.head.
                    return xorNodeBeforeRpe;
                }

                // There's nothing we can do.
                else {
                    break;
                }
            }
            // Else the previous ancestor is Rpe.recursiveExpressions (ArrayWrapper).
            else {
                const maybeChildrenForArrayWrapper:
                    | ReadonlyArray<number>
                    | undefined = nodeIdMapCollection.childIdsById.get(xorNodeBeforeRpe.node.id);

                // If the ArrayWrapper has no children.
                if (maybeChildrenForArrayWrapper === undefined) {
                    // If there's a trailing bracket we can return the head, else nothing.
                    // Eg. `foo[|`
                    return hasTrailingOpenConstant === false
                        ? undefined
                        : NodeIdMapUtils.assertGetChildXorByAttributeIndex(
                              nodeIdMapCollection,
                              xorNode.node.id,
                              0,
                              undefined,
                          );
                }

                // Else grab the last.
                else {
                    const numChildren: number = maybeChildrenForArrayWrapper.length;
                    const inspectableIndex: number = numChildren - 1;
                    return NodeIdMapUtils.assertGetChildXorByAttributeIndex(
                        nodeIdMapCollection,
                        xorNodeBeforeRpe.node.id,
                        inspectableIndex,
                        undefined,
                    );
                }
            }
        } else if (matchingContiguousPrimaryExpression && XorNodeUtils.isTPrimaryExpression(xorNode)) {
            maybeContiguousPrimaryExpression = xorNode;
        } else {
            matchingContiguousPrimaryExpression = false;
        }
    }

    return maybeContiguousPrimaryExpression;
}

function maybeFieldAccessFromParse<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): TParseFieldAccess | undefined {
    const parseFns: ReadonlyArray<(parseSettings: ParseSettings<S>, parserState: S) => TParseFieldAccess> = [
        parseFieldProjection,
        parseFieldSelection,
    ];

    let maybeBestMatch: TParseFieldAccess | undefined;
    for (const fn of parseFns) {
        const attempt: TParseFieldAccess = fn(parseSettings, parserState);
        maybeBestMatch = betterFieldAccessMatch(maybeBestMatch, attempt);
    }

    return maybeBestMatch;
}

function parseFieldProjection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): ParseFieldProjectionOk | ParseFieldProjectionErr {
    return tryParseFieldAccess<Ast.FieldProjection, Ast.NodeKind.FieldProjection, S>(
        parseSettings,
        parserState,
        parseSettings.parser.readFieldProjection,
        Ast.NodeKind.FieldProjection,
    );
}

function parseFieldSelection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): ParseFieldSelectionOk | ParseFieldSelectionErr {
    return tryParseFieldAccess<Ast.FieldSelector, Ast.NodeKind.FieldSelector, S>(
        parseSettings,
        parserState,
        parseSettings.parser.readFieldSelection,
        Ast.NodeKind.FieldSelector,
    );
}

function tryParseFieldAccess<
    T extends Ast.FieldProjection | Ast.FieldSelector,
    K extends Ast.NodeKind.FieldSelector | Ast.NodeKind.FieldProjection,
    S extends IParserState = IParserState
>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    parseFn: (state: S, parser: IParser<S>) => T,
    nodeKind: K,
): IParseFieldAccessOk<T, K> | IParseFieldAccessErr<K, S> {
    const newState: S = parseSettings.parserStateFactory(
        parserState.maybeCancellationToken,
        parserState.lexerSnapshot,
        parserState.tokenIndex,
        parseSettings.locale,
    );

    try {
        const ast: T = parseFn(newState, parseSettings.parser);
        return {
            hasError: false,
            nodeKind,
            ast,
            parserState: newState,
        };
    } catch (error) {
        if (CommonError.isTInnerCommonError(error)) {
            throw error;
        } else if (!ParseError.isTInnerParseError(error)) {
            throw new CommonError.InvariantError(`unknown error was thrown`, { error });
        }
        const innerParseError: ParseError.TInnerParseError = error;

        return {
            hasError: true,
            nodeKind,
            parseError: new ParseError.ParseError(innerParseError, newState),
        };
    }
}

function betterFieldAccessMatch(
    maybeCurrentBest: TParseFieldAccess | undefined,
    newAccess: TParseFieldAccess,
): TParseFieldAccess {
    if (maybeCurrentBest === undefined) {
        return newAccess;
    } else if (tokenIndexFromTriedParseFieldAccess(newAccess) > tokenIndexFromTriedParseFieldAccess(maybeCurrentBest)) {
        return newAccess;
    } else {
        return maybeCurrentBest;
    }
}

function tokenIndexFromTriedParseFieldAccess(triedParseFieldAccess: TParseFieldAccess): number {
    if (triedParseFieldAccess.hasError === true) {
        return triedParseFieldAccess.parseError.state.tokenIndex;
    } else {
        return triedParseFieldAccess.parserState.tokenIndex;
    }
}
