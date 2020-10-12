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
    TriedAutocompleteFieldAccess,
    InspectedFieldAccess,
    ParsedFieldAccess,
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
        const maybeParsedFieldAccess: ParsedFieldAccess | undefined = maybeParseFieldAccessFromParse<S>(
            parseSettings,
            parserState,
        );
        if (maybeParsedFieldAccess === undefined) {
            return undefined;
        }
        maybeInspectedFieldAccess = inspectFieldAccess(
            parserState.contextState.nodeIdMapCollection,
            activeNode.position,
            maybeParsedFieldAccess.root,
        );
    }
    // Option 3: Return with nothing to autocomplete.
    else {
        return undefined;
    }

    if (maybeInspectedFieldAccess === undefined) {
        return undefined;
    }
    const inspectedFieldAccess: InspectedFieldAccess = maybeInspectedFieldAccess;

    // const maybeFieldAccessNames: ReadonlyArray<string> | undefined = maybeParsedFieldAccessNames(
    //     activeNode,
    //     parsedFieldAccess,
    // );
    // if (maybeFieldAccessNames === undefined) {
    //     return undefined;
    // }
    // const fieldAccessNames: ReadonlyArray<string> = maybeFieldAccessNames;

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
        inspectedFieldAccess,
        autocompleteItems: autoCompleteItemsFactory(inspectableType, inspectedFieldAccess),
    };
}

function inspectFieldAccess(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldAccess: TXorNode,
): InspectedFieldAccess {
    switch (fieldAccess.node.kind) {
        case Ast.NodeKind.FieldProjection:
            return inspectFieldProjection(nodeIdMapCollection, position, fieldAccess);

        case Ast.NodeKind.FieldSelector:
            return inspectFieldSelector(nodeIdMapCollection, position, fieldAccess);

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
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldProjection: TXorNode,
): InspectedFieldAccess {
    let isAutocompleteAllowed: boolean = false;
    let maybeIdentifierUnderPosition: string | undefined;
    const fieldNames: string[] = [];

    for (const fieldSelector of NodeIdMapIterator.iterFieldProjection(nodeIdMapCollection, fieldProjection)) {
        const inspectedFieldSelector: InspectedFieldAccess = inspectFieldSelector(
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
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldSelector: TXorNode,
): InspectedFieldAccess {
    const children: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);
    if (children === undefined || children.length < 2) {
        return {
            isAutocompleteAllowed: false,
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

        case XorNodeKind.Context:
            return {
                isAutocompleteAllowed: PositionUtils.isInContext(
                    nodeIdMapCollection,
                    position,
                    generalizedIdentifierXor.node,
                    true,
                    true,
                ),
                maybeIdentifierUnderPosition: undefined,
                fieldNames: [],
            };

        default:
            throw Assert.isNever(generalizedIdentifierXor);
    }
}

function autoCompleteItemsFactory(
    inspectableType: Type.DefinedRecord | Type.DefinedTable,
    inspectedFieldAccess: InspectedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    if (inspectedFieldAccess.isAutocompleteAllowed === false) {
        return [];
    }
    const fieldAccessNames: ReadonlyArray<string> = inspectedFieldAccess.fieldNames;

    const possibleAutocompleteItems: AutocompleteItem[] = [];

    const maybeIdentifierUnderPosition: string | undefined = inspectedFieldAccess.maybeIdentifierUnderPosition;
    for (const [key, type] of inspectableType.fields.entries()) {
        if (fieldAccessNames.includes(key) === true) {
            continue;
        }

        if (maybeIdentifierUnderPosition === undefined || maybeIdentifierUnderPosition.indexOf(key)) {
            possibleAutocompleteItems.push({
                key,
                type,
            });
        }
    }

    return possibleAutocompleteItems;
}

// // Returns undefined if it shouldn't be autocompleting.
// // Eg. `foo[bar |]`
// function maybeParsedFieldAccessNames<S extends IParserState = IParserState>(
//     activeNode: ActiveNode,
//     parsedFieldAccess: TParsedFieldAccess<S>,
// ): ReadonlyArray<string> | undefined {
//     if (parsedFieldAccess.hasError === true) {
//         const parserState: S = parsedFieldAccess.parseError.state;
//         const maybeRoot: ParseContext.Node | undefined = parserState.contextState.maybeRoot;
//         Assert.isDefined(maybeRoot);

//         const rootAsXorNode: TXorNode = XorNodeUtils.contextFactory(maybeRoot);
//         const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;
//         switch (parsedFieldAccess.nodeKind) {
//             case Ast.NodeKind.FieldProjection:
//                 return NodeIdMapIterator.iterFieldProjectionNames(nodeIdMapCollection, rootAsXorNode);

//             case Ast.NodeKind.FieldSelector: {
//                 const maybeGeneralizedIdentifier: Ast.TNode | undefined = NodeIdMapUtils.maybeWrappedContentAst(
//                     nodeIdMapCollection,
//                     rootAsXorNode,
//                     Ast.NodeKind.GeneralizedIdentifier,
//                 );
//                 if (
//                     maybeGeneralizedIdentifier === undefined ||
//                     !PositionUtils.isInAst(activeNode.position, maybeGeneralizedIdentifier, true, true)
//                 ) {
//                     return undefined;
//                 }

//                 const generalizedIdentifier: Ast.GeneralizedIdentifier = maybeGeneralizedIdentifier as Ast.GeneralizedIdentifier;
//                 return [generalizedIdentifier.literal];
//             }

//             default:
//                 throw Assert.isNever(parsedFieldAccess);
//         }
//     } else {
//         if (activeNode.maybeIdentifierUnderPosition === undefined) {
//             return undefined;
//         }

//         switch (parsedFieldAccess.nodeKind) {
//             case Ast.NodeKind.FieldProjection:
//                 return parsedFieldAccess.ast.content.elements.map(
//                     (csv: Ast.ICsv<Ast.FieldSelector>) => csv.node.content.literal,
//                 );

//             case Ast.NodeKind.FieldSelector:
//                 return [parsedFieldAccess.ast.content.literal];

//             default:
//                 throw Assert.isNever(parsedFieldAccess);
//         }
//     }
// }

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
            maybeParseError: new ParseError.ParseError(innerParseError, newState),
        };
    }
}

function betterFieldAccessMatch(
    maybeCurrentBest: ParsedFieldAccess | undefined,
    newAccess: ParsedFieldAccess,
): ParsedFieldAccess {
    if (maybeCurrentBest === undefined) {
        return newAccess;
    } else if (tokenIndexFromTriedParseFieldAccess(newAccess) > tokenIndexFromTriedParseFieldAccess(maybeCurrentBest)) {
        return newAccess;
    } else {
        return maybeCurrentBest;
    }
}

function tokenIndexFromTriedParseFieldAccess(parsedFieldAccess: ParsedFieldAccess): number {
    return parsedFieldAccess.maybeParseError === undefined
        ? Number.MAX_SAFE_INTEGER
        : parsedFieldAccess.maybeParseError.state.tokenIndex;
}
