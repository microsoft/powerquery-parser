// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from "../../../common";
import { Ast, AstUtils } from "../..";
import { NodeIdMap, NodeIdMapUtils, ParseContext, XorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { Trace, TraceManager } from "../../../common/trace";
import type { InspectedParameter } from "./inspectedParameter";
import { isCompatible } from "./isCompatible";
import { isEqualType } from "./isEqualType";
import { primitiveType } from "./factories";
import { Type } from "..";
import { typeKindFromPrimitiveTypeConstantKind } from "./primitive";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

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
    traceManager: TraceManager,
    correlationId: number | undefined,
): boolean {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.TypeUtils, isValidInvocation.name, correlationId);

    // You can't provide more arguments than are on the function signature.
    if (args.length > functionType.parameters.length) {
        return false;
    }

    const parameters: ReadonlyArray<Type.FunctionParameter> = functionType.parameters;
    const numParameters: number = parameters.length;

    for (let index: number = 1; index < numParameters; index += 1) {
        const parameter: Type.FunctionParameter = ArrayUtils.assertGet(parameters, index);
        const argType: Type.TPowerQueryType | undefined = args[index];

        if (argType !== undefined) {
            const parameterType: Type.TPowerQueryType = primitiveType(
                parameter.isNullable,
                Assert.asDefined(parameter.type),
            );

            if (!isCompatible(argType, parameterType, traceManager, trace.id)) {
                trace.exit();

                return false;
            }
        }

        if (!parameter.isOptional) {
            trace.exit();

            return false;
        }
    }

    trace.exit();

    return true;
}

// Undefined means no name was parsed; Unresolved preserves an annotation requiring further inspection.
export function inspectParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: XorNode<Ast.TParameter>,
): InspectedParameter | undefined {
    switch (parameter.kind) {
        case XorNodeKind.Ast:
            return inspectParameterType(
                parameter.node.name.literal,
                parameter.node.optionalConstant !== undefined,
                parameter.node.parameterType === undefined
                    ? undefined
                    : XorNodeUtils.boxAst(parameter.node.parameterType),
            );

        case XorNodeKind.Context:
            return inspectContextParameter(nodeIdMapCollection, parameter.node);

        default:
            throw Assert.isNever(parameter);
    }
}

function inspectContextParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: ParseContext.Node<Ast.TParameter>,
): InspectedParameter | undefined {
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

    const parameterType: XorNode<Ast.AsType | Ast.AsNullablePrimitiveType> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.AsType | Ast.AsNullablePrimitiveType>(
            nodeIdMapCollection,
            parameter.id,
            2,
            [Ast.NodeKind.AsType, Ast.NodeKind.AsNullablePrimitiveType],
        );

    return inspectParameterType(
        name.literal,
        optionalConstant !== undefined,
        parameterType !== undefined && NodeIdMapUtils.hasParsedToken(nodeIdMapCollection, parameterType.node.id)
            ? parameterType
            : undefined,
    );
}

function inspectParameterType(
    nameLiteral: string,
    isOptional: boolean,
    annotation: XorNode<Ast.AsType | Ast.AsNullablePrimitiveType> | undefined,
): InspectedParameter {
    if (annotation === undefined) {
        return {
            isTypeResolved: true,
            nameLiteral,
            isOptional,
            isNullable: true,
            type: undefined,
        };
    }

    let simplified: AstUtils.SimplifiedType | undefined;

    if (XorNodeUtils.isAst(annotation)) {
        simplified =
            annotation.node.kind === Ast.NodeKind.AsType
                ? AstUtils.simplifyType(annotation.node.paired)
                : AstUtils.simplifyAsNullablePrimitiveType(annotation.node);
    }

    if (simplified === undefined) {
        return {
            isTypeResolved: false,
            nameLiteral,
            isOptional,
            annotation,
        };
    }

    return {
        isTypeResolved: true,
        nameLiteral,
        isOptional,
        isNullable: simplified.isNullable,
        type: typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind),
    };
}
