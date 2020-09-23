// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type, TypeUtils } from "..";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Ast, AstUtils } from "../../ast";

export interface InspectedFunctionExpression {
    readonly parameters: ReadonlyArray<InspectedFunctionParameter>;
    readonly returnType: Type.TType;
}

export interface InspectedFunctionParameter extends Type.FunctionParameter {
    readonly id: number;
}

export function inspectFunctionExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): InspectedFunctionExpression {
    XorNodeUtils.assertAstNodeKind(fnExpr, Ast.NodeKind.FunctionExpression);

    const examinedParameters: InspectedFunctionParameter[] = [];
    // Iterates all parameters as TXorNodes if they exist, otherwise early exists from an empty list.
    for (const parameter of functionParameterXorNodes(nodeIdMapCollection, fnExpr)) {
        // A parameter isn't examinable if it doesn't have an Ast.Identifier for its name.
        const maybeName: Ast.Identifier | undefined = NodeIdMapUtils.maybeChildAstByAttributeIndex(
            nodeIdMapCollection,
            parameter.node.id,
            1,
            [Ast.NodeKind.Identifier],
        ) as Ast.Identifier;
        if (maybeName === undefined) {
            break;
        }

        const maybeExaminable: Type.FunctionParameter | undefined = TypeUtils.inspectParameter(
            nodeIdMapCollection,
            parameter,
        );
        if (maybeExaminable !== undefined) {
            examinedParameters.push({
                ...maybeExaminable,
                id: parameter.node.id,
                name: maybeName.literal,
            });
        }
    }

    const maybeReturnType: Ast.TNode | undefined = NodeIdMapUtils.maybeChildAstByAttributeIndex(
        nodeIdMapCollection,
        fnExpr.node.id,
        1,
        [Ast.NodeKind.AsNullablePrimitiveType],
    );

    let isReturnNullable: boolean;
    let returnType: Type.TypeKind;
    if (maybeReturnType !== undefined) {
        const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(
            maybeReturnType as Ast.AsNullablePrimitiveType,
        );
        isReturnNullable = simplified.isNullable;
        returnType = TypeUtils.typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
    } else {
        isReturnNullable = true;
        returnType = Type.TypeKind.Any;
    }

    return {
        parameters: examinedParameters,
        returnType: {
            kind: returnType,
            maybeExtendedKind: undefined,
            isNullable: isReturnNullable,
        },
    };
}

function functionParameterXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeParameterList: TXorNode | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        fnExpr.node.id,
        0,
        [Ast.NodeKind.ParameterList],
    );
    if (maybeParameterList === undefined) {
        return [];
    }
    const maybeWrappedContent: TXorNode | undefined = NodeIdMapUtils.maybeArrayWrapperContent(
        nodeIdMapCollection,
        maybeParameterList,
    );

    return maybeWrappedContent === undefined
        ? []
        : NodeIdMapIterator.iterArrayWrapper(nodeIdMapCollection, maybeWrappedContent);
}
