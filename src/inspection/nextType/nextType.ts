// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../../common";
import { getLocalizationTemplates } from "../../localization";
import { AncestryUtils, NodeIdMap, NodeIdMapIterator, TXorNode } from "../../parser";
import { CommonSettings } from "../../settings";
import { expectedNextType, Type } from "../../type";

export function tryNextType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeId: number,
): Result<Type.TType | undefined, CommonError.CommonError> {
    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () =>
        widestType(nodeIdMapCollection.childIdsById, AncestryUtils.expectAncestry(nodeIdMapCollection, leafNodeId)),
    );
}

// Traverse up the ancestry so long as the node is an only child.
// Along the way find what type is expected as the nth child of a node's kind.
// The last type generated this way should have the widest typing,
// which then can be used for type hinting.
export function widestType(
    childIdsById: NodeIdMap.ChildIdsById,
    ancestry: ReadonlyArray<TXorNode>,
): Type.TType | undefined {
    const upperBound: number = ancestry.length - 2;
    let bestMatch: Type.TType | undefined;

    for (let index: number = 0; index < upperBound; index += 1) {
        const parent: TXorNode = ancestry[index + 1];
        const child: TXorNode = ancestry[index];

        if (NodeIdMapIterator.expectChildIds(childIdsById, parent.node.id).length > 1) {
            continue;
        }

        if (child.node.maybeAttributeIndex === undefined) {
            throw new CommonError.InvariantError(`Expected child to have an attribute index.`);
        }

        const allowedType: Type.TType = expectedNextType(parent, child.node.maybeAttributeIndex);
        if (allowedType.kind !== Type.TypeKind.NotApplicable) {
            bestMatch = allowedType;
        }
    }

    return bestMatch;
}
