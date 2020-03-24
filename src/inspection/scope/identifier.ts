// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ScopeItemKind, TScopeItem } from ".";
import { InspectionUtils } from "..";
import { CommonError, isNever, Result, ResultKind } from "../../common";
import { Ast, NodeIdMap, NodeIdMapIter, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";
import { InspectionSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils } from "../activeNode";
import { Position, PositionUtils } from "../position";

// The inspection travels across ActiveNode.ancestry to build up a scope.
export interface InspectedIdentifier {
    readonly scope: ReadonlyMap<string, TScopeItem>;
}

export function tryInspectIdentifier(
    settings: InspectionSettings,
    activeNode: ActiveNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Result<InspectedIdentifier, CommonError.CommonError> {
    const state: IdentifierState = {
        nodeIndex: 0,
        result: {
            scope: new Map(),
        },
        activeNode,
        nodeIdMapCollection,
        leafNodeIds,
    };

    try {
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        const numNodes: number = ancestry.length;
        for (let index: number = 0; index < numNodes; index += 1) {
            state.nodeIndex = index;
            const xorNode: TXorNode = ancestry[index];
            inspectNode(state, xorNode);
        }

        return {
            kind: ResultKind.Ok,
            value: {
                ...state.result,
            },
        };
    } catch (err) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(settings.localizationTemplates, err),
        };
    }
}

interface IdentifierState {
    nodeIndex: number;
    result: InspectedIdentifier;
    readonly activeNode: ActiveNode;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

function inspectNode(state: IdentifierState, xorNode: TXorNode): void {
    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            inspectIdentifier(state, xorNode, true);
            break;

        case Ast.NodeKind.IdentifierExpression:
            inspectIdentifierExpression(state, xorNode, true);
            break;

        case Ast.NodeKind.IdentifierPairedExpression:
            break;

        case Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode);
            break;

        case Ast.NodeKind.SectionMember:
            inspectSectionMember(state, xorNode);
            break;

        default:
            break;
    }
}

// If you came from the TExpression in the EachExpression,
// then add '_' to the scope.
function inspectEachExpression(state: IdentifierState, eachExpr: TXorNode): void {
    const previous: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex);
    if (previous.node.maybeAttributeIndex !== 1) {
        return;
    }

    mightUpdateScope(state, "_", {
        kind: ScopeItemKind.Each,
        each: eachExpr,
    });
}

// If position is to the right of '=>',
// then add all parameter names to the scope.
function inspectFunctionExpression(state: IdentifierState, fnExpr: TXorNode): void {
    if (fnExpr.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExpr, Ast.NodeKind.FunctionExpression);
    }

    // inspectedFnExpr.parameters.map((parameter: TypeInspector.InspectedFunctionParameter) => {
    //     mightUpdateScope(state, parameter.name.literal, {
    //         kind: ScopeItemKind.Parameter,
    //         name: parameter.name,
    //         isOptional: parameter.,
    //         isNullable,
    //         maybeType,
    //     });
    // });

    const previous: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex);
    if (previous.node.maybeAttributeIndex !== 3) {
        return;
    }

    // It's safe to expect an Ast.
    // All attributes would've had to been fully parsed before the expression body context was created,
    // and the previous check ensures that a TXorNode (either context or Ast) exists for the expression body.
    const parameters: Ast.IParameterList<
        Ast.AsNullablePrimitiveType | undefined
    > = NodeIdMapUtils.expectAstChildByAttributeIndex(state.nodeIdMapCollection, fnExpr.node.id, 0, [
        Ast.NodeKind.ParameterList,
    ]) as Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;

    for (const parameterCsv of parameters.content.elements) {
        const parameterName: Ast.Identifier = parameterCsv.node.name;
        const scopeKey: string = parameterName.literal;

        let maybeType: Ast.PrimitiveTypeConstantKind | undefined;
        let isNullable: boolean;
        const maybeParameterType: Ast.AsNullablePrimitiveType | undefined = parameterCsv.node.maybeParameterType;
        if (maybeParameterType !== undefined) {
            const asConstant: Ast.TNullablePrimitiveType = maybeParameterType.paired;

            switch (asConstant.kind) {
                case Ast.NodeKind.NullablePrimitiveType:
                    maybeType = asConstant.paired.primitiveType.constantKind;
                    isNullable = true;
                    break;

                case Ast.NodeKind.PrimitiveType:
                    maybeType = asConstant.primitiveType.constantKind;
                    isNullable = false;
                    break;

                default:
                    throw isNever(asConstant);
            }
        } else {
            maybeType = undefined;
            isNullable = true;
        }

        mightUpdateScope(state, scopeKey, {
            kind: ScopeItemKind.Parameter,
            name: parameterName,
            isOptional: parameterCsv.node.maybeOptionalConstant === undefined,
            isNullable,
            maybeType,
        });
    }
}

