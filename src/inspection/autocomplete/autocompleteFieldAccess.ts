// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ResultUtils } from "../../common";
import { Ast, Token, Type, Constant } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { getLocalizationTemplates } from "../../localization";
import {
    IParser,
    IParserState,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    ParseError,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";
import {
    AutocompleteFieldAccess,
    AutocompleteItem,
    InspectedFieldAccess,
    ParsedFieldAccess,
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

const FieldAccessNodeKinds: ReadonlyArray<Ast.NodeKind> = [Ast.NodeKind.FieldSelector, Ast.NodeKind.FieldProjection];

function autocompleteFieldAccess<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
    maybeParseError: ParseError.ParseError | undefined,
): AutocompleteFieldAccess | undefined {
    let maybeInspectedFieldAccess: InspectedFieldAccess | undefined = undefined;

    // Option 1: Find a field access node in the ancestry.
    let maybeFieldAccessAncestor: TXorNode | undefined;
    for (const ancestor of activeNode.ancestry) {
        if (FieldAccessNodeKinds.includes(ancestor.node.kind)) {
            maybeFieldAccessAncestor = ancestor;
        }
    }
    if (maybeFieldAccessAncestor !== undefined) {
        maybeInspectedFieldAccess = inspectFieldAccess(
            parserState.lexerSnapshot,
            parserState.contextState.nodeIdMapCollection,
            activeNode.position,
            maybeFieldAccessAncestor,
        );
    }

    // Option 2: The field access is part of a trailing expression.
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

    if (hasTrailingOpenConstant === true) {
        // From the starting open constant run a few new parse runs and return the run which parsed the most tokens.
        const maybeParsedFieldAccess: ParsedFieldAccess | undefined = maybeParseFieldAccessFromParse<S>(
            parseSettings,
            parserState,
        );
        // Neither parse was succesful.
        if (maybeParsedFieldAccess === undefined) {
            return undefined;
        }
        maybeInspectedFieldAccess = inspectFieldAccess(
            maybeParsedFieldAccess.parserState.lexerSnapshot,
            maybeParsedFieldAccess.parserState.contextState.nodeIdMapCollection,
            activeNode.position,
            maybeParsedFieldAccess.root,
        );
    }

    // No field access was found, or the field access reports no autocomplete is possible.
    // Eg. `[x = 1][x |]`
    if (maybeInspectedFieldAccess === undefined || maybeInspectedFieldAccess.isAutocompleteAllowed === false) {
        return undefined;
    }
    const inspectedFieldAccess: InspectedFieldAccess = maybeInspectedFieldAccess;

    // After a field access was found then find the field it's accessing and inspect the field's type.
    // This is delayed until after the field access because running static type analysis on an
    // arbitrary field could be costly.
    const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;
    const maybeField: TXorNode | undefined = maybeTypablePrimaryExpression(
        nodeIdMapCollection,
        activeNode,
        hasTrailingOpenConstant,
    );
    if (maybeField === undefined) {
        return undefined;
    }
    const field: TXorNode = maybeField;

    const triedFieldType: TriedType = tryType(
        parseSettings,
        nodeIdMapCollection,
        parserState.contextState.leafNodeIds,
        field.node.id,
        typeCache,
    );
    if (ResultUtils.isErr(triedFieldType)) {
        throw triedFieldType.error;
    }
    const fieldType: Type.TType = triedFieldType.value;

    // We can only autocomplete a field access if we know what fields are present.
    if (
        fieldType.maybeExtendedKind !== Type.ExtendedTypeKind.DefinedRecord &&
        fieldType.maybeExtendedKind !== Type.ExtendedTypeKind.DefinedTable
    ) {
        return undefined;
    }

    return {
        field,
        fieldType,
        inspectedFieldAccess,
        autocompleteItems: autoCompleteItemsFactory(fieldType, inspectedFieldAccess),
    };
}

function inspectFieldAccess(
    lexerSnapshot: LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldAccess: TXorNode,
): InspectedFieldAccess {
    switch (fieldAccess.node.kind) {
        case Ast.NodeKind.FieldProjection:
            return inspectFieldProjection(lexerSnapshot, nodeIdMapCollection, position, fieldAccess);

        case Ast.NodeKind.FieldSelector:
            return inspectFieldSelector(lexerSnapshot, nodeIdMapCollection, position, fieldAccess);

        default:
            const details: {} = {
                nodeId: fieldAccess.node.id,
                nodeKind: fieldAccess.node.kind,
            };
            throw new CommonError.InvariantError(
                `fieldAccess should be either ${Ast.NodeKind.FieldProjection} or ${Ast.NodeKind.FieldSelector}`,
                details,
            );
    }
}

function inspectFieldProjection(
    lexerSnapshot: LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldProjection: TXorNode,
): InspectedFieldAccess {
    let isAutocompleteAllowed: boolean = false;
    let maybeIdentifierUnderPosition: string | undefined;
    const fieldNames: string[] = [];

    for (const fieldSelector of NodeIdMapIterator.iterFieldProjection(nodeIdMapCollection, fieldProjection)) {
        const inspectedFieldSelector: InspectedFieldAccess = inspectFieldSelector(
            lexerSnapshot,
            nodeIdMapCollection,
            position,
            fieldSelector,
        );
        if (
            inspectedFieldSelector.isAutocompleteAllowed === true ||
            inspectedFieldSelector.maybeIdentifierUnderPosition !== undefined
        ) {
            isAutocompleteAllowed = true;
            maybeIdentifierUnderPosition = inspectedFieldSelector.maybeIdentifierUnderPosition;
        }
        fieldNames.push(...inspectedFieldSelector.fieldNames);
    }

    return {
        isAutocompleteAllowed,
        maybeIdentifierUnderPosition,
        fieldNames,
    };
}

function inspectFieldSelector(
    lexerSnapshot: LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldSelector: TXorNode,
): InspectedFieldAccess {
    const children: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);
    if (children === undefined || children.length < 2) {
        return {
            isAutocompleteAllowed: PositionUtils.isInXor(nodeIdMapCollection, position, fieldSelector, true, true),
            maybeIdentifierUnderPosition: undefined,
            fieldNames: [],
        };
    }

    const generalizedIdentifierId: number = children[1];
    const generalizedIdentifierXor: TXorNode = NodeIdMapUtils.assertGetXor(
        nodeIdMapCollection,
        generalizedIdentifierId,
    );
    Assert.isTrue(
        generalizedIdentifierXor.node.kind === Ast.NodeKind.GeneralizedIdentifier,
        "generalizedIdentifier.node.kind === Ast.NodeKind.GeneralizedIdentifier",
    );

    switch (generalizedIdentifierXor.kind) {
        case XorNodeKind.Ast: {
            const generalizedIdentifier: Ast.GeneralizedIdentifier = generalizedIdentifierXor.node as Ast.GeneralizedIdentifier;
            const isPositionInIdentifier: boolean = PositionUtils.isInAst(position, generalizedIdentifier, true, true);
            return {
                isAutocompleteAllowed: isPositionInIdentifier,
                maybeIdentifierUnderPosition:
                    isPositionInIdentifier === true ? generalizedIdentifier.literal : undefined,
                fieldNames: [generalizedIdentifier.literal],
            };
        }

        case XorNodeKind.Context: {
            // TODO [Autocomplete]:
            // This doesn't take into account of generalized identifiers consisting of multiple tokens.
            // Eg. `foo[bar baz]` or `foo[#"bar baz"].
            const openBracketConstant: Ast.TNode = NodeIdMapUtils.assertGetChildAstByAttributeIndex(
                nodeIdMapCollection,
                fieldSelector.node.id,
                0,
                [Ast.NodeKind.Constant],
            );
            const maybeNextTokenPosition: Token.TokenPosition =
                lexerSnapshot.tokens[openBracketConstant.tokenRange.tokenIndexEnd + 1]?.positionStart;

            const isAutocompleteAllowed: boolean =
                PositionUtils.isAfterAst(position, openBracketConstant, false) &&
                (maybeNextTokenPosition === undefined ||
                    PositionUtils.isOnTokenPosition(position, maybeNextTokenPosition) ||
                    PositionUtils.isBeforeTokenPosition(position, maybeNextTokenPosition, true));

            return {
                isAutocompleteAllowed,
                maybeIdentifierUnderPosition: undefined,
                fieldNames: [],
            };
        }

        default:
            throw Assert.isNever(generalizedIdentifierXor);
    }
}

