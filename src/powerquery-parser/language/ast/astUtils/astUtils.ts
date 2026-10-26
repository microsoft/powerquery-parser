import { Assert, CommonError } from "../../../common";
import { ResolvedType, SimplifiedType, SimplifiedTypeKind } from "./simplifiedType";
import { Ast } from "..";
import { Constant } from "../../constant";
import { TokenKind } from "../../token";

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

export function getIdentifierLiteral(node: Ast.Identifier | Ast.IdentifierExpression): string {
    switch (node.kind) {
        case Ast.NodeKind.Identifier:
            return node.literal;

        case Ast.NodeKind.IdentifierExpression:
            return node.inclusiveConstant ? `@${node.identifier.literal}` : node.identifier.literal;

        default:
            throw Assert.isNever(node);
    }
}

export function isTAnyLiteral(node: Ast.TNode): node is Ast.TAnyLiteral {
    return Ast.NodeKindsForTAnyLiteral.has(node.kind);
}

export function isTArithmeticExpression(node: Ast.TNode): node is Ast.TArithmeticExpression {
    return Ast.NodeKindsForTArithmeticExpression.has(node.kind);
}

export function isTAsExpression(node: Ast.TNode): node is Ast.TAsExpression {
    return Ast.NodeKindsForTAsExpression.has(node.kind);
}

export function isTEqualityExpression(node: Ast.TNode): node is Ast.TEqualityExpression {
    return Ast.NodeKindsForTEqualityExpression.has(node.kind);
}

export function isTExpression(node: Ast.TNode): node is Ast.TExpression {
    return Ast.NodeKindsForTExpression.has(node.kind);
}

export function isTFieldAccessExpression(node: Ast.TNode): node is Ast.TFieldAccessExpression {
    return Ast.NodeKindsForTFieldAccessExpression.has(node.kind);
}

export function isTIsExpression(node: Ast.TNode): node is Ast.TIsExpression {
    return Ast.NodeKindsForTIsExpression.has(node.kind);
}

export function isTLeaf(node: Ast.TNode): node is Ast.TLeaf {
    return node.isLeaf;
}

export function isTListItem(node: Ast.TNode): node is Ast.TListItem {
    return Ast.NodeKindsForTListItem.has(node.kind);
}

export function isTLogicalExpression(node: Ast.TNode): node is Ast.TLogicalExpression {
    return Ast.NodeKindsForTLogicalExpression.has(node.kind);
}

export function isTMetadataExpression(node: Ast.TNode): node is Ast.TMetadataExpression {
    return Ast.NodeKindsForTMetadataExpression.has(node.kind);
}

export function isTNullablePrimitiveType(node: Ast.TNode): node is Ast.TNullablePrimitiveType {
    return Ast.NodeKindsForTNullablePrimitiveType.has(node.kind);
}

export function isTNullCoalescingExpression(node: Ast.TNode): node is Ast.TNullCoalescingExpression {
    return Ast.NodeKindsForTNullCoalescingExpression.has(node.kind);
}

export function isTPrimaryExpression(node: Ast.TNode): node is Ast.TPrimaryExpression {
    return Ast.NodeKindsForTPrimaryExpression.has(node.kind);
}

export function isTPrimaryType(node: Ast.TNode): node is Ast.TPrimaryType {
    return Ast.NodeKindsForTPrimaryType.has(node.kind);
}

export function isTRecursivePrimaryExpression(node: Ast.TNode): node is Ast.TRecursivePrimaryExpression {
    return Ast.NodeKindsForTRecursivePrimaryExpression.has(node.kind);
}

export function isTRelationalExpression(node: Ast.TNode): node is Ast.TRelationalExpression {
    return Ast.NodeKindsForTRelationalExpression.has(node.kind);
}

export function isTType(node: Ast.TNode): node is Ast.TType {
    return Ast.NodeKindsForTType.has(node.kind);
}

export function isTTypeExpression(node: Ast.TNode): node is Ast.TTypeExpression {
    return Ast.NodeKindsForTTypeExpression.has(node.kind);
}