function inspectIdentifier(state: IdentifierState, identifier: TXorNode, isRoot: boolean): void {
    // Ignore the case of a Context node as there are two possible states:
    // An empty context (no children), or an Ast.TNode instance.
    // Both have no identifier attached to it.
    //
    // Ignore the case of where the parent is an IdentifierExpression as the parent handle adding to the scope.
    if (identifier.kind !== XorNodeKind.Ast || isParentOfNodeKind(state, Ast.NodeKind.IdentifierExpression)) {
        return;
    }

    if (identifier.node.kind !== Ast.NodeKind.Identifier) {
        throw expectedNodeKindError(identifier, Ast.NodeKind.Identifier);
    }
    const identifierAstNode: Ast.Identifier = identifier.node;

    // Don't add the identifier to scope if it's the root and position is before the identifier starts.
    // 'a +| b'
    // '|foo'
    const position: Position = state.activeNode.position;
    if (isRoot && PositionUtils.isBeforeAstNode(position, identifierAstNode, true)) {
        return;
    }

    // Don't add the identifier if you're coming from inside a ParameterList
    // '(foo|, bar) => 1'
    const maybeNext: TXorNode | undefined = ActiveNodeUtils.maybeNextXorNode(state.activeNode, state.nodeIndex);
    if (maybeNext && maybeNext.node.kind === Ast.NodeKind.Parameter) {
        return;
    }

    mightUpdateScope(state, identifierAstNode.literal, {
        kind: ScopeItemKind.Undefined,
        xorNode: identifier,
    });
}

function inspectIdentifierExpression(state: IdentifierState, identifierExpr: TXorNode, isLeaf: boolean): void {
    // Don't add the identifier to scope if it's the leaf,
    // and if the position is before the start of the identifier.
    // 'a +| b'
    // '|foo'
    if (isLeaf && PositionUtils.isBeforeXorNode(state.activeNode.position, identifierExpr, false)) {
        return;
    }

    let key: string;
    switch (identifierExpr.kind) {
        case XorNodeKind.Ast: {
            if (identifierExpr.node.kind !== Ast.NodeKind.IdentifierExpression) {
                throw expectedNodeKindError(identifierExpr, Ast.NodeKind.IdentifierExpression);
            }

            const identifierExprAstNode: Ast.IdentifierExpression = identifierExpr.node;
            const identifier: Ast.Identifier = identifierExprAstNode.identifier;
            const maybeInclusiveConstant: Ast.IConstant<Ast.MiscConstantKind.AtSign> | undefined =
                identifierExprAstNode.maybeInclusiveConstant;

            key =
                maybeInclusiveConstant !== undefined
                    ? maybeInclusiveConstant.constantKind + identifier.literal
                    : identifier.literal;
            break;
        }

        case XorNodeKind.Context: {
            key = "";
            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

            // Add the optional inclusive constant `@` if it was parsed.
            const maybeInclusiveConstant:
                | TXorNode
                | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExpr.node.id,
                0,
                [Ast.NodeKind.Constant],
            );
            if (maybeInclusiveConstant !== undefined) {
                const inclusiveConstant: Ast.IConstant<Ast.MiscConstantKind.AtSign> = maybeInclusiveConstant.node as Ast.IConstant<
                    Ast.MiscConstantKind.AtSign
                >;
                // Adds the '@' prefix.
                key = inclusiveConstant.constantKind;
            }

            const maybeIdentifier:
                | TXorNode
                | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                identifierExpr.node.id,
                1,
                [Ast.NodeKind.Identifier],
            );
            if (maybeIdentifier !== undefined) {
                const identifier: Ast.Identifier = maybeIdentifier.node as Ast.Identifier;
                key += identifier.literal;
            }
            break;
        }

        default:
            throw isNever(identifierExpr);
    }

    if (key.length) {
        mightUpdateScope(state, key, {
            kind: ScopeItemKind.Undefined,
            xorNode: identifierExpr,
        });
    }
}

