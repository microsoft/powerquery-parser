// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "..";
import { Option } from "../../common";
import { Token, TokenKind } from "../../lexer";
import { BracketDisambiguation, IParser } from "../IParser";
import { IParserState } from "../IParserState";
import * as IParserStateUtils from "../IParserState/IParserStateUtils";
import { readBracketDisambiguation } from "./common";
import * as Naive from "./naive";

export let CombinatorialParser: IParser<IParserState> = {
    // State functions
    deepCopyState: IParserStateUtils.deepCopy,

    // 12.1.6 Identifiers
    readIdentifier: Naive.readIdentifier,
    readGeneralizedIdentifier: Naive.readGeneralizedIdentifier,
    readKeyword: Naive.readKeyword,

    // 12.2.1 Documents
    readDocument: Naive.readDocument,

    // 12.2.2 Section Documents
    readSectionDocument: Naive.readSectionDocument,
    readSectionMembers: Naive.readSectionMembers,
    readSectionMember: Naive.readSectionMember,

    // 12.2.3.1 Expressions
    readExpression,

    // 12.2.3.2 Logical expressions
    readLogicalExpression: Naive.readLogicalExpression,

    // 12.2.3.3 Is expression
    readIsExpression: Naive.readIsExpression,
    readNullablePrimitiveType: Naive.readNullablePrimitiveType,

    // 12.2.3.4 As expression
    readAsExpression: Naive.readAsExpression,

    // 12.2.3.5 Equality expression
    readEqualityExpression: Naive.readEqualityExpression,

    // 12.2.3.6 Relational expression
    readRelationalExpression: Naive.readRelationalExpression,

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: Naive.readArithmeticExpression,

    // 12.2.3.8 Metadata expression
    readMetadataExpression: Naive.readMetadataExpression,

    // 12.2.3.9 Unary expression
    readUnaryExpression: readUnaryExpression,

    // 12.2.3.10 Primary expression
    readPrimaryExpression: Naive.readPrimaryExpression,
    readRecursivePrimaryExpression: Naive.readRecursivePrimaryExpression,

    // 12.2.3.11 Literal expression
    readLiteralExpression: Naive.readLiteralExpression,

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: Naive.readIdentifierExpression,

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: Naive.readParenthesizedExpression,

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: Naive.readNotImplementedExpression,

    // 12.2.3.16 Invoke expression
    readInvokeExpression: Naive.readInvokeExpression,

    // 12.2.3.17 List expression
    readListExpression: Naive.readListExpression,
    readListItem: Naive.readListItem,

    // 12.2.3.18 Record expression
    readRecordExpression: Naive.readRecordExpression,

    // 12.2.3.19 Item access expression
    readItemAccessExpression: Naive.readItemAccessExpression,

    // 12.2.3.20 Field access expression
    readFieldSelection: Naive.readFieldSelection,
    readFieldProjection: Naive.readFieldProjection,
    readFieldSelector: Naive.readFieldSelector,

    // 12.2.3.21 Function expression
    readFunctionExpression: Naive.readFunctionExpression,
    readParameterList: Naive.readParameterList,
    readAsType: Naive.readAsType,

    // 12.2.3.22 Each expression
    readEachExpression: Naive.readEachExpression,

    // 12.2.3.23 Let expression
    readLetExpression: Naive.readLetExpression,

    // 12.2.3.24 If expression
    readIfExpression: Naive.readIfExpression,

    // 12.2.3.25 Type expression
    readTypeExpression: Naive.readTypeExpression,
    readType: Naive.readType,
    readPrimaryType: Naive.readPrimaryType,
    readRecordType: Naive.readRecordType,
    readTableType: Naive.readTableType,
    readFieldSpecificationList: Naive.readFieldSpecificationList,
    readListType: Naive.readListType,
    readFunctionType: Naive.readFunctionType,
    readParameterSpecificationList: Naive.readParameterSpecificationList,
    readNullableType: Naive.readNullableType,

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: Naive.readErrorRaisingExpression,

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: Naive.readErrorHandlingExpression,

    // 12.2.4 Literal Attributes
    readRecordLiteral: Naive.readRecordLiteral,
    readFieldNamePairedAnyLiterals: Naive.readFieldNamePairedAnyLiterals,
    readListLiteral: Naive.readListLiteral,
    readAnyLiteral: Naive.readAnyLiteral,
    readPrimitiveType: Naive.readPrimitiveType,

    // Disambiguation
    disambiguateBracket: Naive.disambiguateBracket,
    disambiguateParenthesis: Naive.disambiguateParenthesis,

    // key-value pairs
    readIdentifierPairedExpressions: Naive.readIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpressions: Naive.readGeneralizedIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpression: Naive.readGeneralizedIdentifierPairedExpression,
    readIdentifierPairedExpression: Naive.readIdentifierPairedExpression,
};

