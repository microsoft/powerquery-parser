// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type, TypeUtils } from "..";
import { CommonError, isNever } from "../../common";
import { Ast, NodeIdMap, NodeIdMapIter, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../../parser";

export interface InspectedFunctionExpression {
    readonly parameters: ReadonlyArray<InspectedFunctionParameter>;
    readonly isReturnNullable: boolean;
    readonly returnType: Type.TypeKind;
}

export interface InspectedFunctionParameter {
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: undefined | Type.TypeKind;
}

export function inspectFunctionExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): InspectedFunctionExpression {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
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
        const maybeExaminable: undefined | InspectedFunctionParameter = examineParameter(
            nodeIdMapCollection,
            parameter,
        );
        if (maybeExaminable !== undefined) {
            examinedParameters.push(maybeExaminable);
        }
    }

    const maybeReturnType: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        fnExpr.node.id,
        1,
        [Ast.NodeKind.AsNullablePrimitiveType],
    );

    let isReturnNullable: boolean;
    let returnType: Type.TypeKind;
    if (maybeReturnType !== undefined) {
        const simplified: Type.SimplifiedNullablePrimitiveType = TypeUtils.simplifyNullablePrimitiveType(
            maybeReturnType as Ast.AsNullablePrimitiveType,
        );
        isReturnNullable = simplified.isNullable;
        returnType = simplified.typeKind;
    } else {
        isReturnNullable = true;
        returnType = Type.TypeKind.Any;
    }

    return {
        parameters: examinedParameters,
        isReturnNullable,
        returnType,
    };
}

function functionParameterXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeParameterList: undefined | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        fnExpr.node.id,
        0,
        [Ast.NodeKind.ParameterList],
    );
    if (maybeParameterList === undefined) {
        return [];
    }
    const maybeWrappedContent: undefined | TXorNode = NodeIdMapUtils.maybeWrappedContent(
        nodeIdMapCollection,
        maybeParameterList,
    );

    return maybeWrappedContent === undefined
        ? []
        : NodeIdMapIter.arrayWrapperXorNodes(nodeIdMapCollection, maybeWrappedContent);
}

function examineParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: TXorNode,
): undefined | InspectedFunctionParameter {
    switch (parameter.kind) {
        case XorNodeKind.Ast:
            return examineAstParameter(parameter.node as Ast.IParameter<Ast.AsNullablePrimitiveType>);

        case XorNodeKind.Context:
            return examineContextParameter(nodeIdMapCollection, parameter.node);

        default:
            throw isNever(parameter);
    }
}

function examineAstParameter(node: Ast.IParameter<Ast.AsNullablePrimitiveType>): InspectedFunctionParameter {
    let isNullable: boolean;
    let maybeType: undefined | Type.TypeKind;

    const maybeParameterType: Ast.AsNullablePrimitiveType | undefined = node.maybeParameterType;
    if (maybeParameterType !== undefined) {
        const simplified: Type.SimplifiedNullablePrimitiveType = TypeUtils.simplifyNullablePrimitiveType(
            maybeParameterType,
        );
        isNullable = simplified.isNullable;
        maybeType = simplified.typeKind;
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        name: node.name,
        isOptional: node.maybeOptionalConstant !== undefined,
        isNullable,
        maybeType,
    };
}

function examineContextParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: ParseContext.Node,
): undefined | InspectedFunctionParameter {
    let name: Ast.Identifier;
    let isOptional: boolean;
    let isNullable: boolean;
    let maybeType: undefined | Type.TypeKind;

    const maybeName: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        1,
        [Ast.NodeKind.Identifier],
    );
    if (maybeName === undefined) {
        return undefined;
    }
    name = maybeName as Ast.Identifier;

    const maybeOptional: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        0,
        [Ast.NodeKind.Constant],
    );
    isOptional = maybeOptional !== undefined;

    const maybeParameterType: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        2,
        undefined,
    );
    if (maybeParameterType !== undefined) {
        const parameterType: Ast.AsNullablePrimitiveType = maybeParameterType as Ast.AsNullablePrimitiveType;
        const simplified: Type.SimplifiedNullablePrimitiveType = TypeUtils.simplifyNullablePrimitiveType(parameterType);
        isNullable = simplified.isNullable;
        maybeType = simplified.typeKind;
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        name,
        isOptional,
        isNullable,
        maybeType,
    };
}
