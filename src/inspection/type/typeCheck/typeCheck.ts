// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../../../common";
import { getLocalizationTemplates } from "../../../localization";
import { NodeIdMap } from "../../../parser";
import { CommonSettings } from "../../../settings";
import { Type } from "../../../type";
import { TriedType, tryType, TypeCache } from "../tasks";

export function tryTypeCheckNode(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    right: Type.TType,
    maybeTypeCache: TypeCache | undefined = undefined,
): Result<boolean | undefined, CommonError.CommonError> {
    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => {
        const typeCache: TypeCache =
            maybeTypeCache !== undefined ? maybeTypeCache : { scopeById: new Map(), typeById: new Map() };

        const triedType: TriedType = tryType(settings, nodeIdMapCollection, leafNodeIds, nodeId, typeCache);
        if (ResultUtils.isErr(triedType)) {
            throw new CommonError.InvariantError(`failed type check`, { innerError: triedType.error, nodeId });
        }

        return typeCheck(triedType.value, right);
    });
}

// Returns `${left} is ${right}. Eg.
// `Type.TextInstance is Type.AnyInstance` -> true
// `Type.AnyInstance is Type.TextInstance` -> false
// `Type.NullInstance is Type.AnyNonNull` -> false
// `Type.TextInstance is Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function typeCheck(left: Type.TType, right: Type.TType): boolean | undefined {
    if (
        left.kind === Type.TypeKind.NotApplicable ||
        left.kind === Type.TypeKind.Unknown ||
        right.kind === Type.TypeKind.NotApplicable ||
        right.kind === Type.TypeKind.Unknown
    ) {
        return undefined;
    } else if (left.kind === Type.TypeKind.Null && right.kind === Type.TypeKind.AnyNonNull) {
        return false;
    }

    switch (right.kind) {
        case Type.TypeKind.Action:
        case Type.TypeKind.Binary:
        case Type.TypeKind.Date:
        case Type.TypeKind.DateTime:
        case Type.TypeKind.DateTimeZone:
        case Type.TypeKind.Duration:
            return checkKindAndNull(left, right);

        case Type.TypeKind.Any:
            return checkAny(left, right);

        case Type.TypeKind.AnyNonNull:
            return checkAnyNonNull(left, right);

        default:
            throw new Error("TODO");
    }
}

function checkAny(left: Type.TType, right: Type.Any | Type.AnyUnion): boolean | undefined {
    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.AnyUnion:
            const anyChecks: ReadonlyArray<boolean | undefined> = right.unionedTypePairs.map((subtype: Type.TType) =>
                typeCheck(left, subtype),
            );
            return anyChecks.some((maybeBoolean: boolean | undefined) => maybeBoolean === true);

        default:
            throw Assert.isNever(right);
    }
}

function checkAnyNonNull(left: Type.TType, _right: Type.AnyNonNull): boolean | undefined {
    return left.kind !== Type.TypeKind.Null;
}

function checkKindAndNull(left: Type.TType, right: Type.TType): boolean {
    return left.kind === right.kind || (right.isNullable === true && left.kind === Type.TypeKind.Null);
}
