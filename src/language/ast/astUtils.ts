// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError } from "../../common";
import { Ast } from "../ast";
import { Constant } from "../constant";

export interface SimplifiedType {
    readonly isNullable: boolean;
    readonly primitiveTypeConstantKind: Constant.PrimitiveTypeConstantKind;
}

export function simplifyType(type: Ast.TType): SimplifiedType {
    let isNullable: boolean;
    let primitiveTypeConstantKind: Constant.PrimitiveTypeConstantKind;

    switch (type.kind) {
        case Ast.NodeKind.PrimitiveType:
            isNullable = false;
            primitiveTypeConstantKind = type.primitiveType.constantKind;
            break;

        case Ast.NodeKind.NullableType:
            isNullable = true;
            primitiveTypeConstantKind = simplifyType(type.paired).primitiveTypeConstantKind;
            break;

        case Ast.NodeKind.FunctionType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstantKind.Function;
            break;

        case Ast.NodeKind.ListType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstantKind.List;
            break;

        case Ast.NodeKind.RecordType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstantKind.Record;
            break;

        case Ast.NodeKind.TableType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstantKind.Table;
            break;

        default:
            const details: {} = {
                nodeId: type.id,
                nodeKind: type.kind,
            };
            throw new CommonError.InvariantError("this should never be reached", details);
    }

    return {
        isNullable,
        primitiveTypeConstantKind,
    };
}

export function simplifyAsNullablePrimitiveType(node: Ast.AsNullablePrimitiveType): SimplifiedType {
    let isNullable: boolean;
    let primitiveTypeConstantKind: Constant.PrimitiveTypeConstantKind;

    const nullablePrimitiveType: Ast.TNullablePrimitiveType = node.paired;
    switch (nullablePrimitiveType.kind) {
        case Ast.NodeKind.NullablePrimitiveType:
            isNullable = true;
            primitiveTypeConstantKind = nullablePrimitiveType.paired.primitiveType.constantKind;
            break;

        case Ast.NodeKind.PrimitiveType:
            isNullable = false;
            primitiveTypeConstantKind = nullablePrimitiveType.primitiveType.constantKind;
            break;

        default:
            throw Assert.isNever(nullablePrimitiveType);
    }

    return {
        primitiveTypeConstantKind,
        isNullable,
    };
}

export function primitiveTypeConstantKindFrom(
    node: Ast.AsNullablePrimitiveType | Ast.NullablePrimitiveType | Ast.PrimitiveType,
): Constant.PrimitiveTypeConstantKind {
    switch (node.kind) {
        case Ast.NodeKind.AsNullablePrimitiveType:
            return primitiveTypeConstantKindFrom(node.paired);

        case Ast.NodeKind.NullablePrimitiveType:
            return node.paired.primitiveType.constantKind;

        case Ast.NodeKind.PrimitiveType:
            return node.primitiveType.constantKind;

        default:
            throw Assert.isNever(node);
    }
}

export function isTBinOpExpression(node: Ast.TNode): node is Ast.TBinOpExpression {
    switch (node.kind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.NullCoalescingExpression:
        case Ast.NodeKind.MetadataExpression:
        case Ast.NodeKind.RelationalExpression:
            return true;

        default:
            return false;
    }
}

export function isTBinOpExpressionKind(nodeKind: Ast.NodeKind): nodeKind is Ast.TBinOpExpressionNodeKind {
    switch (nodeKind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.MetadataExpression:
        case Ast.NodeKind.RelationalExpression:
            return true;

        default:
            return false;
    }
}

export function assertNodeKind(node: Ast.TNode, expectedNodeKind: Ast.NodeKind): void {
    Assert.isTrue(node.kind === expectedNodeKind, `node.kind === expectedNodeKind`, {
        expectedNodeKind,
        actualNodeKind: node.kind,
        actualNodeId: node.id,
    });
}

export function assertAnyNodeKind(node: Ast.TNode, allowedNodeKinds: ReadonlyArray<Ast.NodeKind>): void {
    ArrayUtils.assertIn(allowedNodeKinds, node.kind, undefined, {
        allowedNodeKinds,
        actualNodeKind: node.kind,
        actualNodeId: node.id,
    });
}
