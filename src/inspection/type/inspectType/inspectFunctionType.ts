// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TypeScriptUtils } from "../../../common";
import { Ast } from "../../../language";
import { NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";
import { inspectFromChildAttributeIndex, TypeInspectionState } from "./common";

export function inspectFunctionType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.DefinedFunction> | Type.Unknown {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FunctionType);

    const maybeParameters:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
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

    const parameterTypes: ReadonlyArray<Type.FunctionParameter> = NodeIdMapIterator.arrayWrapperCsvXorNodes(
        state.nodeIdMapCollection,
        maybeArrayWrapper,
    )
        .map((parameter: TXorNode) => TypeUtils.inspectParameter(state.nodeIdMapCollection, parameter))
        .filter(TypeScriptUtils.isDefined);

    const returnType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 2);

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: false,
        primaryType: {
            kind: Type.TypeKind.Function,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
            isNullable: false,
            parameters: parameterTypes,
            returnType,
        },
    };
}