function autoCompleteItemsFactory(
    fieldType: Type.DefinedRecord | Type.DefinedTable,
    inspectedFieldAccess: InspectedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    if (inspectedFieldAccess.isAutocompleteAllowed === false) {
        return [];
    }
    const fieldAccessNames: ReadonlyArray<string> = inspectedFieldAccess.fieldNames;

    const possibleAutocompleteItems: AutocompleteItem[] = [];

    const maybeIdentifierUnderPosition: string | undefined = inspectedFieldAccess.maybeIdentifierUnderPosition;
    for (const [key, type] of fieldType.fields.entries()) {
        if (fieldAccessNames.includes(key) === true) {
            continue;
        }

        if (maybeIdentifierUnderPosition === undefined || key.indexOf(maybeIdentifierUnderPosition) === 0) {
            possibleAutocompleteItems.push({
                key,
                type,
            });
        }
    }

    return possibleAutocompleteItems;
}

function maybeTypablePrimaryExpression(
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

            // The previous ancestor is the head. This should only happen if a trailing open bracket exists.
            // Eg. `foo[|`
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
            // Else the previous ancestor is the ArrayWrapper.
            // Return the head if its attribute index is 0, otherwise the (n - 1) element in ArrayWrapper.
            else {
                const maybeChildrenForArrayWrapper:
                    | ReadonlyArray<number>
                    | undefined = nodeIdMapCollection.childIdsById.get(xorNodeBeforeRpe.node.id);

                // If the ArrayWrapper has no children.
                if (maybeChildrenForArrayWrapper === undefined) {
                    // If there's a trailing bracket then we can return the head, else nothing.
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
                // Else if there's a single child then conditionally shift left or remain in place.
                else if (maybeChildrenForArrayWrapper.length === 1) {
                    // If an unparsed trailing open bracket exists then don't shift to the left.
                    if (hasTrailingOpenConstant === true) {
                        return ancestry[index - 2];
                    }
                    // Otherwise return the previous sibling, meaning the head.
                    else {
                        return NodeIdMapUtils.assertGetChildXorByAttributeIndex(
                            nodeIdMapCollection,
                            xorNode.node.id,
                            0,
                            undefined,
                        );
                    }
                }
                // Else shift one to the left.
                else {
                    const numChildren: number = maybeChildrenForArrayWrapper.length;
                    return NodeIdMapUtils.assertGetChildXorByAttributeIndex(
                        nodeIdMapCollection,
                        xorNodeBeforeRpe.node.id,
                        maybeChildrenForArrayWrapper.length - 2,
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
): ParsedFieldAccess | undefined {
    const parseFns: ReadonlyArray<(parseSettings: ParseSettings<S>, parserState: S) => ParsedFieldAccess> = [
        parseFieldProjection,
        parseFieldSelection,
    ];

    let maybeBestMatch: ParsedFieldAccess | undefined;
    for (const fn of parseFns) {
        const attempt: ParsedFieldAccess = fn(parseSettings, parserState);
        maybeBestMatch = betterFieldAccessMatch(maybeBestMatch, attempt);
    }

    return maybeBestMatch;
}

function parseFieldProjection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): ParsedFieldAccess {
    return tryParseFieldAccess<Ast.FieldProjection, S>(
        parseSettings,
        parserState,
        parseSettings.parser.readFieldProjection,
    );
}

function parseFieldSelection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): ParsedFieldAccess {
    return tryParseFieldAccess<Ast.FieldSelector, S>(
        parseSettings,
        parserState,
        parseSettings.parser.readFieldSelection,
    );
}

function tryParseFieldAccess<T extends Ast.FieldProjection | Ast.FieldSelector, S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    parseFn: (state: S, parser: IParser<S>) => T,
): ParsedFieldAccess {
    const newState: S = parseSettings.parserStateFactory(
        parserState.maybeCancellationToken,
        parserState.lexerSnapshot,
        parserState.tokenIndex,
        parseSettings.locale,
    );

    try {
        const ast: T = parseFn(newState, parseSettings.parser);
        return {
            root: XorNodeUtils.astFactory(ast),
            parserState: newState,
            maybeParseError: undefined,
        };
    } catch (error) {
        if (CommonError.isTInnerCommonError(error)) {
            throw error;
        } else if (!ParseError.isTInnerParseError(error)) {
            throw new CommonError.InvariantError(`unknown error was thrown`, { error });
        }
        const innerParseError: ParseError.TInnerParseError = error;

        return {
            root: XorNodeUtils.contextFactory(Assert.asDefined(newState.contextState.maybeRoot)),
            parserState: newState,
            maybeParseError: new ParseError.ParseError(innerParseError, newState),
        };
    }
}

function betterFieldAccessMatch(
    maybeBestFieldAccess: ParsedFieldAccess | undefined,
    currentFieldAccess: ParsedFieldAccess,
): ParsedFieldAccess {
    if (maybeBestFieldAccess === undefined) {
        return currentFieldAccess;
    }

    const currentTokenIndex: number = tokenIndexFromParseFieldAccess(currentFieldAccess);
    const bestTokenIndex: number = tokenIndexFromParseFieldAccess(maybeBestFieldAccess);

    // Prioritize FieldSelector over FieldProjection.
    // Eg. `foo[|` is more likely to be a selection
    if (currentTokenIndex === bestTokenIndex && currentFieldAccess.root.node.kind === Ast.NodeKind.FieldSelector) {
        return currentFieldAccess;
    } else if (currentTokenIndex > bestTokenIndex) {
        return currentFieldAccess;
    } else {
        return maybeBestFieldAccess;
    }
}

function tokenIndexFromParseFieldAccess(parsedFieldAccess: ParsedFieldAccess): number {
    return parsedFieldAccess.maybeParseError === undefined
        ? Number.MAX_SAFE_INTEGER
        : parsedFieldAccess.maybeParseError.state.tokenIndex;
}
