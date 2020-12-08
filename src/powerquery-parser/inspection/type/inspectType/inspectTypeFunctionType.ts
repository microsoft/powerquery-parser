// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TypeScriptUtils } from "../../../common";
import { Ast, Type, TypeUtils } from "../../../language";
import { NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeFunctionType(state: InspectTypeState, xorNode: TXorNode): Type.FunctionType | Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FunctionType);

    const maybeParameters:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
        Ast.NodeKind.ParameterList,
    ]);
    if (maybeParameters === undefined) {
        return Type.UnknownInstance;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeWrappedContent(
        state.nodeIdMapCollection,
        maybeParameters,
        Ast.NodeKind.ArrayWrapper,
    );
    if (maybeArrayWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const parameterTypes: ReadonlyArray<Type.FunctionParameter> = NodeIdMapIterator.iterArrayWrapper(
        state.nodeIdMapCollection,
        maybeArrayWrapper,
    )
        .map((parameter: TXorNode) => TypeUtils.inspectParameter(state.nodeIdMapCollection, parameter))
        .filter(TypeScriptUtils.isDefined);

    const returnType: Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
        isNullable: false,
        parameters: parameterTypes,
        returnType,
    };
}
