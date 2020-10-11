// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultKind, ResultUtils } from "../../common";
import { Ast, Token, Type } from "../../language";
import { getLocalizationTemplates } from "../../localization";
import {
    IParser,
    IParserState,
    NodeIdMap,
    NodeIdMapUtils,
    ParseContextUtils,
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
    FieldAccessKind,
    TriedAutocompleteFieldAccess,
    TriedParseFieldProjection,
    TriedParseFieldSelection,
    TTriedParseFieldAccess,
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

    const maybeFieldAccess: FieldAccessParse | undefined = maybeFieldAccessFromParse(parserState);
    if (maybeFieldAccess === undefined) {
        return undefined;
    }
    const fieldAccess: FieldAccessParse = maybeFieldAccess;

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
        fieldAccessParse: fieldAccess,
        autocompleteItems: autoCompleteItemsFactory(nodeIdMapCollection, activeNode, inspectableType, fieldAccess),
    };
}

const AllowedTrailingOpenWrapperConstants: ReadonlyArray<Token.TokenKind> = [
    Token.TokenKind.LeftBrace,
    Token.TokenKind.LeftBracket,
];

function autoCompleteItemsFactory(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    inspectableType: Type.DefinedRecord | Type.DefinedTable,
    fieldAccess: FieldAccessParse,
): ReadonlyArray<AutocompleteItem> {
    let possibleAutocompleteItems: AutocompleteItem[] = [];
    for (const [key, type] of inspectableType.fields.entries()) {
        possibleAutocompleteItems.push({
            key,
            type,
        });
    }

    switch (fieldAccess.kind) {
        case FieldAccessKind.Selection:
            break;

        case FieldAccessKind.Projection:
            break;

        default:
            throw Assert.shouldNeverBeReachedTypescript();
    }

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

type TriedParseFieldAccess<
    T extends Ast.FieldSelector | Ast.FieldProjection,
    S extends IParserState = IParserState
> = Result<TriedParseFieldAccessOk<T, S>, ParseError.ParseError<S>>;

interface TriedParseFieldAccessOk<
    T extends Ast.FieldSelector | Ast.FieldProjection,
    S extends IParserState = IParserState
> {
    readonly ast: T;
    readonly parserState: S;
}

function maybeFieldAccessFromParse<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): TTriedParseFieldAccess | undefined {
    const parseFns: ReadonlyArray<(parseSettings: ParseSettings<S>, parserState: S) => TTriedParseFieldAccess> = [
        parseFieldProjection,
        parseFieldSelector,
    ];

    let maybeBestMatch: TTriedParseFieldAccess | undefined;
    for (const fn of parseFns) {
        const attempt: TTriedParseFieldAccess = fn(parseSettings, parserState);
        maybeBestMatch = betterFieldAccessMatch(maybeBestMatch, attempt);
    }

    return maybeBestMatch;
}

function parseFieldProjection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): TriedParseFieldProjection<S> {
    const triedFieldAccess: TriedParseFieldAccess<Ast.FieldProjection, S> = tryParseFieldAccess<Ast.FieldProjection, S>(
        parseSettings,
        parserState,
        parseSettings.parser.readFieldProjection,
    );

    if (ResultUtils.isOk(triedFieldAccess)) {
        return ResultUtils.okFactory({
            hasError: false,
            nodeKind: Ast.NodeKind.FieldProjection,
            ...triedFieldAccess.value,
        });
    } else {
        return ResultUtils.errFactory({
            hasError: true,
            nodeKind: Ast.NodeKind.FieldProjection,
            parseError: triedFieldAccess.error,
        });
    }
}

function parseFieldSelector<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): TriedParseFieldSelection<S> {
    const triedFieldAccess: TriedParseFieldAccess<Ast.FieldSelector, S> = tryParseFieldAccess<Ast.FieldSelector, S>(
        parseSettings,
        parserState,
        parseSettings.parser.readFieldSelection,
    );

    if (ResultUtils.isOk(triedFieldAccess)) {
        return ResultUtils.okFactory({
            hasError: false,
            nodeKind: Ast.NodeKind.FieldSelector,
            ...triedFieldAccess.value,
        });
    } else {
        return ResultUtils.errFactory({
            hasError: true,
            nodeKind: Ast.NodeKind.FieldSelector,
            parseError: triedFieldAccess.error,
        });
    }
}

function tryParseFieldAccess<T extends Ast.FieldProjection | Ast.FieldSelector, S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    parseFn: (state: S, parser: IParser<S>) => T,
): TriedParseFieldAccess<T, S> {
    const copiedState: S = cloneThenResetContextState(parseSettings, parserState);
    try {
        return ResultUtils.okFactory({
            ast: parseFn(copiedState, parseSettings.parser),
            parserState: copiedState as S,
        });
    } catch (error) {
        if (CommonError.isTInnerCommonError(error)) {
            throw error;
        } else if (!ParseError.isTInnerParseError(error)) {
            throw new CommonError.InvariantError(`unknown error was thrown`, { error });
        }
        const innerParseError: ParseError.TInnerParseError = error;
        return ResultUtils.errFactory(new ParseError.ParseError(innerParseError, copiedState as S));
    }
}

function cloneThenResetContextState<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): S {
    return {
        ...parseSettings.parserStateCloner(parserState),
        contextState: ParseContextUtils.stateFactory,
    };
}

function betterFieldAccessMatch(
    maybeCurrentBest: TTriedParseFieldAccess | undefined,
    newAccess: TTriedParseFieldAccess,
): TTriedParseFieldAccess {
    if (maybeCurrentBest === undefined) {
        return newAccess;
    } else if (tokenIndexFromTriedParseFieldAccess(newAccess) > tokenIndexFromTriedParseFieldAccess(maybeCurrentBest)) {
        return newAccess;
    } else {
        return maybeCurrentBest;
    }
}

function tokenIndexFromTriedParseFieldAccess(triedParseFieldAccess: TTriedParseFieldAccess): number {
    if (triedParseFieldAccess.kind === ResultKind.Ok) {
        return triedParseFieldAccess.value.parserState.tokenIndex;
    } else {
        return triedParseFieldAccess.error.parseError.state.tokenIndex;
    }
}
