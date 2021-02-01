// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Constant } from "../..";
import { Assert, StringUtils } from "../../../common";

export function nameOf(type: Type.TType): string {
    switch (type.maybeExtendedKind) {
        case Type.ExtendedTypeKind.NumberLiteral:
        case Type.ExtendedTypeKind.TextLiteral:
            return prefixNullableIfRequired(type, `"${type.literal}"`);

        case Type.ExtendedTypeKind.AnyUnion:
            return type.unionedTypePairs.map((subtype: Type.TType) => nameOf(subtype)).join(" | ");

        case Type.ExtendedTypeKind.DefinedFunction:
            return prefixNullableIfRequired(type, nameOfFunctionSignature(type, true));

        case Type.ExtendedTypeKind.DefinedList:
            return prefixNullableIfRequired(type, `{${nameOfIterable(type.elements)}}`);

        case Type.ExtendedTypeKind.DefinedListType:
            return prefixNullableIfRequired(type, `type {${nameOfIterable(type.itemTypes)}}`);

        case Type.ExtendedTypeKind.DefinedRecord:
            return prefixNullableIfRequired(type, nameOfFieldSpecificationList(type));

        case Type.ExtendedTypeKind.DefinedTable:
            return prefixNullableIfRequired(type, `table ${nameOfFieldSpecificationList(type)}`);

        case Type.ExtendedTypeKind.FunctionType:
            return prefixNullableIfRequired(type, `type function ${nameOfFunctionSignature(type, false)}`);

        case Type.ExtendedTypeKind.ListType:
            return prefixNullableIfRequired(type, `type {${nameOf(type.itemType)}}`);

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return prefixNullableIfRequired(type, `type ${nameOf(type.primitiveType)}`);

        case Type.ExtendedTypeKind.RecordType:
            return prefixNullableIfRequired(type, `type ${nameOfFieldSpecificationList(type)}`);

        case Type.ExtendedTypeKind.TableType:
            return prefixNullableIfRequired(type, `type table ${nameOfFieldSpecificationList(type)}`);

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return prefixNullableIfRequired(type, `type table ${nameOf(type.primaryExpression)}`);

        case undefined:
            return prefixNullableIfRequired(type, nameOfTypeKind(type.kind));

        default:
            throw Assert.isNever(type);
    }
}

function nameOfTypeKind(kind: Type.TypeKind): string {
    return kind === Type.TypeKind.NotApplicable ? "not applicable" : kind.toLowerCase();
}

function nameOfFieldSpecificationList(type: Type.FieldSpecificationList): string {
    const chunks: string[] = [];

    for (const [key, value] of type.fields.entries()) {
        chunks.push(`${StringUtils.normalizeIdentifier(key)}: ${nameOf(value)}`);
    }

    if (type.isOpen === true) {
        chunks.push("...");
    }

    const pairs: string = chunks.join(", ");

    return `[${pairs}]`;
}

function nameOfFunctionSignature(type: Type.FunctionSignature, includeFatArrow: boolean): string {
    const parameters: string = type.parameters
        .map((parameter: Type.FunctionParameter) => {
            let partial: string = `${parameter.nameLiteral}:`;

            if (parameter.isOptional === true) {
                partial += " optional";
            }

            if (parameter.isNullable === true) {
                partial += " nullable";
            }

            if (parameter.maybeType !== undefined) {
                partial += ` ${nameOfTypeKind(parameter.maybeType)}`;
            }

            return partial;
        })
        .join(", ");

    return `(${parameters}) ${includeFatArrow ? "=>" : ""} ${nameOf(type.returnType)}`;
}

function nameOfIterable(collection: ReadonlyArray<Type.TType>): string {
    return collection.map((item: Type.TType) => nameOf(item)).join(", ");
}

function prefixNullableIfRequired(type: Type.TType, name: string): string {
    return type.isNullable ? `${Constant.LanguageConstantKind.Nullable} ${name}` : name;
}
