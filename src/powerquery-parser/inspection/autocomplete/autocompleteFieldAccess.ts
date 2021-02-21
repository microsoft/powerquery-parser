// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ResultUtils, StringUtils } from "../../common";
import { Ast, Token, Type } from "../../language";
import { LexerSnapshot } from "../../lexer";
import {
    AncestryUtils,
    IParseState,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "../../parser";
import { InspectionSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../typeCache";
import {
    AutocompleteFieldAccess,
    AutocompleteItem,
    InspectedFieldAccess,
    TriedAutocompleteFieldAccess,
} from "./commonTypes";

export function tryAutocompleteFieldAccess<S extends IParseState = IParseState>(
    settings: InspectionSettings,
    parseState: S,
    maybeActiveNode: TMaybeActiveNode,
    typeCache: TypeCache,
): TriedAutocompleteFieldAccess {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return ResultUtils.okFactory(undefined);
    }

    return ResultUtils.ensureResult(settings.locale, () => {
        return autocompleteFieldAccess(settings, parseState, maybeActiveNode, typeCache);
    });
}

const AllowedExtendedTypeKindsForFieldEntries: ReadonlyArray<Type.ExtendedTypeKind> = [
    Type.ExtendedTypeKind.AnyUnion,
    Type.ExtendedTypeKind.DefinedRecord,
    Type.ExtendedTypeKind.DefinedTable,
];

const FieldAccessNodeKinds: ReadonlyArray<Ast.NodeKind> = [Ast.NodeKind.FieldSelector, Ast.NodeKind.FieldProjection];

function autocompleteFieldAccess<S extends IParseState = IParseState>(
    settings: InspectionSettings,
    parseState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
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
            parseState.lexerSnapshot,
            parseState.contextState.nodeIdMapCollection,
            activeNode.position,
            maybeFieldAccessAncestor,
        );
    }

    // No field access was found, or the field access reports no autocomplete is possible.
    // Eg. `[x = 1][x |]`
    if (maybeInspectedFieldAccess === undefined || maybeInspectedFieldAccess.isAutocompleteAllowed === false) {
        return undefined;
    }
    const inspectedFieldAccess: InspectedFieldAccess = maybeInspectedFieldAccess;

    // Don't waste time on type analysis if the field access
    // reports inspection it's in an invalid autocomplete location.
    if (inspectedFieldAccess.isAutocompleteAllowed === false) {
        return undefined;
    }

    // After a field access was found then find the field it's accessing and inspect the field's type.
    // This is delayed until after the field access because running static type analysis on an
    // arbitrary field could be costly.
    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const maybeField: TXorNode | undefined = maybeTypablePrimaryExpression(nodeIdMapCollection, activeNode);
    if (maybeField === undefined) {
        return undefined;
    }
    const field: TXorNode = maybeField;

    const triedFieldType: TriedType = tryType(
        settings,
        nodeIdMapCollection,
        parseState.contextState.leafNodeIds,
        field.node.id,
        typeCache,
    );
    if (ResultUtils.isErr(triedFieldType)) {
        throw triedFieldType.error;
    }
    const fieldType: Type.TType = triedFieldType.value;

    // We can only autocomplete a field access if we know what fields are present.
    const fieldEntries: ReadonlyArray<[string, Type.TType]> = fieldEntriesFromFieldType(fieldType);
    if (fieldEntries.length === 0) {
        return undefined;
    }

    return {
        field,
        fieldType,
        inspectedFieldAccess,
        autocompleteItems: autoCompleteItemsFactory(fieldEntries, inspectedFieldAccess),
    };
}

