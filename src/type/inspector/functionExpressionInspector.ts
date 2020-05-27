// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type, TypeUtils } from "..";
import { CommonError } from "../../common";
import { Ast, AstUtils } from "../../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../../parser";

export interface InspectedFunctionExpression {
    readonly parameters: ReadonlyArray<InspectedFunctionParameter>;
    readonly returnType: Type.TType;
}

export interface InspectedFunctionParameter extends Type.FunctionParameter {
    readonly id: number;
    readonly name: Ast.Identifier;
}

export function inspectFunctionExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): InspectedFunctionExpression {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        fnExpr,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    const examinedParameters: InspectedFunctionParameter[] = [];
    // Iterates all parameters as TXorNodes if they exist, otherwise early exists from an empty list.
    for (const parameter of functionParameterXorNodes(nodeIdMapCollection, fnExpr)) {
        // A parameter isn't examinable if it doesn't have an Ast.Identifier for its name.
        const maybeName: Ast.Identifier | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
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
                name: maybeName,
            });
        }
    }

    const maybeReturnType: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
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
    const maybeParameterList: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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
        : NodeIdMapIterator.arrayWrapperCsvXorNodes(nodeIdMapCollection, maybeWrappedContent);
}
