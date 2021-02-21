// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "../../../language";
import { TXorNode, XorNodeUtils } from "../../../parser";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeEachExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.EachExpression);

    const expressionType: Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);

    return TypeUtils.definedFunctionFactory(
        false,
        [{ isNullable: false, isOptional: false, maybeType: Type.TypeKind.Any, nameLiteral: "_" }],
        expressionType,
    );
}
