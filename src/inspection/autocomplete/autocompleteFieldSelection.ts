// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../../common";
import { Ast, Type } from "../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode } from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";

export type TriedAutocompleteFieldSelection = Result<ReadonlyArray<string>, CommonError.CommonError>;

export function autocompleteFieldSelection(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): ReadonlyArray<string> {
    const maybeSelector: TXorNode | undefined = maybeFieldSelector(activeNode);
    if (maybeSelector === undefined) {
        return [];
    }
    const fieldSelector: TXorNode = maybeSelector;

    const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
        nodeIdMapCollection,
        fieldSelector.node.id,
    );

    const triedType: TriedType = tryType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        previousSibling.node.id,
        typeCache,
    );
    if (ResultUtils.isErr(triedType)) {
        throw triedType.error;
    }
    const type: Type.TType = triedType.value;

    if (
        !(type.kind === Type.TypeKind.Record && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedRecord) &&
        !(type.kind === Type.TypeKind.Table && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedTable)
    ) {
        return [];
    }

    return [...type.fields.keys()];
}

function maybeFieldSelector(activeNode: ActiveNode): TXorNode | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;

    if (numNodes <= 1) {
        return undefined;
    }

    for (let index: number = 1; index < numNodes; index += 1) {
        const parent: TXorNode = ancestry[index];
        const child: TXorNode = ancestry[index - 1];

        if (parent.node.kind === Ast.NodeKind.FieldSelector && child.node.maybeAttributeIndex === 1) {
            return parent;
        }
    }

    return undefined;
}
