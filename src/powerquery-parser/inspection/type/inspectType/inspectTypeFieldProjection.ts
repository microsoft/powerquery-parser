// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, MapUtils } from "../../../common";
import { Ast, Type, TypeUtils } from "../../../language";
import { NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldProjection(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FieldProjection);

    const projectedFieldNames: ReadonlyArray<string> = NodeIdMapIterator.iterFieldProjectionNames(
        state.nodeIdMapCollection,
        xorNode,
    );
    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXor(state, previousSibling);
    const isOptional: boolean =
        NodeIdMapUtils.maybeChildAstByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

    return inspectFieldProjectionHelper(previousSiblingType, projectedFieldNames, isOptional);
}

function inspectFieldProjectionHelper(
    previousSiblingType: Type.TType,
    projectedFieldNames: ReadonlyArray<string>,
    isOptional: boolean,
): Type.TType {
    switch (previousSiblingType.kind) {
        case Type.TypeKind.Any: {
            const newFields: Map<string, Type.Any> = new Map(
                projectedFieldNames.map((fieldName: string) => [fieldName, Type.AnyInstance]),
            );
            return {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: previousSiblingType.isNullable,
                unionedTypePairs: [
                    {
                        kind: Type.TypeKind.Record,
                        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                        isNullable: previousSiblingType.isNullable,
                        fields: newFields,
                        isOpen: false,
                    },
                    {
                        kind: Type.TypeKind.Table,
                        maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                        isNullable: previousSiblingType.isNullable,
                        fields: newFields,
                        isOpen: false,
                    },
                ],
            };
        }

        case Type.TypeKind.Record:
        case Type.TypeKind.Table: {
            // All we know is previousSibling was a Record/Table.
            // Create a DefinedRecord/DefinedTable with the projected fields.
            if (previousSiblingType.maybeExtendedKind === undefined) {
                const newFields: Map<string, Type.Any> = new Map(
                    projectedFieldNames.map((fieldName: string) => [fieldName, Type.AnyInstance]),
                );
                return previousSiblingType.kind === Type.TypeKind.Record
                    ? TypeUtils.definedRecordFactory(false, newFields, false)
                    : TypeUtils.definedTableFactory(false, newFields, false);
            } else {
                return reducedFieldsToKeys(previousSiblingType, projectedFieldNames, isOptional);
            }
        }

        default:
            return Type.NoneInstance;
    }
}

// Returns a subset of `current` using `keys`.
// If a mismatch is found it either returns Null if isOptional, else None.
function reducedFieldsToKeys(
    current: Type.DefinedRecord | Type.DefinedTable,
    keys: ReadonlyArray<string>,
    isOptional: boolean,
): Type.DefinedRecord | Type.DefinedTable | Type.None | Type.Null {
    const currentFields: Map<string, Type.TType> = current.fields;
    const currentFieldNames: ReadonlyArray<string> = [...current.fields.keys()];

    if (current.isOpen === false && ArrayUtils.isSubset(currentFieldNames, keys) === false) {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }

    return {
        ...current,
        fields: MapUtils.pick(currentFields, keys),
        isOpen: false,
    };
}
