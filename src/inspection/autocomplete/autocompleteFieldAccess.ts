// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ResultUtils } from "../../common";
import { Ast, Token, Type } from "../../language";
import { getLocalizationTemplates } from "../../localization";
import {
    IParser,
    IParserState,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    ParseContext,
    ParseError,
    TXorNode,
    XorNodeUtils,
} from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";
import {
    AutocompleteFieldAccess,
    AutocompleteItem,
    IParsedFieldAccessErr,
    IParsedFieldAccessOk,
    ParsedFieldProjectionErr,
    ParsedFieldProjectionOk,
    ParsedFieldSelectionErr,
    ParsedFieldSelectionOk,
    TParsedFieldAccess,
    TriedAutocompleteFieldAccess,
} from "./commonTypes";

export function tryAutocompleteFieldAccess<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
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

    const maybeParsedFieldAccess: TParsedFieldAccess | undefined = maybeParseFieldAccessFromParse<S>(
        parseSettings,
        parserState,
    );
    if (maybeParsedFieldAccess === undefined) {
        return undefined;
    }
    const parsedFieldAccess: TParsedFieldAccess = maybeParsedFieldAccess;

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
        parsedFieldAccess,
        autocompleteItems: autoCompleteItemsFactory(nodeIdMapCollection, inspectableType, parsedFieldAccess),
    };
}

function autoCompleteItemsFactory(
    nodeIdMapCollection: NodeIdMap.Collection,
    inspectableType: Type.DefinedRecord | Type.DefinedTable,
    parsedFieldAccess: TParsedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    const existingNames: ReadonlyArray<string> = parsedFieldAccessNames(nodeIdMapCollection, parsedFieldAccess);

    const possibleAutocompleteItems: AutocompleteItem[] = [];
    for (const [key, type] of inspectableType.fields.entries()) {
        if (existingNames.includes(key) === false) {
            possibleAutocompleteItems.push({
                key,
                type,
            });
        }
    }

    return possibleAutocompleteItems;
}

function parsedFieldAccessNames(
    nodeIdMapCollection: NodeIdMap.Collection,
    parsedFieldAccess: TParsedFieldAccess,
): ReadonlyArray<string> {
    if (parsedFieldAccess.hasError === true) {
        const maybeRoot: ParseContext.Node | undefined = parsedFieldAccess.parseError.state.contextState.maybeRoot;
        Assert.isDefined(maybeRoot);
        const rootAsXorNode: TXorNode = XorNodeUtils.contextFactory(maybeRoot);

        switch (parsedFieldAccess.nodeKind) {
            case Ast.NodeKind.FieldProjection:
                return NodeIdMapIterator.iterFieldProjectionNames(nodeIdMapCollection, rootAsXorNode);

            case Ast.NodeKind.FieldSelector: {
                const maybeGeneralizedIdentifier: Ast.TNode | undefined = NodeIdMapUtils.maybeWrappedContentAst(
                    nodeIdMapCollection,
                    rootAsXorNode,
                    Ast.NodeKind.GeneralizedIdentifier,
                );

                if (maybeGeneralizedIdentifier !== undefined) {
                    const generalizedIdentifier: Ast.GeneralizedIdentifier = maybeGeneralizedIdentifier as Ast.GeneralizedIdentifier;
                    return [generalizedIdentifier.literal];
                } else {
                    return [];
                }
            }

            default:
                throw Assert.isNever(parsedFieldAccess);
        }
    } else {
        switch (parsedFieldAccess.nodeKind) {
            case Ast.NodeKind.FieldProjection:
                return parsedFieldAccess.ast.content.elements.map(
                    (csv: Ast.ICsv<Ast.FieldSelector>) => csv.node.content.literal,
                );

            case Ast.NodeKind.FieldSelector:
                return [parsedFieldAccess.ast.content.literal];

            default:
                throw Assert.isNever(parsedFieldAccess);
        }
    }
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

function maybeParseFieldAccessFromParse<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): TParsedFieldAccess | undefined {
    const parseFns: ReadonlyArray<(parseSettings: ParseSettings<S>, parserState: S) => TParsedFieldAccess> = [
        parseFieldProjection,
        parseFieldSelection,
    ];

    let maybeBestMatch: TParsedFieldAccess | undefined;
    for (const fn of parseFns) {
        const attempt: TParsedFieldAccess = fn(parseSettings, parserState);
        maybeBestMatch = betterFieldAccessMatch(maybeBestMatch, attempt);
    }

    return maybeBestMatch;
}

function parseFieldProjection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): ParsedFieldProjectionOk | ParsedFieldProjectionErr {
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
): ParsedFieldSelectionOk | ParsedFieldSelectionErr {
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
): IParsedFieldAccessOk<T, K> | IParsedFieldAccessErr<K, S> {
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
    maybeCurrentBest: TParsedFieldAccess | undefined,
    newAccess: TParsedFieldAccess,
): TParsedFieldAccess {
    if (maybeCurrentBest === undefined) {
        return newAccess;
    } else if (tokenIndexFromTriedParseFieldAccess(newAccess) > tokenIndexFromTriedParseFieldAccess(maybeCurrentBest)) {
        return newAccess;
    } else {
        return maybeCurrentBest;
    }
}

function tokenIndexFromTriedParseFieldAccess(triedParseFieldAccess: TParsedFieldAccess): number {
    if (triedParseFieldAccess.hasError === true) {
        return triedParseFieldAccess.parseError.state.tokenIndex;
    } else {
        return triedParseFieldAccess.parserState.tokenIndex;
    }
}
