// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../../common";
import { Ast, Token, Type } from "../../language";
import { getLocalizationTemplates } from "../../localization";
import {
    BracketDisambiguation,
    CombinatorialParser,
    IParser,
    IParserState,
    NaiveParseSteps,
    NodeIdMap,
    NodeIdMapUtils,
    ParseContextUtils,
    ParseError,
    TXorNode,
    XorNodeUtils,
} from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";
import {
    AutocompleteFieldAccess,
    FieldAccess,
    FieldAccessKind,
    IAutocompleteItem,
    TriedAutocompleteFieldAccess,
} from "./commonTypes";
import { autocomplete } from "./task";

export function tryAutocompleteFieldAccess<S extends IParserState = IParserState>(
    settings: CommonSettings,
    parserState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
    maybeParseError: ParseError.ParseError | undefined,
): TriedAutocompleteFieldAccess {
    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => {
        return autocompleteFieldAccess(settings, parserState, activeNode, typeCache, maybeParseError);
    });
}

function autocompleteFieldAccess<S extends IParserState = IParserState>(
    settings: CommonSettings,
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

    const maybeInspectable: TXorNode | undefined = maybeInspectablePrimaryExpression(
        parserState.contextState.nodeIdMapCollection,
        activeNode,
        hasTrailingOpenConstant,
    );
    if (maybeInspectable === undefined) {
        return undefined;
    }
    const inspectable: TXorNode = maybeInspectable;

    const maybeFieldAccess: FieldAccess | undefined = maybeFieldAccessFromParse(parserState);
    if (maybeFieldAccess === undefined) {
        return undefined;
    }

    const triedInspectableType: TriedType = tryType(
        settings,
        parserState.contextState.nodeIdMapCollection,
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

    let autocompleteItems: IAutocompleteItem[] = [];
    for (const [key, type] of inspectableType.fields.entries()) {
        autocompleteItems.push({
            key,
            type,
        });
    }

    if (activeNode.maybeIdentifierUnderPosition !== undefined) {
        const positionIdentifierLiteral: string | undefined = activeNode.maybeIdentifierUnderPosition.literal;
        autocompleteItems = autocompleteItems.filter((autocompleteItem: IAutocompleteItem) =>
            positionIdentifierLiteral.startsWith(autocompleteItem.key),
        );
    }

    return {
        field: inspectable,
        fieldType: inspectableType,
        access: maybeFieldAccess,
        autocompleteItems,
    };
}

const AllowedTrailingOpenWrapperConstants: ReadonlyArray<Token.TokenKind> = [
    Token.TokenKind.LeftBrace,
    Token.TokenKind.LeftBracket,
];

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

function maybeFieldAccessFromParse<S extends IParserState = IParserState>(parserState: S): FieldAccess | undefined {
    const entryPoints: ReadonlyArray<[
        FieldAccessKind,
        (state: IParserState, parser: IParser<IParserState>) => Ast.TNode,
    ]> = [
        [BracketDisambiguation.FieldProjection, NaiveParseSteps.readFieldProjection],
        [BracketDisambiguation.FieldSelection, NaiveParseSteps.readFieldSelection],
    ];

    let maybeBestMatch: FieldAccess | undefined;
    for (const [kind, entryPoint] of entryPoints) {
        const copiedState: IParserState = copyThenResetContextState(parserState);

        try {
            entryPoint(copiedState, CombinatorialParser);
            maybeBestMatch = betterFieldAccessMatch(maybeBestMatch, {
                kind,
                parserState: copiedState,
            });
        } catch (err) {
            if (!ParseError.isTInnerParseError(err)) {
                continue;
            }

            maybeBestMatch = betterFieldAccessMatch(maybeBestMatch, {
                kind,
                parserState: copiedState,
            });
        }
    }

    return maybeBestMatch;
}

function copyThenResetContextState(original: IParserState): IParserState {
    return {
        ...original,
        contextState: ParseContextUtils.newState(),
        maybeCurrentContextNode: undefined,
    };
}

function betterFieldAccessMatch(maybeCurrentBest: FieldAccess | undefined, newAccess: FieldAccess): FieldAccess {
    if (maybeCurrentBest === undefined) {
        return newAccess;
    } else if (maybeCurrentBest.parserState.tokenIndex < newAccess.parserState.tokenIndex) {
        return newAccess;
    } else {
        return maybeCurrentBest;
    }
}
