// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert } from "../../common";
import { Ast, AstUtils } from "../../language";
import { NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../../parser";
import { isTypeInArray } from "./isEqualType";
import { typeKindFromPrimitiveTypeConstantKind } from "./primitive";

export function dedupe(types: ReadonlyArray<Type.TType>): ReadonlyArray<Type.TType> {
    const anyUnionTypes: Type.AnyUnion[] = [];
    const notAnyUnionTypes: Type.TType[] = [];

    for (const item of types) {
        if (item.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
            if (!isTypeInArray(anyUnionTypes, item)) {
                anyUnionTypes.push(item);
            }
        } else if (!isTypeInArray(notAnyUnionTypes, item)) {
            notAnyUnionTypes.push(item);
        }
    }

    if (anyUnionTypes.length === 0) {
        return notAnyUnionTypes;
    }

    // Merge the return of dedupeAnyUnions and notAnyUnionTypes.
    const dedupedAnyUnion: Type.TType = dedupeAnyUnions(anyUnionTypes);

    // dedupedAnyUnion is an AnyUnion.
    // Since the return will contain an anyUnion we should merge all notAnyUnionTypes into the AnyUnion.
    if (dedupedAnyUnion.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
        let isNullableEncountered: boolean = false;
        const typesNotInDedupedAnyUnion: Type.TType[] = [];

        for (const item of notAnyUnionTypes) {
            if (!isTypeInArray(dedupedAnyUnion.unionedTypePairs, item)) {
                if (item.isNullable) {
                    isNullableEncountered = true;
                }
                typesNotInDedupedAnyUnion.push(item);
            }
        }

        return [
            {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: isNullableEncountered,
                unionedTypePairs: [...dedupedAnyUnion.unionedTypePairs, ...typesNotInDedupedAnyUnion],
            },
        ];
    }
    // dedupedAnyUnion is not an AnyUnion.
    // Merge dedupedAnyUnion into notAnyUnionTypes.
    else {
        if (!isTypeInArray(notAnyUnionTypes, dedupedAnyUnion)) {
            notAnyUnionTypes.push(dedupedAnyUnion);
        }

        return notAnyUnionTypes;
    }
}

// Combines all given AnyUnions into either:
//  * a single AnyUnion
//  * a single Type.TType that is not an AnyUnion
// The first case is the most common.
// The second happens if several AnyUnion consist only of one unique type, then it should be simplified to that type.
export function dedupeAnyUnions(anyUnions: ReadonlyArray<Type.AnyUnion>): Type.TType {
    const simplified: Type.TType[] = [];
    let isNullable: boolean = false;

    for (const anyUnion of anyUnions) {
        for (const type of flattenUnionedTypePairs(anyUnion)) {
            if (type.isNullable === true) {
                isNullable = true;
            }
            if (!isTypeInArray(simplified, type)) {
                simplified.push(type);
            }
        }
    }

    // Second case
    if (simplified.length === 1) {
        return simplified[0];
    }

    // First Case
    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable,
        unionedTypePairs: simplified,
    };
}

// Recursively flattens out all unionedTypePairs into an array.
export function flattenUnionedTypePairs(anyUnion: Type.AnyUnion): ReadonlyArray<Type.TType> {
    let newUnionedTypePairs: Type.TType[] = [];

    for (const item of anyUnion.unionedTypePairs) {
        if (item.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
            newUnionedTypePairs = newUnionedTypePairs.concat(flattenUnionedTypePairs(item));
        } else {
            newUnionedTypePairs.push(item);
        }
    }

    return newUnionedTypePairs;
}

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

export function inspectParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: TXorNode,
): Type.FunctionParameter | undefined {
    switch (parameter.kind) {
        case XorNodeKind.Ast:
            return inspectAstParameter(parameter.node as Ast.TParameter);

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

    const maybeName: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        1,
        [Ast.NodeKind.Identifier],
    );
    if (maybeName === undefined) {
        return undefined;
    }

    const maybeOptional: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        0,
        [Ast.NodeKind.Constant],
    );
    isOptional = maybeOptional !== undefined;

    const maybeParameterType: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        2,
        undefined,
    );
    if (maybeParameterType !== undefined) {
        const parameterType: Ast.AsNullablePrimitiveType = maybeParameterType as Ast.AsNullablePrimitiveType;
        const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(parameterType);
        isNullable = simplified.isNullable;
        maybeType = typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        isOptional,
        isNullable,
        maybeType,
    };
}
