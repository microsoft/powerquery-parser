// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../../../common";
import { getLocalizationTemplates } from "../../../localization";
import { NodeIdMap, NodeIdMapUtils, TXorNode } from "../../../parser";
import { CommonSettings } from "../../../settings";
import { Type } from "../../../type";
import { TriedType, tryType, TypeCache } from "../tasks";

export function tryTypeCheck(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    maybeTypeCache: TypeCache | undefined = undefined,
): Result<boolean | undefined, CommonError.CommonError> {
    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => {
        const typeCache: TypeCache =
            maybeTypeCache !== undefined ? maybeTypeCache : { scopeById: new Map(), typeById: new Map() };

        const triedType: TriedType = tryType(settings, nodeIdMapCollection, leafNodeIds, nodeId, typeCache);
        if (ResultUtils.isErr(triedType)) {
            throw new CommonError.InvariantError(`failed type check`, { innerError: triedType.error, nodeId });
        }

        return typeCheckXorNode(
            triedType.value,
            NodeIdMapUtils.expectXorNode(nodeIdMapCollection, nodeId),
        );
    });
}
}

function typeCheckXorNode(
    type: Type.TType,
    xorNode: TXorNode,
): boolean | undefined {
    if (type.kind === Type.TypeKind.Any) {
        if (type.maybeExtendedKind === undefined) {
            return true;
        } else if (type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
            const anyChecks: ReadonlyArray<boolean | undefined> = type.unionedTypePairs.map((subtype: Type.TType) => typeCheckXorNode(subtype, xorNode));
            return anyChecks.some((maybeBoolean: boolean | undefined) => maybeBoolean === true);
        } else {
            throw Assert.isNever(type);
        }
    }

}
