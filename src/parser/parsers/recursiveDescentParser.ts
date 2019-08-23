// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserError } from "..";
import { CommonError, Option } from "../../common";
import { TokenKind } from "../../lexer";
import {
    endContext,
    expectAnyTokenKind,
    expectContextNodeMetadata,
    readToken,
    readTokenKind,
    startContext,
} from "./common";
import { IParser, IParserState } from "./IParser";

function notYetImplemented(_state: IParserState): any {
    throw new Error("NYI");
}

export const RecursiveDescentParser: IParser<IParserState> = {
    // 12.1.6 Identifiers
    readIdentifier,
    readGeneralizedIdentifier: notYetImplemented,

    // 12.2.1 Documents
    readDocument: notYetImplemented,

    // 12.2.2 Section Documents
    readSectionDocument: notYetImplemented,
    readSectionMembers: notYetImplemented,
    readSectionMember: notYetImplemented,

    // 12.2.3.1 Expressions
    readExpression: notYetImplemented,

    // 12.2.3.2 Logical expressions
    readLogicalExpression: notYetImplemented,

    // 12.2.3.3 Is expression
    readIsExpression: notYetImplemented,
    readNullablePrimitiveType: notYetImplemented,

    // 12.2.3.4 As expression
    readAsExpression: notYetImplemented,

    // 12.2.3.5 Equality expression
    readEqualityExpression: notYetImplemented,

    // 12.2.3.6 Relational expression
    readRelationalExpression: notYetImplemented,

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: notYetImplemented,

    // 12.2.3.8 Metadata expression
    readMetadataExpression: notYetImplemented,

    // 12.2.3.9 Unary expression
    readUnaryExpression: notYetImplemented,

    // 12.2.3.10 Primary expression
    readPrimaryExpression: notYetImplemented,
    readRecursivePrimaryExpression: notYetImplemented,

    // 12.2.3.11 Literal expression
    readLiteralExpression,

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: notYetImplemented,

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: notYetImplemented,

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: notYetImplemented,

    // 12.2.3.16 Invoke expression
    readInvokeExpression: notYetImplemented,

    // 12.2.3.17 List expression
    readListExpression: notYetImplemented,
    readListItem: notYetImplemented,

    // 12.2.3.18 Record expression
    readRecordExpression: notYetImplemented,

    // 12.2.3.19 Item access expression
    readItemAccessExpression: notYetImplemented,

    // 12.2.3.20 Field access expression
    readFieldSelection: notYetImplemented,
    readFieldProjection: notYetImplemented,
    readFieldSelector: notYetImplemented,

    // 12.2.3.21 Function expression
    readFunctionExpression: notYetImplemented,
    readParameterList: notYetImplemented,

    // 12.2.3.22 Each expression
    readEachExpression: notYetImplemented,

    // 12.2.3.23 Let expression
    readLetExpression: notYetImplemented,

    // 12.2.3.24 If expression
    readIfExpression: notYetImplemented,

    // 12.2.3.25 Type expression
    readTypeExpression: notYetImplemented,
    readType: notYetImplemented,
    readPrimaryType: notYetImplemented,
    readRecordType: notYetImplemented,
    readTableType: notYetImplemented,
    readFieldSpecificationList: notYetImplemented,
    readFunctionType: notYetImplemented,
    readParameterSpecificationList: notYetImplemented,
    readNullableType: notYetImplemented,

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: notYetImplemented,

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: notYetImplemented,

    // 12.2.4 Literal Attributes
    readRecordLiteral: notYetImplemented,
    readFieldNamePairedAnyLiterals: notYetImplemented,
    readListLiteral: notYetImplemented,
    readAnyLiteral: notYetImplemented,
    readAsType: notYetImplemented,
    readListType: notYetImplemented,
    readPrimitiveType: notYetImplemented,

    readIdentifierPairedExpressions: notYetImplemented,
    readGeneralizedIdentifierPairedExpressions: notYetImplemented,
    readGeneralizedIdentifierPairedExpression: notYetImplemented,
    readIdentifierPairedExpression: notYetImplemented,
};

function readIdentifier(state: IParserState): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    startContext(state, nodeKind);

    const literal: string = readTokenKind(state, TokenKind.Identifier);

    const astNode: Ast.Identifier = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    endContext(state, astNode);
    return astNode;
}

// 12.2.3.11 Literal expression
function readLiteralExpression(state: IParserState): Ast.LiteralExpression {
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
    startContext(state, nodeKind);

    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.HexLiteral,
        TokenKind.KeywordFalse,
        TokenKind.KeywordTrue,
        TokenKind.NumericLiteral,
        TokenKind.NullLiteral,
        TokenKind.StringLiteral,
    ];
    const maybeErr: Option<ParserError.ExpectedAnyTokenKindError> = expectAnyTokenKind(state, expectedTokenKinds);
    if (maybeErr) {
        throw maybeErr;
    }

    const maybeLiteralKind: Option<Ast.LiteralKind> = Ast.literalKindFrom(state.maybeCurrentTokenKind);
    if (maybeLiteralKind === undefined) {
        throw new CommonError.InvariantError(
            `couldn't convert TokenKind=${state.maybeCurrentTokenKind} into LiteralKind`,
        );
    }

    const literal: string = readToken(state);
    const astNode: Ast.LiteralExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal: literal,
        literalKind: maybeLiteralKind,
    };
    endContext(state, astNode);
    return astNode;
}
