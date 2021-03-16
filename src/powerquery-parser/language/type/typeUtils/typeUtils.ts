// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Ast, AstUtils } from "../..";
import { ArrayUtils, Assert, CommonError } from "../../../common";
import { NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../../../parser";
import { primitiveTypeFactory } from "./factories";
import { isCompatible } from "./isCompatible";
import { isEqualType } from "./isEqualType";
import { typeKindFromPrimitiveTypeConstantKind } from "./primitive";

export function simplify(types: ReadonlyArray<Type.PqType>): ReadonlyArray<Type.PqType> {
    const byKind: TypeCollectionByKind = categorizeByKind(types);

    // If an Any primitive exists then return it. Prioritize nullable any.
    const maybeAnyPrimitives: ReadonlyArray<Type.PqType> | undefined = byKind.get(Type.TypeKind.Any)?.get(undefined);
    if (maybeAnyPrimitives !== undefined) {
        return [resolvePrimitiveIsNullable(maybeAnyPrimitives as ReadonlyArray<Type.Any>)];
    }

    for (const [kind, kindCollection] of byKind.entries()) {
        if (kind === Type.TypeKind.Any) {
            if (kindCollection.)
        }

        for (const extendedKindCollection of kindCollection.values()) {

        }
        simplifyByExtendedKind
    }

    const anyUnionTypes: Type.AnyUnion[] = [];
    const notAnyUnionTypes: Type.PqType[] = [];

    for (const byExtendedKind of byKind.values()) {
        for (const [extendedKind, extendedKindTypes] of byExtendedKind.entries()) {
            if (extendedKind === Type.ExtendedTypeKind.AnyUnion) {
                anyUnionTypes.push(...(extendedKindTypes as Type.AnyUnion[]));
            } else {
                notAnyUnionTypes.push(...extendedKindTypes);
            }
        }
    }

    if (anyUnionTypes.length === 0) {
        return notAnyUnionTypes;
    }

    // Merge the return of dedupeAnyUnions and notAnyUnionTypes.
    const dedupedAnyUnion: Type.PqType = dedupeAnyUnions(anyUnionTypes);
    if (dedupedAnyUnion.kind === Type.TypeKind.Any && dedupedAnyUnion.maybeExtendedKind === undefined) {
        return [Type.AnyInstance];
    }

    // dedupedAnyUnion is an AnyUnion.
    // Since the return will contain an anyUnion we should merge all notAnyUnionTypes into the AnyUnion.
    if (dedupedAnyUnion.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
        let isNullableEncountered: boolean = false;
        const typesNotInDedupedAnyUnion: Type.PqType[] = [];

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

/*
export function dedupe(types: ReadonlyArray<Type.PqType>): ReadonlyArray<Type.PqType> {
    const anyUnionTypes: Type.AnyUnion[] = [];
    const notAnyUnionTypes: Type.PqType[] = [];

    for (const item of types) {
        if (item.kind === Type.TypeKind.Any) {
            switch (item.maybeExtendedKind) {
                case undefined:
                    return [Type.AnyInstance];

                case Type.ExtendedTypeKind.AnyUnion:
                    if (!isTypeInArray(anyUnionTypes, item)) {
                        anyUnionTypes.push(item);
                    }
                    break;

                default:
                    throw Assert.isNever(item);
            }
        } else if (!isTypeInArray(notAnyUnionTypes, item)) {
            notAnyUnionTypes.push(item);
        }
    }

    if (anyUnionTypes.length === 0) {
        return notAnyUnionTypes;
    }

    // Merge the return of dedupeAnyUnions and notAnyUnionTypes.
    const dedupedAnyUnion: Type.PqType = dedupeAnyUnions(anyUnionTypes);
    if (dedupedAnyUnion.kind === Type.TypeKind.Any && dedupedAnyUnion.maybeExtendedKind === undefined) {
        return [Type.AnyInstance];
    }

    // dedupedAnyUnion is an AnyUnion.
    // Since the return will contain an anyUnion we should merge all notAnyUnionTypes into the AnyUnion.
    if (dedupedAnyUnion.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion) {
        let isNullableEncountered: boolean = false;
        const typesNotInDedupedAnyUnion: Type.PqType[] = [];

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
*/

// Combines all given AnyUnions into either:
//  * a single AnyUnion
//  * a single Type.PqType that is not an AnyUnion
// The first case is the most common.
// The second happens if several AnyUnion consist only of one unique type, then it should be simplified to that type.
export function dedupeAnyUnions(anyUnions: ReadonlyArray<Type.AnyUnion>): Type.PqType {
    const simplified: Type.PqType[] = [];
    let isNullable: boolean = false;

    for (const anyUnion of anyUnions) {
        for (const type of flattenAnyUnion(anyUnion)) {
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
export function flattenAnyUnion(anyUnion: Type.AnyUnion): ReadonlyArray<Type.PqType> {
    let newUnionedTypePairs: Type.PqType[] = [];

    for (const item of anyUnion.unionedTypePairs) {
        // If it's an Any primitive then we can do an early return.
        // Else it's an AnyUnion so continue flattening the types.
        if (item.kind === Type.TypeKind.Any) {
            switch (item.maybeExtendedKind) {
                case undefined:
                    return [Type.AnyInstance];

                case Type.ExtendedTypeKind.AnyUnion:
                    newUnionedTypePairs = newUnionedTypePairs.concat(flattenAnyUnion(item));
                    break;

                default:
                    throw Assert.isNever(item);
            }
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

export function isTypeInArray(collection: ReadonlyArray<Type.PqType>, item: Type.PqType): boolean {
    // Fast comparison then deep comparison
    return collection.includes(item) || collection.find((type: Type.PqType) => isEqualType(item, type)) !== undefined;
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

export function isValidInvocation(functionType: Type.DefinedFunction, args: ReadonlyArray<Type.PqType>): boolean {
    // You can't provide more arguments than are on the function signature.
    if (args.length > functionType.parameters.length) {
        return false;
    }

    const parameters: ReadonlyArray<Type.FunctionParameter> = functionType.parameters;
    const numParameters: number = parameters.length;

    for (let index: number = 1; index < numParameters; index += 1) {
        const parameter: Type.FunctionParameter = Assert.asDefined(parameters[index]);
        const maybeArgType: Type.PqType | undefined = args[index];

        if (maybeArgType !== undefined) {
            const argType: Type.PqType = maybeArgType;
            const parameterType: Type.PqType = primitiveTypeFactory(
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

type TypeCollectionByKind = Map<Type.TypeKind, TypeCollectionByExtendedKind>;
type TypeCollectionByExtendedKind = Map<Type.ExtendedTypeKind | undefined, Type.PqType[]>;

function categorizeByKind(types: ReadonlyArray<Type.PqType>): TypeCollectionByKind {
    const result: TypeCollectionByKind = new Map();

    for (const type of types) {
        const maybeExtendedCollection: TypeCollectionByExtendedKind | undefined = result.get(type.kind);

        if (maybeExtendedCollection === undefined) {
            result.set(type.kind, new Map([[type.maybeExtendedKind, [type]]]));
        } else {
            const extendedCollection: TypeCollectionByExtendedKind = maybeExtendedCollection;
            const maybeCollection: Type.PqType[] | undefined = extendedCollection.get(type.maybeExtendedKind);

            if (maybeCollection === undefined) {
                extendedCollection.set(type.maybeExtendedKind, [type]);
            } else if (isTypeInArray(maybeCollection, type)) {
                maybeCollection.push(type);
            }
        }
    }

    return result;
}

// If at least one primitive exists then return that,
// else dedupe the array.
function simplifyAnyUnion(byExtendedKind: TypeCollectionByExtendedKind): Type.PqType {
    const allTypes: Type.PqType[] = [];

    for (const [extendedKind, collection] of byExtendedKind.entries()) {
        switch (extendedKind) {
            case Type.ExtendedTypeKind.AnyUnion:
                allTypes.push(...dedupe(collection));
                break;

            case undefined:
                return resolvePrimitiveIsNullable(collection as ReadonlyArray<Type.TPrimitiveType>)

            default:
                throw Assert.isNever(extendedKind)
        }
    }

    if (allTypes.length === 1) {
        return allTypes[0];
    }

    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: allTypes.find((PqType: Type.PqType) => PqType.isNullable === true) !== undefined,
        unionedTypePairs: allTypes,
    };
}

// If at least one primitive exists then return that,
// else dedupe the array.
function simplifyByExtendedKind(byExtendedKind: TypeCollectionByExtendedKind): Type.PqType {
    const primitives: ReadonlyArray<Type.PqType> | undefined = byExtendedKind.get(undefined);
    if (primitives !== undefined) {
        return resolvePrimitiveIsNullable(primitives as ReadonlyArray<Type.TPrimitiveType>);
    }

    const allTypes: Type.PqType[] = [];
    for (const collection of byExtendedKind.values()) {
        allTypes.push(...dedupe(collection));
    }

    if (allTypes.length === 1) {
        return allTypes[0];
    }

    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: allTypes.find((PqType: Type.PqType) => PqType.isNullable === true) !== undefined,
        unionedTypePairs: allTypes,
    };
}

function dedupe(collection: ReadonlyArray<Type.PqType>): ReadonlyArray<Type.PqType> {
    const result: Type.PqType[] = [];

    for (const type of collection) {
        if (!isTypeInArray(collection, type)) {
            result.push(type);
        }
    }

    return result;
}

// function maybeFindAnyPrimitive(byKind: TypeCollectionByKind): Type.PqType | undefined {
//     const maybeAnyPrimitives: Type.PqType[] | undefined = byKind.get(Type.TypeKind.Any)?.get(undefined);
//     if (maybeAnyPrimitives === undefined) {
//         return undefined;
//     }

//     // At least one Any primitive exists, but we need to resolve if it's an AnyInstance or AnyNonNullInstance.
//     let nonNullableAnyPrimitive: Type.PqType | undefined;

//     for (const anyPrimitive of maybeAnyPrimitives) {
//         if (anyPrimitive.isNullable) {
//             return anyPrimitive;
//         } else {
//             nonNullableAnyPrimitive = anyPrimitive;
//         }
//     }

//     return Assert.asDefined(
//         nonNullableAnyPrimitive,
//         `maybeAnyPrimitives should only be truthy if it has a non-zero length`,
//     );
// }

// Prioritize returning isNullable instance, otherwise return first element.
// Assummes TypeKind is equal for all elements.
function resolvePrimitiveIsNullable(types: ReadonlyArray<Type.TPrimitiveType>): Type.TPrimitiveType {
    return types.find(type => type.isNullable) ?? ArrayUtils.assertGet(types, 0, `assumes types has non-zero length`);
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

    const maybeName: Ast.TNode | undefined = NodeIdMapUtils.maybeChildAstByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        1,
        [Ast.NodeKind.Identifier],
    );
    if (maybeName === undefined) {
        return undefined;
    }

    const maybeOptional: Ast.TNode | undefined = NodeIdMapUtils.maybeChildAstByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        0,
        [Ast.NodeKind.Constant],
    );
    isOptional = maybeOptional !== undefined;

    const maybeParameterType: Ast.TNode | undefined = NodeIdMapUtils.maybeChildAstByAttributeIndex(
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
        nameLiteral: (maybeName as Ast.Identifier).literal,
        isOptional,
        isNullable,
        maybeType,
    };
}
