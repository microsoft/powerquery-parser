// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../common";
import { Ast, Type } from "../language";
import { AncestryUtils, NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../parser";
import { InspectionSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { assertGetOrCreateNodeScope, NodeScope, ScopeItemKind, TScopeItem } from "./scope";
import { TriedType, tryType } from "./type";
import { createTypeCache, TypeCache } from "./typeCache";

export type TriedInvokeExpression = Result<InvokeExpression | undefined, CommonError.CommonError>;

export interface InvokeExpression {
    readonly xorNode: TXorNode;
    readonly functionType: Type.TType;
    readonly isNameInLocalScope: boolean;
    readonly maybeName: string | undefined;
    readonly maybeArguments: InvokeExpressionArgs | undefined;
}

export interface InvokeExpressionArgs {
    readonly numArguments: number;
    readonly argumentOrdinal: number;
}

export function tryInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeActiveNode: TMaybeActiveNode,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedInvokeExpression {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return ResultUtils.okFactory(undefined);
    }

    return ResultUtils.ensureResult(settings.locale, () =>
        inspectInvokeExpression(
            settings,
            nodeIdMapCollection,
            leafNodeIds,
            maybeActiveNode,
            maybeTypeCache ?? createTypeCache(),
        ),
    );
}

function inspectInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): InvokeExpression | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = activeNode.ancestry.length;

    for (let ancestryIndex: number = 0; ancestryIndex < numAncestors; ancestryIndex += 1) {
        const xorNode: TXorNode = ancestry[ancestryIndex];

        if (xorNode.node.kind === Ast.NodeKind.InvokeExpression) {
            const previousNode: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
                nodeIdMapCollection,
                xorNode.node.id,
            );

            const triedPreviousNodeType: TriedType = tryType(
                settings,
                nodeIdMapCollection,
                leafNodeIds,
                previousNode.node.id,
                typeCache,
            );
            const functionType: Type.TType = Assert.unwrapOk(triedPreviousNodeType);
            const maybeName: string | undefined = NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
                nodeIdMapCollection,
                xorNode.node.id,
            );

            // Try to find out if the identifier is a local or external name.
            let isNameInLocalScope: boolean;
            if (maybeName !== undefined) {
                // Seed local scope
                const scope: NodeScope = Assert.unwrapOk(
                    assertGetOrCreateNodeScope(
                        settings,
                        nodeIdMapCollection,
                        leafNodeIds,
                        xorNode.node.id,
                        typeCache.scopeById,
                    ),
                );
                const maybeNameScopeItem: TScopeItem | undefined = scope.get(maybeName);

                isNameInLocalScope =
                    maybeNameScopeItem !== undefined && maybeNameScopeItem.kind !== ScopeItemKind.Undefined;
            } else {
                isNameInLocalScope = false;
            }

            return {
                xorNode,
                functionType,
                isNameInLocalScope,
                maybeName,
                maybeArguments: inspectInvokeExpressionArguments(nodeIdMapCollection, activeNode, ancestryIndex),
            };
        }
    }

    return undefined;
}

function inspectInvokeExpressionArguments(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    nodeIndex: number,
): InvokeExpressionArgs | undefined {
    // Grab arguments if they exist, else return early.
    const maybeCsvArray: TXorNode | undefined = AncestryUtils.maybePreviousXor(activeNode.ancestry, nodeIndex, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeCsvArray === undefined) {
        return undefined;
    }

    const csvArray: TXorNode = maybeCsvArray;
    const csvNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
        nodeIdMapCollection,
        csvArray.node.id,
    );
    const numArguments: number = csvNodes.length;
    if (numArguments === 0) {
        return undefined;
    }

    const maybeAncestorCsv: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
        activeNode.ancestry,
        nodeIndex,
        2,
        [Ast.NodeKind.Csv],
    );
    const maybePositionArgumentIndex: number | undefined = maybeAncestorCsv?.node.maybeAttributeIndex;

    return {
        numArguments,
        argumentOrdinal: maybePositionArgumentIndex !== undefined ? maybePositionArgumentIndex : 0,
    };
}