// If position is to the right of an equals sign,
// then add all keys to the scope EXCEPT for the key that the position is under.
function inspectLetExpression(state: IdentifierState, letExpr: TXorNode): void {
    const maybePreviousAttributeIndex: number | undefined = ActiveNodeUtils.expectPreviousXorNode(
        state.activeNode,
        state.nodeIndex,
    ).node.maybeAttributeIndex;
    if (maybePreviousAttributeIndex !== 3 && !InspectionUtils.isInKeyValuePairAssignment(state)) {
        return;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    let maybeAncestorKeyValuePair: TXorNode | undefined;
    // If ancestor is an expression
    if (maybePreviousAttributeIndex === 3) {
        maybeAncestorKeyValuePair = undefined;
    } else {
        maybeAncestorKeyValuePair = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex, 3, [
            Ast.NodeKind.IdentifierPairedExpression,
        ]);
    }

    for (const kvp of NodeIdMapIter.letKeyValuePairs(nodeIdMapCollection, letExpr)) {
        if (maybeAncestorKeyValuePair && maybeAncestorKeyValuePair.node.id === kvp.source.node.id) {
            continue;
        }

        const keyValuePairId: number = kvp.source.node.id;
        const maybeKey: Ast.Identifier | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            0,
            [Ast.NodeKind.Identifier],
        ) as Ast.Identifier;
        if (maybeKey === undefined) {
            continue;
        }
        const key: Ast.Identifier = maybeKey;
        const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairId,
            2,
            undefined,
        );
        mightUpdateScope(state, key.literal, {
            kind: ScopeItemKind.KeyValuePair,
            key,
            maybeValue,
        });
    }
}

// If position is to the right of an equals sign,
// then add all keys to scope EXCEPT for the one the that position is under.
function inspectRecordExpressionOrRecordLiteral(state: IdentifierState, record: TXorNode): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    // Only add to scope if you're in the right hand of an assignment.
    if (!InspectionUtils.isInKeyValuePairAssignment(state)) {
        return;
    }

    const ancestorKeyValuePair: TXorNode = ActiveNodeUtils.expectPreviousXorNode(state.activeNode, state.nodeIndex, 3, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
    ]);

    for (const kvp of NodeIdMapIter.recordKeyValuePairs(nodeIdMapCollection, record)) {
        if (kvp.source.node.id === ancestorKeyValuePair.node.id) {
            continue;
        }

        mightUpdateScope(state, kvp.keyLiteral, {
            kind: ScopeItemKind.KeyValuePair,
            key: kvp.key,
            maybeValue: kvp.maybeValue,
        });
    }
}

function inspectSectionMember(state: IdentifierState, sectionMember: TXorNode): void {
    if (!InspectionUtils.isInKeyValuePairAssignment(state)) {
        return;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const sectionMemberArray: TXorNode = ActiveNodeUtils.expectNextXorNode(state.activeNode, state.nodeIndex, 1, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    const sectionMembers: ReadonlyArray<TXorNode> = NodeIdMapIter.expectXorChildren(
        nodeIdMapCollection,
        sectionMemberArray.node.id,
    );
    for (const iterSectionMember of sectionMembers) {
        // Ignore if it's the current SectionMember.
        if (iterSectionMember.node.id === sectionMember.node.id) {
            continue;
        }

        const maybeKeyValuePair:
            | TXorNode
            | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            iterSectionMember.node.id,
            2,
            [Ast.NodeKind.IdentifierPairedExpression],
        );
        if (maybeKeyValuePair === undefined) {
            continue;
        }
        const keyValuePair: TXorNode = maybeKeyValuePair;

        // Add name to scope.
        const maybeName: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeName === undefined || maybeName.kind === XorNodeKind.Context) {
            continue;
        }
        const name: Ast.Identifier = maybeName.node as Ast.Identifier;

        const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            2,
            undefined,
        );

        mightUpdateScope(state, name.literal, {
            kind: ScopeItemKind.SectionMember,
            key: name,
            maybeValue,
        });
    }
}

function expectedNodeKindError(xorNode: TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
    const details: {} = {
        xorNodeId: xorNode.node.id,
        expectedNodeKind: expected,
        actualNodeKind: xorNode.node.kind,
    };
    return new CommonError.InvariantError(`expected xorNode to be of kind ${expected}`, details);
}

function isParentOfNodeKind(state: IdentifierState, parentNodeKind: Ast.NodeKind): boolean {
    const maybeParent: TXorNode | undefined = ActiveNodeUtils.maybeNextXorNode(state.activeNode, state.nodeIndex);
    return maybeParent !== undefined ? maybeParent.node.kind === parentNodeKind : false;
}

function mightUpdateScope(state: IdentifierState, key: string, scopeItem: TScopeItem): void {
    const unsafeScope: Map<string, TScopeItem> = state.result.scope as Map<string, TScopeItem>;
    const maybeScopeItem: TScopeItem | undefined = unsafeScope.get(key);
    const isUpdateNeeded: boolean =
        maybeScopeItem === undefined ||
        (maybeScopeItem.kind === ScopeItemKind.Undefined && scopeItem.kind !== ScopeItemKind.Undefined);

    if (isUpdateNeeded) {
        unsafeScope.set(key, scopeItem);
    }
}
