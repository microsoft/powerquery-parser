// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Ast, AstUtils } from "../..";
import { Assert } from "../../../common";
import { NodeIdMap, NodeIdMapUtils, ParseContext, XorNode, XorNodeKind } from "../../../parser";
import { createPrimitiveType } from "./factories";
import { isCompatible } from "./isCompatible";
import { isEqualType } from "./isEqualType";
import { typeKindFromPrimitiveTypeConstantKind } from "./primitive";

export function typeKindFromLiteralKind(literalKind: Ast.LiteralKind): Type.TypeKind {
    switch (literalKind) {
        case Ast.LiteralKind.List:
            return Type.TypeKind.List;

        case Ast.LiteralKind.Logical:
            return Type.TypeKind.Logical;

        case Ast.LiteralKind.Null:
            return Type.TypeKind.Null;

        case Ast.LiteralKind.Numeric:
            return Type.TypeKind.Number;

        case Ast.LiteralKind.Record:
            return Type.TypeKind.Record;

        case Ast.LiteralKind.Text:
            return Type.TypeKind.Text;

        default:
            throw Assert.isNever(literalKind);
    }
}

export function isTypeInArray(collection: ReadonlyArray<Type.TPowerQueryType>, item: Type.TPowerQueryType): boolean {
    // Fast comparison then deep comparison
    return (
        collection.includes(item) ||
        collection.find((type: Type.TPowerQueryType) => isEqualType(item, type)) !== undefined
    );
}

export function isTypeKind(text: string): text is Type.TypeKind {
    switch (text) {
        case Type.TypeKind.Action:
        case Type.TypeKind.Any:
        case Type.TypeKind.Binary:
        case Type.TypeKind.Date:
        case Type.TypeKind.DateTime:
        case Type.TypeKind.DateTimeZone:
        case Type.TypeKind.Duration:
        case Type.TypeKind.Function:
        case Type.TypeKind.List:
        case Type.TypeKind.Logical:
        case Type.TypeKind.None:
        case Type.TypeKind.NotApplicable:
        case Type.TypeKind.Null:
        case Type.TypeKind.Number:
        case Type.TypeKind.Record:
        case Type.TypeKind.Table:
        case Type.TypeKind.Text:
        case Type.TypeKind.Time:
        case Type.TypeKind.Type:
        case Type.TypeKind.Unknown:
            return true;

        default:
            return false;
    }
}

export function isValidInvocation(
    functionType: Type.DefinedFunction,
    args: ReadonlyArray<Type.TPowerQueryType>,
): boolean {
    // You can't provide more arguments than are on the function signature.
    if (args.length > functionType.parameters.length) {
        return false;
    }

    const parameters: ReadonlyArray<Type.FunctionParameter> = functionType.parameters;
    const numParameters: number = parameters.length;

    for (let index: number = 1; index < numParameters; index += 1) {
        const parameter: Type.FunctionParameter = Assert.asDefined(parameters[index]);
        const maybeArgType: Type.TPowerQueryType | undefined = args[index];

        if (maybeArgType !== undefined) {
            const argType: Type.TPowerQueryType = maybeArgType;
            const parameterType: Type.TPowerQueryType = createPrimitiveType(
                parameter.isNullable,
                Assert.asDefined(parameter.maybeType),
            );

            if (!isCompatible(argType, parameterType)) {
                return false;
            }
        }

        if (!parameter.isOptional) {
            return false;
        }
    }

    return true;
}

export function inspectParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: XorNode<Ast.TParameter>,
): Type.FunctionParameter | undefined {
    switch (parameter.kind) {
        case XorNodeKind.Ast:
            return inspectAstParameter(parameter.node);

        case XorNodeKind.Context:
            return inspectContextParameter(nodeIdMapCollection, parameter.node);

        default:
            throw Assert.isNever(parameter);
    }
}

function inspectAstParameter(node: Ast.TParameter): Type.FunctionParameter {
    let isNullable: boolean;
    let maybeType: Type.TypeKind | undefined;

    const maybeParameterType: Ast.TParameterType | undefined = node.maybeParameterType;
    if (maybeParameterType !== undefined) {
        const parameterType: Ast.TParameterType = maybeParameterType;

        switch (parameterType.kind) {
            case Ast.NodeKind.AsNullablePrimitiveType: {
                const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(parameterType);
                isNullable = simplified.isNullable;
                maybeType = typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
                break;
            }

            case Ast.NodeKind.AsType: {
                const simplified: AstUtils.SimplifiedType = AstUtils.simplifyType(parameterType.paired);
                isNullable = simplified.isNullable;
                maybeType = typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
                break;
            }

            default:
                throw Assert.isNever(parameterType);
        }
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        nameLiteral: node.name.literal,
        isNullable,
        isOptional: node.maybeOptionalConstant !== undefined,
        maybeType,
    };
}

function inspectContextParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: ParseContext.Node,
): Type.FunctionParameter | undefined {
    let isOptional: boolean;
    let isNullable: boolean;
    let maybeType: Type.TypeKind | undefined;

    const maybeName: Ast.Identifier | undefined = NodeIdMapUtils.maybeUnwrapNthChildIfAstChecked(
        nodeIdMapCollection,
        parameter.id,
        1,
        Ast.NodeKind.Identifier,
    );
    if (maybeName === undefined) {
        return undefined;
    }

    const maybeOptional: Ast.TConstant | undefined = NodeIdMapUtils.maybeUnwrapNthChildIfAstChecked(
        nodeIdMapCollection,
        parameter.id,
        0,
        Ast.NodeKind.Constant,
    );
    isOptional = maybeOptional !== undefined;

    const maybeParameterType: Ast.AsNullablePrimitiveType | undefined = NodeIdMapUtils.maybeUnwrapNthChildIfAstChecked(
        nodeIdMapCollection,
        parameter.id,
        2,
        Ast.NodeKind.AsNullablePrimitiveType,
    );
    if (maybeParameterType !== undefined) {
        const parameterType: Ast.AsNullablePrimitiveType = maybeParameterType;
        const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(parameterType);
        isNullable = simplified.isNullable;
        maybeType = typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        nameLiteral: maybeName.literal,
        isOptional,
        isNullable,
        maybeType,
    };
}