function fieldEntriesFromFieldType(type: Type.TType): ReadonlyArray<[string, Type.TType]> {
    switch (type.maybeExtendedKind) {
        case Type.ExtendedTypeKind.AnyUnion: {
            let fields: [string, Type.TType][] = [];
            for (const field of type.unionedTypePairs) {
                if (
                    field.maybeExtendedKind &&
                    AllowedExtendedTypeKindsForFieldEntries.includes(field.maybeExtendedKind)
                ) {
                    fields = fields.concat(fieldEntriesFromFieldType(field));
                }
            }

            return fields;
        }

        case Type.ExtendedTypeKind.DefinedRecord:
        case Type.ExtendedTypeKind.DefinedTable:
            return [...type.fields.entries()];

        default:
            return [];
    }
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

function inspectedFieldAccessFactory(isAutocompleteAllowed: boolean): InspectedFieldAccess {
    return {
        isAutocompleteAllowed,
        maybeIdentifierUnderPosition: undefined,
        fieldNames: [],
    };
}

function inspectFieldSelector(
    lexerSnapshot: LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldSelector: TXorNode,
): InspectedFieldAccess {
    const children: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);
    if (children === undefined) {
        return inspectedFieldAccessFactory(false);
    } else if (children.length === 1) {
        return inspectedFieldAccessFactory(nodeIdMapCollection.astNodeById.has(children[0]));
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
    fieldEntries: ReadonlyArray<[string, Type.TType]>,
    inspectedFieldAccess: InspectedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    const fieldAccessNames: ReadonlyArray<string> = inspectedFieldAccess.fieldNames;
    const autocompleteItems: AutocompleteItem[] = [];

    const maybeIdentifierUnderPosition: string | undefined = inspectedFieldAccess.maybeIdentifierUnderPosition;
    for (const [key, type] of fieldEntries) {
        if (
            (fieldAccessNames.includes(key) && key !== maybeIdentifierUnderPosition) ||
            (maybeIdentifierUnderPosition && !key.startsWith(maybeIdentifierUnderPosition))
        ) {
            continue;
        }

        // If the key is a quoted identifier but doesn't need to be one then slice out the quote contents.
        const identifierKind: StringUtils.IdentifierKind = StringUtils.identifierKind(key, false);
        const normalizedKey: string = identifierKind === StringUtils.IdentifierKind.Quote ? key.slice(2, -1) : key;

        autocompleteItems.push({
            key: normalizedKey,
            type,
        });
    }

    return autocompleteItems;
}

function maybeTypablePrimaryExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): TXorNode | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    let maybeContiguousPrimaryExpression: TXorNode | undefined;
    let matchingContiguousPrimaryExpression: boolean = true;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        if (xorNode.node.kind === Ast.NodeKind.RecursivePrimaryExpression) {
            // The previous ancestor must be an attribute of Rpe, which is either its head or ArrrayWrapper.
            const xorNodeBeforeRpe: TXorNode = AncestryUtils.assertGetNthPreviousXor(ancestry, index);

            // If we're coming from the head node,
            // then return undefined as there can be no nodes before the head ode.
            if (xorNodeBeforeRpe.node.maybeAttributeIndex === 0) {
                return undefined;
            }
            // Else if we're coming from the ArrayWrapper,
            // then grab the previous sibling.
            else if (xorNodeBeforeRpe.node.maybeAttributeIndex === 1) {
                const rpeChild: TXorNode = AncestryUtils.assertGetNthPreviousXor(ancestry, index, 2);
                return NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
                    nodeIdMapCollection,
                    rpeChild.node.id,
                );
            } else {
                throw new CommonError.InvariantError(
                    `the child of a ${Ast.NodeKind.RecursivePrimaryExpression} should have an attribute index of either 1 or 2`,
                    {
                        parentId: xorNode.node.id,
                        childId: xorNodeBeforeRpe.node.id,
                    },
                );
            }
        } else if (matchingContiguousPrimaryExpression && XorNodeUtils.isTPrimaryExpression(xorNode)) {
            maybeContiguousPrimaryExpression = xorNode;
        } else {
            matchingContiguousPrimaryExpression = false;
        }
    }

    return maybeContiguousPrimaryExpression;
}
