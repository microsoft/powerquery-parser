// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserError } from "..";
import { CommonError, Option } from "../../common";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";
import {
    endContext,
    expectAnyTokenKind,
    expectContextNodeMetadata,
    expectTokenKind,
    incrementAttributeCounter,
    isOnTokenKind,
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
    readGeneralizedIdentifier,
    readKeyword,

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
    readErrorRaisingExpression,

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression,

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

function readGeneralizedIdentifier(state: IParserState): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    startContext(state, nodeKind);

    let literal: string;
    let astNode: Ast.GeneralizedIdentifier;

    // Edge case where GeneralizedIdentifier is only decmal numbers.
    // The logic should be more robust as it should technically support the following:
    // `1.a`
    // `෬` - non ASCII character from Unicode class Nd (U+0DEC SINHALA LITH DIGIT SIX)
    if (
        state.maybeCurrentToken !== undefined &&
        state.maybeCurrentToken.kind === TokenKind.NumericLiteral &&
        state.maybeCurrentToken.data.match("^\\d+$")
    ) {
        literal = readToken(state);
        astNode = {
            ...expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal,
        };
        endContext(state, astNode);
        return astNode;
    }

    const tokenRangeStartIndex: number = state.tokenIndex;
    let tokenRangeEndIndex: number = tokenRangeStartIndex;
    while (isOnGeneralizedIdentifierToken(state)) {
        readToken(state);
        tokenRangeEndIndex = state.tokenIndex;
    }

    if (tokenRangeStartIndex === tokenRangeEndIndex) {
        throw new CommonError.InvariantError(
            `readGeneralizedIdentifier has tokenRangeStartIndex === tokenRangeEndIndex`,
        );
    }

    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const tokens: ReadonlyArray<Token> = lexerSnapshot.tokens;
    const contiguousIdentifierStartIndex: number = tokens[tokenRangeStartIndex].positionStart.codeUnit;
    const contiguousIdentifierEndIndex: number = tokens[tokenRangeEndIndex - 1].positionEnd.codeUnit;
    literal = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);

    astNode = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    endContext(state, astNode);
    return astNode;
}

function readKeyword(state: IParserState): Ast.IdentifierExpression {
    const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    startContext(state, identifierExpressionNodeKind);

    // Keywords can't have a "@" prefix constant
    incrementAttributeCounter(state);

    const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    startContext(state, identifierNodeKind);

    const literal: string = readToken(state);
    const identifier: Ast.Identifier = {
        ...expectContextNodeMetadata(state),
        kind: identifierNodeKind,
        isLeaf: true,
        literal,
    };
    endContext(state, identifier);

    const identifierExpression: Ast.IdentifierExpression = {
        ...expectContextNodeMetadata(state),
        kind: identifierExpressionNodeKind,
        isLeaf: false,
        maybeInclusiveConstant: undefined,
        identifier,
    };
    endContext(state, identifierExpression);
    return identifierExpression;
}

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

function isOnGeneralizedIdentifierToken(state: IParserState, tokenIndex: number = state.tokenIndex): boolean {
    const maybeToken: Option<Token> = state.lexerSnapshot.tokens[tokenIndex];
    if (maybeToken === undefined) {
        return false;
    }
    const tokenKind: TokenKind = maybeToken.kind;

    switch (tokenKind) {
        case TokenKind.Identifier:
        case TokenKind.KeywordAnd:
        case TokenKind.KeywordAs:
        case TokenKind.KeywordEach:
        case TokenKind.KeywordElse:
        case TokenKind.KeywordError:
        case TokenKind.KeywordFalse:
        case TokenKind.KeywordHashBinary:
        case TokenKind.KeywordHashDate:
        case TokenKind.KeywordHashDateTime:
        case TokenKind.KeywordHashDateTimeZone:
        case TokenKind.KeywordHashDuration:
        case TokenKind.KeywordHashInfinity:
        case TokenKind.KeywordHashNan:
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
        case TokenKind.KeywordTrue:
        case TokenKind.KeywordTry:
        case TokenKind.KeywordType:
            return true;

        default:
            return false;
    }
}

function readErrorRaisingExpression(state: IParserState): Ast.ErrorRaisingExpression {
    return readPairedConstant<Ast.NodeKind.ErrorRaisingExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordError),
        () => RecursiveDescentParser.readExpression(state),
    );
}

function readErrorHandlingExpression(state: IParserState): Ast.ErrorHandlingExpression {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    startContext(state, nodeKind);

    const tryConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordTry);
    const protectedExpression: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
    const maybeOtherwiseExpression: Option<Ast.OtherwiseExpression> = maybeReadPairedConstant<
        Ast.NodeKind.OtherwiseExpression,
        Ast.TExpression
    >(
        state,
        otherwiseExpressionNodeKind,
        () => isOnTokenKind(state, TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, TokenKind.KeywordOtherwise),
        () => RecursiveDescentParser.readExpression(state),
    );

    const astNode: Ast.ErrorHandlingExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tryConstant,
        protectedExpression,
        maybeOtherwiseExpression,
    };
    endContext(state, astNode);
    return astNode;
}

function readTokenKindAsConstant(state: IParserState, tokenKind: TokenKind): Ast.Constant {
    const maybeConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, tokenKind);
    if (maybeConstant === undefined) {
        const maybeErr: Option<ParserError.ExpectedTokenKindError> = expectTokenKind(state, tokenKind);
        if (maybeErr) {
            throw maybeErr;
        } else {
            const details: {} = {
                expectedTokenKind: tokenKind,
                actualTokenKind: state.maybeCurrentTokenKind,
            };

            throw new CommonError.InvariantError(
                `failures from ${maybeReadTokenKindAsConstant.name} should be reportable by ${expectTokenKind.name}`,
                details,
            );
        }
    }

    return maybeConstant;
}

function maybeReadTokenKindAsConstant(state: IParserState, tokenKind: TokenKind): Option<Ast.Constant> {
    if (isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        startContext(state, nodeKind);

        const literal: string = readToken(state);
        const astNode: Ast.Constant = {
            ...expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal,
        };
        endContext(state, astNode);

        return astNode;
    } else {
        incrementAttributeCounter(state);
        return undefined;
    }
}

function readPairedConstant<Kind, Paired>(
    state: IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    constantReader: () => Ast.Constant,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, Paired> {
    startContext(state, nodeKind);

    const constant: Ast.Constant = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, Paired> = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };

    endContext(state, (pairedConstant as unknown) as Ast.TPairedConstant);

    return pairedConstant;
}

function maybeReadPairedConstant<Kind, Paired>(
    state: IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    condition: () => boolean,
    constantReader: () => Ast.Constant,
    pairedReader: () => Paired,
): Option<Ast.IPairedConstant<Kind, Paired>> {
    if (condition()) {
        return readPairedConstant<Kind, Paired>(state, nodeKind, constantReader, pairedReader);
    } else {
        incrementAttributeCounter(state);
        return undefined;
    }
}
