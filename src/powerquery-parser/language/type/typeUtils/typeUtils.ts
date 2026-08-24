// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils } from "../..";
import { NodeIdMap, NodeIdMapUtils, ParseContext, XorNode, XorNodeKind } from "../../../parser";
import { Assert } from "../../../common";
import { isEqualType } from "./isEqualType";
import { primitiveType } from "./factories";
import { Type } from "..";
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
    const isOptional: boolean = node.optionalConstant !== undefined;
    let type: Type.TPowerQueryType | undefined;

    const parameterType: Ast.TParameterType | undefined = node.parameterType;

    if (parameterType !== undefined) {
        let simplified: AstUtils.SimplifiedType;

        switch (parameterType.kind) {
            case Ast.NodeKind.AsNullablePrimitiveType:
                simplified = AstUtils.simplifyAsNullablePrimitiveType(parameterType);
                break;

            case Ast.NodeKind.AsType:
                simplified = AstUtils.simplifyType(parameterType.paired);
                break;

            default:
                throw Assert.isNever(parameterType);
        }

        // D2: an omitted optional argument is equivalent to passing `null`, so `isOptional`
        // implies nullable regardless of how the parameter was ascribed in source.
        type = primitiveType(
            simplified.isNullable || isOptional,
            typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind),
        );
    } else {
        type = undefined;
    }

    return {
        nameLiteral: node.name.literal,
        isOptional,
        type,
    };
}

function inspectContextParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: ParseContext.Node<Ast.TParameter>,
): Type.FunctionParameter | undefined {
    let type: Type.TPowerQueryType | undefined;

    const name: Ast.Identifier | undefined = NodeIdMapUtils.nthChildAstChecked(
        nodeIdMapCollection,
        parameter.id,
        1,
        Ast.NodeKind.Identifier,
    );

    if (name === undefined) {
        return undefined;
    }

    const optionalConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked(
        nodeIdMapCollection,
        parameter.id,
        0,
        Ast.NodeKind.Constant,
    );

    const isOptional: boolean = optionalConstant !== undefined;

    const parameterType: Ast.AsNullablePrimitiveType | undefined = NodeIdMapUtils.nthChildAstChecked(
        nodeIdMapCollection,
        parameter.id,
        2,
        Ast.NodeKind.AsNullablePrimitiveType,
    );

    if (parameterType !== undefined) {
        const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(parameterType);

        // D2: an omitted optional argument is equivalent to passing `null`, so `isOptional`
        // implies nullable regardless of how the parameter was ascribed in source.
        type = primitiveType(
            simplified.isNullable || isOptional,
            typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind),
        );
    } else {
        type = undefined;
    }

    return {
        nameLiteral: name.literal,
        isOptional,
        type,
    };
}