export function isTUnaryExpression(node: Ast.TNode): node is Ast.TUnaryExpression {
    return Ast.NodeKindsForTUnaryExpression.has(node.kind);
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

        case TokenKind.Ampersand:
        case TokenKind.Asterisk:
        case TokenKind.AtSign:
        case TokenKind.Bang:
        case TokenKind.Comma:
        case TokenKind.Division:
        case TokenKind.DotDot:
        case TokenKind.Ellipsis:
        case TokenKind.Equal:
        case TokenKind.FatArrow:
        case TokenKind.GreaterThan:
        case TokenKind.GreaterThanEqualTo:
        case TokenKind.Identifier:
        case TokenKind.KeywordAnd:
        case TokenKind.KeywordAs:
        case TokenKind.KeywordEach:
        case TokenKind.KeywordElse:
        case TokenKind.KeywordError:
        case TokenKind.KeywordHashBinary:
        case TokenKind.KeywordHashDate:
        case TokenKind.KeywordHashDateTime:
        case TokenKind.KeywordHashDateTimeZone:
        case TokenKind.KeywordHashDuration:
        case TokenKind.KeywordHashSections:
        case TokenKind.KeywordHashShared:
        case TokenKind.KeywordHashTable:
        case TokenKind.KeywordHashTime:
        case TokenKind.KeywordIf:
        case TokenKind.KeywordIn:
        case TokenKind.KeywordIs:
        case TokenKind.KeywordLet:
        case TokenKind.KeywordMeta:
        case TokenKind.KeywordNot:
        case TokenKind.KeywordOr:
        case TokenKind.KeywordOtherwise:
        case TokenKind.KeywordSection:
        case TokenKind.KeywordShared:
        case TokenKind.KeywordThen:
        case TokenKind.KeywordTry:
        case TokenKind.KeywordType:
        case TokenKind.LeftBrace:
        case TokenKind.LeftBracket:
        case TokenKind.LeftParenthesis:
        case TokenKind.LessThan:
        case TokenKind.LessThanEqualTo:
        case TokenKind.Minus:
        case TokenKind.NotEqual:
        case TokenKind.NullCoalescingOperator:
        case TokenKind.Plus:
        case TokenKind.QuestionMark:
        case TokenKind.RightBrace:
        case TokenKind.RightBracket:
        case TokenKind.RightParenthesis:
        case TokenKind.Semicolon:
        case undefined:
            return undefined;

        default:
            throw Assert.isNever(tokenKind);
    }
}

export function simplifyType(type: Ast.TType): SimplifiedType {
    if (
        type.kind === Ast.NodeKind.NullableType ||
        type.kind === Ast.NodeKind.TypePrimaryType ||
        type.kind === Ast.NodeKind.ParenthesizedExpression
    ) {
        const simplified: SimplifiedType = simplifyType(
            type.kind === Ast.NodeKind.ParenthesizedExpression ? type.content : type.paired,
        );

        return simplified.kind === SimplifiedTypeKind.Resolved
            ? {
                  ...simplified,
                  isNullable: type.kind === Ast.NodeKind.NullableType || simplified.isNullable,
              }
            : {
                  ...simplified,
                  node: type,
              };
    }

    if (
        type.kind === Ast.NodeKind.LiteralExpression ||
        type.kind === Ast.NodeKind.ListExpression ||
        type.kind === Ast.NodeKind.RecordExpression ||
        type.kind === Ast.NodeKind.FunctionExpression ||
        type.kind === Ast.NodeKind.EachExpression
    ) {
        return {
            kind: SimplifiedTypeKind.NotType,
            node: type,
        };
    }

    if (!isTPrimaryType(type)) {
        return {
            kind: SimplifiedTypeKind.RequiresResolution,
            node: type,
        };
    }

    let isNullable: boolean;
    let primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;

    switch (type.kind) {
        case Ast.NodeKind.PrimitiveType:
            isNullable = false;
            primitiveTypeConstantKind = type.primitiveTypeKind;
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
            throw Assert.isNever(type);
    }

    return {
        kind: SimplifiedTypeKind.Resolved,
        isNullable,
        primitiveTypeConstantKind,
    };
}

export function nodeKindFromTBinOpExpressionOperator(
    constantKind: Constant.TBinOpExpressionOperator,
): Ast.TBinOpExpressionNodeKind {
    switch (constantKind) {
        case Constant.ArithmeticOperator.Multiplication:
        case Constant.ArithmeticOperator.Division:
        case Constant.ArithmeticOperator.Addition:
        case Constant.ArithmeticOperator.Subtraction:
        case Constant.ArithmeticOperator.And:
            return Ast.NodeKind.ArithmeticExpression;

        case Constant.EqualityOperator.EqualTo:
        case Constant.EqualityOperator.NotEqualTo:
            return Ast.NodeKind.EqualityExpression;

        case Constant.LogicalOperator.And:
        case Constant.LogicalOperator.Or:
            return Ast.NodeKind.LogicalExpression;

        case Constant.RelationalOperator.LessThan:
        case Constant.RelationalOperator.LessThanEqualTo:
        case Constant.RelationalOperator.GreaterThan:
        case Constant.RelationalOperator.GreaterThanEqualTo:
            return Ast.NodeKind.RelationalExpression;

        case Constant.KeywordConstant.As:
            return Ast.NodeKind.AsExpression;

        case Constant.KeywordConstant.Is:
            return Ast.NodeKind.IsExpression;

        case Constant.KeywordConstant.Meta:
            return Ast.NodeKind.MetadataExpression;

        case Constant.MiscConstant.NullCoalescingOperator:
            return Ast.NodeKind.NullCoalescingExpression;

        default:
            throw Assert.isNever(constantKind);
    }
}

export function simplifyAsNullablePrimitiveType(node: Ast.AsNullablePrimitiveType): ResolvedType {
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
        kind: SimplifiedTypeKind.Resolved,
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