function readExpression(state: IParserState, parser: IParser<IParserState>): Ast.TExpression {
    let maybePrimaryExpression: Option<Ast.TPrimaryExpression>;

    // LL(1)
    const maybeTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;
    switch (maybeTokenKind) {
        // PrimaryExpression
        case TokenKind.AtSign:
        case TokenKind.Identifier:
            const offset: number = maybeTokenKind === TokenKind.AtSign ? 2 : 1;
            if (IParserStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex + offset)) {
                const primaryExpression: Ast.TPrimaryExpression = Naive.readIdentifierExpression(state, parser);
                return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
            } else {
                return readExpressionLl2ForBinOpExpression(state, parser, parser.readIdentifierExpression);
            }

        case TokenKind.LeftBracket:
            maybePrimaryExpression = readBracketDisambiguation(state, parser, [
                BracketDisambiguation.FieldProjection,
                BracketDisambiguation.FieldSelection,
                BracketDisambiguation.Record,
            ]);
            break;

        case TokenKind.LeftBrace:
            maybePrimaryExpression = Naive.readListExpression(state, parser);
            break;

        case TokenKind.Ellipsis:
            maybePrimaryExpression = Naive.readNotImplementedExpression(state, parser);
            break;

        case TokenKind.KeywordHashSections:
        case TokenKind.KeywordHashShared:
        case TokenKind.KeywordHashBinary:
        case TokenKind.KeywordHashDate:
        case TokenKind.KeywordHashDateTime:
        case TokenKind.KeywordHashDateTimeZone:
        case TokenKind.KeywordHashDuration:
        case TokenKind.KeywordHashTable:
        case TokenKind.KeywordHashTime:
            maybePrimaryExpression = parser.readKeyword(state, parser);
            break;

        case TokenKind.HexLiteral:
        case TokenKind.KeywordFalse:
        case TokenKind.KeywordTrue:
        case TokenKind.NumericLiteral:
        case TokenKind.NullLiteral:
        case TokenKind.StringLiteral: {
            return readExpressionLl2ForBinOpExpression(state, parser, parser.readLiteralExpression);
        }

        case TokenKind.KeywordType:
            return parser.readTypeExpression(state, parser);

        default:
            return Naive.readExpression(state, parser);
    }

    if (maybePrimaryExpression) {
        const primaryExpression: Ast.TPrimaryExpression = maybePrimaryExpression;
        if (IParserStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex)) {
            return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
        } else {
            return primaryExpression;
        }
    } else {
        return Naive.readExpression(state, parser);
    }
}

