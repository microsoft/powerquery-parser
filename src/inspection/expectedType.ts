// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../common";
import { getLocalizationTemplates } from "../localization";
import { TXorNode, XorNodeKind } from "../parser";
import { CommonSettings } from "../settings";
import { expectedType, Type } from "../type";
import { ActiveNode, ActiveNodeLeafKind } from "./activeNode";

export type TriedExpectedType = Result<Type.TType | undefined, CommonError.CommonError>;

export function tryExpectedType(settings: CommonSettings, activeNode: ActiveNode): TriedExpectedType {
    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => maybeExpectedType(activeNode));
}

// Traverse up the ancestry so long as the node is an only child.
// Along the way find what type is expected as the nth child of a node's kind.
// The last type generated this way should have the widest typing,
// which then can be used for type hinting.
export function maybeExpectedType(activeNode: ActiveNode): Type.TType | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const upperBound: number = ancestry.length - 1;
    let bestMatch: Type.TType | undefined;

    for (let index: number = 0; index < upperBound; index += 1) {
        const parent: TXorNode = ancestry[index + 1];
        const child: TXorNode = ancestry[index];

        Assert.isDefined(child.node.maybeAttributeIndex, `Expected child to have an attribute index.`, {
            childId: child.node.id,
        });
        const attributeIndex: number =
            parent.kind === XorNodeKind.Ast && activeNode.leafKind === ActiveNodeLeafKind.AfterAst
                ? child.node.maybeAttributeIndex + 1
                : child.node.maybeAttributeIndex;

        const allowedType: Type.TType = expectedType(parent, attributeIndex);
        if (allowedType.kind !== Type.TypeKind.NotApplicable) {
            bestMatch = allowedType;
        }
    }

    return bestMatch;
}
