// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Type } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldSelector(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
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

    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXor(state, previousSibling);
    const isOptional: boolean =
        NodeIdMapUtils.maybeChildAstByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

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

                default:
                    throw Assert.isNever(previousSiblingType);
            }

        default:
            return Type.NoneInstance;
    }
}