function readExpressionLl2ForBinOpExpression(
    state: IParserState,
    parser: IParser<IParserState>,
    fallback: (state: IParserState, parser: IParser<IParserState>) => Ast.TUnaryExpression,
): Ast.TLogicalExpression {
    const maybeToken: Option<Token> = state.lexerSnapshot.tokens[state.tokenIndex + 1];
    const maybeTokenKind: Option<TokenKind> = maybeToken !== undefined ? maybeToken.kind : undefined;

    // LL(2)
    switch (maybeTokenKind) {
        // IsExpression
        case TokenKind.KeywordIs:
            return parser.readIsExpression(state, parser);

        // AsExpression
        case TokenKind.KeywordAs:
            return parser.readAsExpression(state, parser);

        case TokenKind.Equal:
        case TokenKind.NotEqual:
            return parser.readEqualityExpression(state, parser);

        // LogicalExpression
        case TokenKind.KeywordAnd:
        case TokenKind.KeywordOr:
            return parser.readLogicalExpression(state, parser);

        // RelationalExpression
        case TokenKind.LessThan:
        case TokenKind.LessThanEqualTo:
        case TokenKind.GreaterThan:
        case TokenKind.GreaterThanEqualTo:
            return parser.readRelationalExpression(state, parser);

        case TokenKind.KeywordMeta:
            return parser.readMetadataExpression(state, parser);

        // Arithmetic Expression
        case TokenKind.Asterisk:
        case TokenKind.Division:
        case TokenKind.Plus:
        case TokenKind.Minus:
        case TokenKind.Ampersand:
            return parser.readArithmeticExpression(state, parser);

        default:
            return fallback(state, parser);
    }
}

function readUnaryExpression(state: IParserState, parser: IParser<IParserState>): Ast.TUnaryExpression {
    let maybePrimaryExpression: Option<Ast.TPrimaryExpression>;

    // LL(1)
    switch (state.maybeCurrentTokenKind) {
        // PrimaryExpression
        case TokenKind.AtSign:
        case TokenKind.Identifier:
            maybePrimaryExpression = Naive.readIdentifierExpression(state, parser);
            break;

        case TokenKind.LeftParenthesis:
            maybePrimaryExpression = Naive.readParenthesizedExpression(state, parser);
            break;

        case TokenKind.LeftBracket:
            maybePrimaryExpression = readBracketDisambiguation(state, parser, [
                BracketDisambiguation.FieldProjection,
                BracketDisambiguation.FieldSelection,
                BracketDisambiguation.Record,
            ]);
            break;

        case TokenKind.LeftBrace:
            maybePrimaryExpression = Naive.readListExpression(state, parser);
            break;

        case TokenKind.Ellipsis:
            maybePrimaryExpression = Naive.readNotImplementedExpression(state, parser);
            break;

        // LiteralExpression
        case TokenKind.HexLiteral:
        case TokenKind.KeywordFalse:
        case TokenKind.KeywordTrue:
        case TokenKind.NumericLiteral:
        case TokenKind.NullLiteral:
        case TokenKind.StringLiteral:
            return Naive.readLiteralExpression(state, parser);

        // UnaryExpression
        case TokenKind.Plus:
        case TokenKind.Minus:
        case TokenKind.KeywordNot:
            return Naive.readUnaryExpression(state, parser);

        // TypeExpression
        case TokenKind.KeywordType:
            return Naive.readTypeExpression(state, parser);

        case TokenKind.KeywordHashSections:
        case TokenKind.KeywordHashShared:
        case TokenKind.KeywordHashBinary:
        case TokenKind.KeywordHashDate:
        case TokenKind.KeywordHashDateTime:
        case TokenKind.KeywordHashDateTimeZone:
        case TokenKind.KeywordHashDuration:
        case TokenKind.KeywordHashTable:
        case TokenKind.KeywordHashTime:
            maybePrimaryExpression = parser.readKeyword(state, parser);
            break;

        // Let Naive throw an error.
        default:
            return Naive.readUnaryExpression(state, parser);
    }

    // We should only reach this code path if we're parsing a PrimaryExpression.
    const primaryExpression: Ast.TPrimaryExpression =
        maybePrimaryExpression !== undefined ? maybePrimaryExpression : parser.readLiteralExpression(state, parser);
    if (IParserStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex + 1)) {
        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        return primaryExpression;
    }
}
