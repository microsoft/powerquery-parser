import { Assert, CommonError } from "../../../common";
import { Ast } from "..";
import { Constant } from "../../constant";
import { TokenKind } from "../../token";

export interface SimplifiedType {
    readonly isNullable: boolean;
    readonly primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;
}

export function assertIsLeaf(node: Ast.TNode): asserts node is Ast.TLeaf {
    Assert.isTrue(node.isLeaf, "Assert(node.isLeaf)", { nodeId: node.id, nodeKind: node.kind });
}

export function assertIsTUnaryExpression(node: Ast.TNode): asserts node is Ast.TUnaryExpression {
    if (!isTUnaryExpression(node)) {
        throw new CommonError.InvariantError("assertIsTUnaryExpression failed", {
            nodeId: node.id,
            nodeKind: node.kind,
        });
    }
}

export function assertIsTNullablePrimitiveType(node: Ast.TNode): asserts node is Ast.TNullablePrimitiveType {
    if (!isTNullablePrimitiveType(node)) {
        throw new CommonError.InvariantError("assertIsTNullablePrimitiveType failed", {
            nodeId: node.id,
            nodeKind: node.kind,
        });
    }
}

export function isTArithmeticExpression(node: Ast.TNode): node is Ast.TArithmeticExpression {
    return node.kind === Ast.NodeKind.ArithmeticExpression || isTMetadataExpression(node);
}

export function isTAsExpression(node: Ast.TNode): node is Ast.TAsExpression {
    return node.kind === Ast.NodeKind.AsExpression || isTEqualityExpression(node);
}

export function isTEqualityExpression(node: Ast.TNode): node is Ast.TEqualityExpression {
    return node.kind === Ast.NodeKind.EqualityExpression || isTRelationalExpression(node);
}

export function isTIsExpression(node: Ast.TNode): node is Ast.TIsExpression {
    return node.kind === Ast.NodeKind.IsExpression || isTAsExpression(node);
}

export function isLeaf(node: Ast.TNode): node is Ast.TLeaf {
    return node.isLeaf;
}

export function isTLogicalExpression(node: Ast.TNode): node is Ast.TLogicalExpression {
    return node.kind === Ast.NodeKind.LogicalExpression || isTIsExpression(node);
}

export function isTFieldAccessExpression(node: Ast.TNode): node is Ast.TFieldAccessExpression {
    return node.kind === Ast.NodeKind.FieldSelector || node.kind === Ast.NodeKind.FieldProjection;
}

export function isTNullCoalescingExpression(node: Ast.TNode): node is Ast.TNullCoalescingExpression {
    return node.kind === Ast.NodeKind.NullCoalescingExpression || isTLogicalExpression(node);
}

export function isTMetadataExpression(node: Ast.TNode): node is Ast.TMetadataExpression {
    return node.kind === Ast.NodeKind.MetadataExpression || isTUnaryExpression(node);
}

export function isTNullablePrimitiveType(node: Ast.TNode): node is Ast.TNullablePrimitiveType {
    return node.kind === Ast.NodeKind.NullablePrimitiveType || node.kind === Ast.NodeKind.PrimitiveType;
}

export function isTPrimaryExpression(node: Ast.TNode): node is Ast.TPrimaryExpression {
    switch (node.kind) {
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.NotImplementedExpression:
            return true;

        default:
            return isTFieldAccessExpression(node);
    }
}

export function isTRelationalExpression(node: Ast.TNode): node is Ast.TEqualityExpression {
    return node.kind === Ast.NodeKind.EqualityExpression || isTArithmeticExpression(node);
}

export function isTTypeExpression(node: Ast.TNode): node is Ast.TTypeExpression {
    return node.kind === Ast.NodeKind.TypePrimaryType || isTPrimaryExpression(node);
}

export function isTUnaryExpression(node: Ast.TNode): node is Ast.TUnaryExpression {
    return node.kind === Ast.NodeKind.UnaryExpression || isTTypeExpression(node);
}

export function literalKindFrom(
    tokenKind: TokenKind | undefined,
): Ast.LiteralKind.Numeric | Ast.LiteralKind.Logical | Ast.LiteralKind.Null | Ast.LiteralKind.Text | undefined {
    switch (tokenKind) {
        case TokenKind.HexLiteral:
        case TokenKind.KeywordHashNan:
        case TokenKind.KeywordHashInfinity:
        case TokenKind.NumericLiteral:
            return Ast.LiteralKind.Numeric;

        case TokenKind.KeywordFalse:
        case TokenKind.KeywordTrue:
            return Ast.LiteralKind.Logical;

        case TokenKind.NullLiteral:
            return Ast.LiteralKind.Null;

        case TokenKind.TextLiteral:
            return Ast.LiteralKind.Text;

        default:
            return undefined;
    }
}

export function simplifyType(type: Ast.TType): SimplifiedType {
    let isNullable: boolean;
    let primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;

    switch (type.kind) {
        case Ast.NodeKind.PrimitiveType:
            isNullable = false;
            primitiveTypeConstantKind = type.primitiveTypeKind;
            break;

        case Ast.NodeKind.NullableType:
            isNullable = true;
            primitiveTypeConstantKind = simplifyType(type.paired).primitiveTypeConstantKind;
            break;

        case Ast.NodeKind.FunctionType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstant.Function;
            break;

        case Ast.NodeKind.ListType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstant.List;
            break;

        case Ast.NodeKind.RecordType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstant.Record;
            break;

        case Ast.NodeKind.TableType:
            isNullable = false;
            primitiveTypeConstantKind = Constant.PrimitiveTypeConstant.Table;
            break;

        default:
            throw new CommonError.InvariantError("this should never be reached", {
                nodeId: type.id,
                nodeKind: type.kind,
            });
    }

    return {
        isNullable,
        primitiveTypeConstantKind,
    };
}

export function simplifyAsNullablePrimitiveType(node: Ast.AsNullablePrimitiveType): SimplifiedType {
    let isNullable: boolean;
    let primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;

    const nullablePrimitiveType: Ast.TNullablePrimitiveType = node.paired;

    switch (nullablePrimitiveType.kind) {
        case Ast.NodeKind.NullablePrimitiveType:
            isNullable = true;
            primitiveTypeConstantKind = nullablePrimitiveType.paired.primitiveTypeKind;
            break;

        case Ast.NodeKind.PrimitiveType:
            isNullable = false;
            primitiveTypeConstantKind = nullablePrimitiveType.primitiveTypeKind;
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
): Constant.PrimitiveTypeConstant {
    switch (node.kind) {
        case Ast.NodeKind.AsNullablePrimitiveType:
            return primitiveTypeConstantKindFrom(node.paired);

        case Ast.NodeKind.NullablePrimitiveType:
            return node.paired.primitiveTypeKind;

        case Ast.NodeKind.PrimitiveType:
            return node.primitiveTypeKind;

        default:
            throw Assert.isNever(node);
    }
}
