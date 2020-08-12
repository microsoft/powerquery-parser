// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { inspectXorNode, TypeInspectionState } from "./common";

export function inspectTypeFieldSelector(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FieldSelector);

    const maybeFieldName: Ast.TNode | undefined = NodeIdMapUtils.maybeWrappedContentAst(
        state.nodeIdMapCollection,
        xorNode,
        Ast.NodeKind.GeneralizedIdentifier,
    );
    if (maybeFieldName === undefined) {
        return Type.UnknownInstance;
    }
    const fieldName: string = (maybeFieldName as Ast.GeneralizedIdentifier).literal;

    const previousSibling: TXorNode = NodeIdMapUtils.expectRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXorNode(state, previousSibling);
    const isOptional: boolean =
        NodeIdMapUtils.maybeAstChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

    return helperForinspectFieldSelector(state, previousSiblingType, fieldName, isOptional);
}

function helperForinspectFieldSelector(
    state: TypeInspectionState,
    previousSiblingType: Type.TType,
    fieldName: string,
    isOptional: boolean,
): Type.TType {
    switch (previousSiblingType.kind) {
        case Type.TypeKind.Any:
            return Type.AnyInstance;

        case Type.TypeKind.Unknown:
            return Type.UnknownInstance;

        case Type.TypeKind.Record:
        case Type.TypeKind.Table:
            switch (previousSiblingType.maybeExtendedKind) {
                case undefined:
                    return Type.AnyInstance;

                case Type.ExtendedTypeKind.DefinedRecord:
                case Type.ExtendedTypeKind.DefinedTable: {
                    const maybeNamedField: Type.TType | undefined = previousSiblingType.fields.get(fieldName);
                    if (maybeNamedField !== undefined) {
                        return maybeNamedField;
                    } else if (previousSiblingType.isOpen) {
                        return Type.AnyInstance;
                    } else {
                        return isOptional ? Type.NullInstance : Type.NoneInstance;
                    }
                }

                case Type.ExtendedTypeKind.PrimaryExpressionTable:
                    return helperForinspectFieldSelector(state, previousSiblingType.type, fieldName, isOptional);

                default:
                    throw Assert.isNever(previousSiblingType);
            }

        default:
            return Type.NoneInstance;
    }
}
