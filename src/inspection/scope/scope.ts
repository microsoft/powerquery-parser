// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultKind, ResultUtils } from "../../common";
import { NodeIdMap } from "../../parser";
import { InspectionSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { InspectedIdentifier, tryInspectIdentifier } from "./identifier";
import { InspectedInvokeExpression, inspectInvokeExpression } from "./invokeExpression";

export type InspectedScope = InspectedIdentifier & InspectedInvokeExpression;

export type TriedInspectScope = Result<InspectedScope, CommonError.CommonError>;

export function tryInspectScope(
    settings: InspectionSettings,
    maybeActiveNode: ActiveNode | undefined,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspectScope {
    if (maybeActiveNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: emptyScopeFactory(),
        };
    }
    const activeNode: ActiveNode = maybeActiveNode;

    try {
        const triedInspectIdentifier: Result<InspectedIdentifier, CommonError.CommonError> = tryInspectIdentifier(
            settings,
            maybeActiveNode,
            nodeIdMapCollection,
            leafNodeIds,
        );
        if (ResultUtils.isErr(triedInspectIdentifier)) {
            return triedInspectIdentifier;
        }

        const maybeInspectedInvokeExpression: InspectedInvokeExpression = inspectInvokeExpression(
            activeNode,
            nodeIdMapCollection,
        );

        return ResultUtils.okFactory({
            ...triedInspectIdentifier.value,
            ...maybeInspectedInvokeExpression,
        });
    } catch (err) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(settings.localizationTemplates, err),
        };
    }
}

function emptyScopeFactory(): InspectedScope {
    return {
        scope: new Map(),
        maybeInvokeExpression: undefined,
    };
}
