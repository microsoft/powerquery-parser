// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError } from "../common";
import { isNever } from "../common/assert";
import { Option } from "../common/option";
import { Result, ResultKind } from "../common/result";
import { Keyword } from "../lexer/keywords";
import { LexerSnapshot } from "../lexer/lexerSnapshot";
import { Token, TokenKind, TokenPosition } from "../lexer/token";
import * as Ast from "./ast";
import * as Context from "./context";
import * as ParserError from "./error";
import { TokenRange, tokenRangeHashFrom } from "./tokenRange";

export type TriedParse = Result<ParseOk, ParserError.TParserError>;

export class Parser {
    private maybeCurrentToken: Option<Token>;
    private maybeCurrentTokenKind: Option<TokenKind>;

    public constructor(
        private readonly lexerSnapshot: LexerSnapshot,
        private tokenIndex: number = 0,
        private readonly tokenRangeStack: TokenRangeStackElement[] = [],
        private nodeIdCounter: number = 0,
        private contextState: Context.State = Context.empty(),
        private maybeCurrentContextNode: Option<Context.Node> = undefined,
    ) {
        if (this.lexerSnapshot.tokens.length) {
            this.maybeCurrentToken = this.lexerSnapshot.tokens[0];
            this.maybeCurrentTokenKind = this.maybeCurrentToken.kind;
        }
    }

    public parse(): TriedParse {
        try {
            const document: Ast.TDocument = this.readDocument();
            if (this.maybeCurrentContextNode !== undefined) {
                const details: {} = { maybeContextNode: this.maybeCurrentContextNode };
                throw new CommonError.InvariantError(
                    "maybeContextNode should be falsey, there shouldn't be an open context",
                    details,
                );
            }

            const contextState: Context.State = this.contextState;
            return {
                kind: ResultKind.Ok,
                value: {
                    document,
                    nodesById: contextState.astNodesById,
                    leafNodeIds: contextState.leafNodeIds,
                },
            };
        } catch (e) {
            let error: ParserError.TParserError;
            if (ParserError.isTInnerParserError(e)) {
                error = new ParserError.ParserError(e, this.contextState);
            } else {
                error = CommonError.ensureCommonError(e);
            }
            return {
                kind: ResultKind.Err,
                error,
            };
        }
    }

    // 12.2.1 Documents
    private readDocument(): Ast.TDocument {
        let document: Ast.TDocument;

        if (this.isOnTokenKind(TokenKind.KeywordSection)) {
            document = this.readSection();
        } else {
            const backup: StateBackup = this.backupState();
            try {
                document = this.readExpression();
                const maybeErr: Option<ParserError.UnusedTokensRemainError> = this.expectNoMoreTokens();
                if (maybeErr) {
                    throw maybeErr;
                }
            } catch (expressionError) {
                const expressionContextState: Context.State = Context.deepCopy(this.contextState);
                this.restoreBackup(backup);
                try {
                    document = this.readSection();
                    const maybeErr: Option<ParserError.UnusedTokensRemainError> = this.expectNoMoreTokens();
                    if (maybeErr) {
                        throw maybeErr;
                    }
                } catch {
                    this.contextState = expressionContextState;
                    throw expressionError;
                }
            }
        }

        return document;
    }

    private readSection(): Ast.Section {
        const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const maybeLiteralAttributes: Option<Ast.RecordLiteral> = this.maybeReadLiteralAttributes();
        const sectionConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordSection);

        let maybeName: Option<Ast.Identifier>;
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            maybeName = this.readIdentifier();
        }

        const semicolonConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Semicolon);

        const totalTokens: number = this.lexerSnapshot.tokens.length;
        const sectionMembers: Ast.SectionMember[] = [];
        while (this.tokenIndex < totalTokens) {
            sectionMembers.push(this.readSectionMember());
        }

        const astNode: Ast.Section = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            maybeLiteralAttributes,
            sectionConstant,
            maybeName,
            semicolonConstant,
            sectionMembers,
        };
        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.2 Section Documents
    private readSectionMember(): Ast.SectionMember {
        const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const maybeLiteralAttributes: Option<Ast.RecordLiteral> = this.maybeReadLiteralAttributes();
        const maybeSharedConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.KeywordShared);
        const namePairedExpression: Ast.IdentifierPairedExpression = this.readIdentifierPairedExpression();
        const semicolonConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Semicolon);

        const astNode: Ast.SectionMember = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            maybeLiteralAttributes,
            maybeSharedConstant,
            namePairedExpression,
            semicolonConstant,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.1 Expressions
    private readExpression(): Ast.TExpression {
        switch (this.maybeCurrentTokenKind) {
            case TokenKind.KeywordEach:
                return this.readEachExpression();

            case TokenKind.KeywordLet:
                return this.readLetExpression();

            case TokenKind.KeywordIf:
                return this.readIfExpression();

            case TokenKind.KeywordError:
                return this.readErrorRaisingExpression();

            case TokenKind.KeywordTry:
                return this.readErrorHandlingExpression();

            case TokenKind.LeftParenthesis:
                const disambiguation: ParenthesisDisambiguation = this.disambiguateParenthesis();
                switch (disambiguation) {
                    case ParenthesisDisambiguation.FunctionExpression:
                        return this.readFunctionExpression();

                    case ParenthesisDisambiguation.ParenthesizedExpression:
                        return this.readLogicalExpression();

                    default:
                        throw isNever(disambiguation);
                }
            default:
                return this.readLogicalExpression();
        }
    }

    // 12.2.3.2 Logical expressions
    private readLogicalExpression(): Ast.TLogicalExpression {
        return this.readBinOpExpression<Ast.NodeKind.LogicalExpression, Ast.LogicalOperator, Ast.TLogicalExpression>(
            Ast.NodeKind.LogicalExpression,
            Ast.logicalOperatorFrom,
            () => this.readIsExpression(),
        );
    }

    // 12.2.3.3 Is expression
    private readIsExpression(): Ast.TIsExpression {
        return this.readBinOpKeywordExpression<
            Ast.NodeKind.IsExpression,
            Ast.TAsExpression,
            TokenKind.KeywordIs,
            Ast.TNullablePrimitiveType
        >(Ast.NodeKind.IsExpression, () => this.readAsExpression(), TokenKind.KeywordIs, () =>
            this.readNullablePrimitiveType(),
        );
    }

    // sub-item of 12.2.3.3 Is expression
    private readNullablePrimitiveType(): Ast.TNullablePrimitiveType {
        if (this.isOnIdentifierConstant(Ast.IdentifierConstant.Nullable)) {
            return this.readPairedConstant<Ast.NodeKind.NullablePrimitiveType, Ast.PrimitiveType>(
                Ast.NodeKind.NullablePrimitiveType,
                () => this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Nullable),
                () => this.readPrimitiveType(),
            );
        } else {
            return this.readPrimitiveType();
        }
    }

    // 12.2.3.4 As expression
    private readAsExpression(): Ast.TAsExpression {
        return this.readBinOpKeywordExpression<
            Ast.NodeKind.AsExpression,
            Ast.TEqualityExpression,
            TokenKind.KeywordAs,
            Ast.TNullablePrimitiveType
        >(Ast.NodeKind.AsExpression, () => this.readEqualityExpression(), TokenKind.KeywordAs, () =>
            this.readNullablePrimitiveType(),
        );
    }

    // 12.2.3.5 Equality expression
    private readEqualityExpression(): Ast.TEqualityExpression {
        return this.readBinOpExpression<Ast.NodeKind.EqualityExpression, Ast.EqualityOperator, Ast.TEqualityExpression>(
            Ast.NodeKind.EqualityExpression,
            Ast.equalityOperatorFrom,
            () => this.readRelationalExpression(),
        );
    }

    // 12.2.3.6 Relational expression
    private readRelationalExpression(): Ast.TRelationalExpression {
        return this.readBinOpExpression<
            Ast.NodeKind.RelationalExpression,
            Ast.RelationalOperator,
            Ast.TRelationalExpression
        >(Ast.NodeKind.RelationalExpression, Ast.relationalOperatorFrom, () => this.readArithmeticExpression());
    }

    // 12.2.3.7 Arithmetic expressions
    private readArithmeticExpression(): Ast.TArithmeticExpression {
        return this.readBinOpExpression<
            Ast.NodeKind.ArithmeticExpression,
            Ast.ArithmeticOperator,
            Ast.TArithmeticExpression
        >(Ast.NodeKind.ArithmeticExpression, Ast.arithmeticOperatorFrom, () => this.readMetadataExpression());
    }

    // 12.2.3.8 Metadata expression
    private readMetadataExpression(): Ast.TMetadataExpression {
        return this.readBinOpKeywordExpression<
            Ast.NodeKind.MetadataExpression,
            Ast.TUnaryExpression,
            TokenKind.KeywordMeta,
            Ast.TUnaryExpression
        >(Ast.NodeKind.MetadataExpression, () => this.readUnaryExpression(), TokenKind.KeywordMeta, () =>
            this.readUnaryExpression(),
        );
    }

    // 12.2.3.9 Unary expression
    private readUnaryExpression(): Ast.TUnaryExpression {
        let maybeOperator: Option<Ast.UnaryOperator> = Ast.unaryOperatorFrom(this.maybeCurrentTokenKind);

        if (maybeOperator) {
            const nodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
            this.startContext(nodeKind);
            this.startTokenRange(nodeKind);

            const expressions: Ast.UnaryExpressionHelper<Ast.UnaryOperator, Ast.TUnaryExpression>[] = [];

            while (maybeOperator) {
                const helperNodeKind: Ast.NodeKind.UnaryExpressionHelper = Ast.NodeKind.UnaryExpressionHelper;
                this.startContext(helperNodeKind);
                this.startTokenRange(helperNodeKind);

                const operatorConstant: Ast.Constant = this.readUnaryOperatorAsConstant(maybeOperator);
                const expression: Ast.UnaryExpressionHelper<Ast.UnaryOperator, Ast.TUnaryExpression> = {
                    ...this.expectContextNodeMetadata(),
                    kind: helperNodeKind,
                    tokenRange: this.popTokenRange(),
                    isLeaf: false,
                    inBinaryExpression: false,
                    operator: maybeOperator,
                    operatorConstant,
                    node: this.readUnaryExpression(),
                };
                expressions.push(expression);
                this.endContext(expression);

                maybeOperator = Ast.unaryOperatorFrom(this.maybeCurrentTokenKind);
            }

            const astNode: Ast.UnaryExpression = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                expressions,
            };
            this.endContext(astNode);
            return astNode;
        } else {
            return this.readTypeExpression();
        }
    }

    // 12.2.3.10 Primary expression
    private readPrimaryExpression(): Ast.TPrimaryExpression {
        // I'd prefer to use a switch statement here but there's an issue with Typescript.
        // Doing a switch on this.currentTokenKind makes all child expressions think it's constant,
        // but it gets updated with readX calls.

        let primaryExpression: Option<Ast.TPrimaryExpression>;
        const maybeCurrentTokenKind: Option<TokenKind> = this.maybeCurrentTokenKind;
        const isIdentifierExpressionNext: boolean =
            maybeCurrentTokenKind === TokenKind.AtSign || maybeCurrentTokenKind === TokenKind.Identifier;

        if (isIdentifierExpressionNext) {
            primaryExpression = this.readIdentifierExpression();
        } else {
            switch (maybeCurrentTokenKind) {
                case TokenKind.LeftParenthesis:
                    primaryExpression = this.readParenthesizedExpression();
                    break;

                case TokenKind.LeftBracket:
                    const disambiguation: BracketDisambiguation = this.disambiguateBracket();
                    switch (disambiguation) {
                        case BracketDisambiguation.FieldProjection:
                            primaryExpression = this.readFieldProjection();
                            break;

                        case BracketDisambiguation.FieldSelection:
                            primaryExpression = this.readFieldSelection();
                            break;

                        case BracketDisambiguation.Record:
                            primaryExpression = this.readRecordExpression();
                            break;

                        default:
                            throw isNever(disambiguation);
                    }
                    break;

                case TokenKind.LeftBrace:
                    primaryExpression = this.readListExpression();
                    break;

                case TokenKind.Ellipsis:
                    primaryExpression = this.readNotImplementedExpression();
                    break;

                case TokenKind.KeywordHashShared:
                    throw new CommonError.NotYetImplementedError("todo");

                case TokenKind.KeywordHashBinary:
                    primaryExpression = this.readKeyword();
                    break;

                case TokenKind.KeywordHashDate:
                    primaryExpression = this.readKeyword();
                    break;

                case TokenKind.KeywordHashDateTime:
                    primaryExpression = this.readKeyword();
                    break;

                case TokenKind.KeywordHashDateTimeZone:
                    primaryExpression = this.readKeyword();
                    break;

                case TokenKind.KeywordHashDuration:
                    primaryExpression = this.readKeyword();
                    break;

                case TokenKind.KeywordHashTable:
                    primaryExpression = this.readKeyword();
                    break;

                case TokenKind.KeywordHashTime:
                    primaryExpression = this.readKeyword();
                    break;

                default:
                    primaryExpression = this.readLiteralExpression();
            }
        }

        const isRecursivePrimaryExpression: boolean =
            // section-access-expression
            // this.isOnTokenKind(TokenKind.Bang)
            // field-access-expression
            this.isOnTokenKind(TokenKind.LeftBrace) ||
            // item-access-expression
            this.isOnTokenKind(TokenKind.LeftBracket) ||
            // invoke-expression
            this.isOnTokenKind(TokenKind.LeftParenthesis);
        if (isRecursivePrimaryExpression) {
            return this.readRecursivePrimaryExpression(primaryExpression);
        } else {
            return primaryExpression;
        }
    }

    // 12.2.3.11 Literal expression
    private readLiteralExpression(): Ast.LiteralExpression {
        const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const expectedTokenKinds: ReadonlyArray<TokenKind> = [
            TokenKind.HexLiteral,
            TokenKind.KeywordFalse,
            TokenKind.KeywordTrue,
            TokenKind.NumericLiteral,
            TokenKind.NullLiteral,
            TokenKind.StringLiteral,
        ];
        const maybeErr: Option<ParserError.ExpectedAnyTokenKindError> = this.expectAnyTokenKind(expectedTokenKinds);
        if (maybeErr) {
            throw maybeErr;
        }

        const maybeLiteralKind: Option<Ast.LiteralKind> = Ast.literalKindFrom(this.maybeCurrentTokenKind);
        if (maybeLiteralKind === undefined) {
            throw new CommonError.InvariantError(
                `couldn't convert TokenKind=${this.maybeCurrentTokenKind} into LiteralKind`,
            );
        }

        const literal: string = this.readToken();
        const astNode: Ast.LiteralExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: true,
            literal: literal,
            literalKind: maybeLiteralKind,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.12 Identifier expression
    private readIdentifierExpression(): Ast.IdentifierExpression {
        const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const maybeInclusiveConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.AtSign);
        const identifier: Ast.Identifier = this.readIdentifier();

        const astNode: Ast.IdentifierExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            maybeInclusiveConstant,
            identifier,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.14 Parenthesized expression
    private readParenthesizedExpression(): Ast.ParenthesizedExpression {
        return this.readWrapped<Ast.NodeKind.ParenthesizedExpression, Ast.TExpression>(
            Ast.NodeKind.ParenthesizedExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftParenthesis),
            () => this.readExpression(),
            () => this.readTokenKindAsConstant(TokenKind.RightParenthesis),
            false,
        );
    }

    // 12.2.3.15 Not-implemented expression
    private readNotImplementedExpression(): Ast.NotImplementedExpression {
        const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const ellipsisConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Ellipsis);

        const astNode: Ast.NotImplementedExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            ellipsisConstant,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.16 Invoke expression
    private readInvokeExpression(): Ast.InvokeExpression {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightParenthesis);
        return this.readWrapped<Ast.NodeKind.InvokeExpression, ReadonlyArray<Ast.ICsv<Ast.TExpression>>>(
            Ast.NodeKind.InvokeExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftParenthesis),
            () => this.readCsv(() => this.readExpression(), continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightParenthesis),
            false,
        );
    }

    // 12.2.3.17 List expression
    private readListExpression(): Ast.ListExpression {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightBrace);
        return this.readWrapped<Ast.NodeKind.ListExpression, ReadonlyArray<Ast.ICsv<Ast.TExpression>>>(
            Ast.NodeKind.ListExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readCsv(() => this.readExpression(), continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
            false,
        );
    }

    // 12.2.3.18 Record expression
    private readRecordExpression(): Ast.RecordExpression {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightBracket);
        return this.readWrapped<
            Ast.NodeKind.RecordExpression,
            ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedExpression>>
        >(
            Ast.NodeKind.RecordExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readGeneralizedIdentifierPairedExpressions(continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
            false,
        );
    }

    // 12.2.3.19 Item access expression
    private readItemAccessExpression(): Ast.ItemAccessExpression {
        const nodeKind: Ast.NodeKind.ItemAccessExpression = Ast.NodeKind.ItemAccessExpression;
        const nodeIdNumber: number = this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const wrapped: Ast.IWrapped<Ast.NodeKind.ItemAccessExpression, Ast.TExpression> = this.readWrapped<
            Ast.NodeKind.ItemAccessExpression,
            Ast.TExpression
        >(
            nodeKind,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readExpression(),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
            false,
        );

        // hack to conditionally read '?' after closeWrapperConstant
        const maybeOptionalConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.QuestionMark);
        let astNode: Ast.ItemAccessExpression;
        if (maybeOptionalConstant) {
            const newTokenRange: TokenRange = this.popTokenRange();
            astNode = {
                ...wrapped,
                id: nodeIdNumber,
                tokenRange: newTokenRange,
                maybeOptionalConstant,
            };
        } else {
            this.popTokenRangeNoop();
            astNode = {
                ...wrapped,
                id: nodeIdNumber,
                maybeOptionalConstant: undefined,
            };
        }

        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldSelection(): Ast.FieldSelector {
        return this.readFieldSelector(true);
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldProjection(): Ast.FieldProjection {
        return this.readWrapped<Ast.NodeKind.FieldProjection, ReadonlyArray<Ast.ICsv<Ast.FieldSelector>>>(
            Ast.NodeKind.FieldProjection,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readCsv(() => this.readFieldSelector(false), true),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
            true,
        );
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldSelector(allowOptional: boolean): Ast.FieldSelector {
        return this.readWrapped<Ast.NodeKind.FieldSelector, Ast.GeneralizedIdentifier>(
            Ast.NodeKind.FieldSelector,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readGeneralizedIdentifier(),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
            allowOptional,
        );
    }

    // 12.2.3.21 Function expression
    private readFunctionExpression(): Ast.FunctionExpression {
        const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const parameters: Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>> = this.readParameterList(() =>
            this.maybeReadAsNullablePrimitiveType(),
        );
        const maybeFunctionReturnType: Option<Ast.AsNullablePrimitiveType> = this.maybeReadAsNullablePrimitiveType();
        const fatArrowConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.FatArrow);
        const expression: Ast.TExpression = this.readExpression();

        const astNode: Ast.FunctionExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            parameters,
            maybeFunctionReturnType,
            fatArrowConstant,
            expression,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.22 Each expression
    private readEachExpression(): Ast.EachExpression {
        return this.readPairedConstant<Ast.NodeKind.EachExpression, Ast.TExpression>(
            Ast.NodeKind.EachExpression,
            () => this.readTokenKindAsConstant(TokenKind.KeywordEach),
            () => this.readExpression(),
        );
    }

    // 12.2.3.23 Let expression
    private readLetExpression(): Ast.LetExpression {
        const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const letConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordLet);
        const identifierExpressionPairedExpressions: ReadonlyArray<
            Ast.ICsv<Ast.IdentifierPairedExpression>
        > = this.readIdentifierPairedExpressions(true);
        const inConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordIn);
        const expression: Ast.TExpression = this.readExpression();

        const astNode: Ast.LetExpression = {
            ...this.expectContextNodeMetadata(),
            kind: Ast.NodeKind.LetExpression,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            letConstant,
            variableList: identifierExpressionPairedExpressions,
            inConstant,
            expression,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.24 If expression
    private readIfExpression(): Ast.IfExpression {
        const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const ifConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordIf);
        const condition: Ast.TExpression = this.readExpression();

        const thenConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordThen);
        const trueExpression: Ast.TExpression = this.readExpression();

        const elseConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordElse);
        const falseExpression: Ast.TExpression = this.readExpression();

        const astNode: Ast.IfExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            ifConstant,
            condition,
            thenConstant,
            trueExpression,
            elseConstant,
            falseExpression,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.25 Type expression
    private readTypeExpression(): Ast.TTypeExpression {
        if (this.isOnTokenKind(TokenKind.KeywordType)) {
            return this.readPairedConstant<Ast.NodeKind.TypePrimaryType, Ast.TPrimaryType>(
                Ast.NodeKind.TypePrimaryType,
                () => this.readTokenKindAsConstant(TokenKind.KeywordType),
                () => this.readPrimaryType(),
            );
        } else {
            return this.readPrimaryExpression();
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readType(): Ast.TType {
        const triedReadPrimaryType: TryReadPrimaryType = this.tryReadPrimaryType();

        if (triedReadPrimaryType.kind === ResultKind.Ok) {
            return triedReadPrimaryType.value;
        } else {
            return this.readPrimaryExpression();
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readPrimaryType(): Ast.TPrimaryType {
        const triedReadPrimaryType: TryReadPrimaryType = this.tryReadPrimaryType();

        if (triedReadPrimaryType.kind === ResultKind.Ok) {
            return triedReadPrimaryType.value;
        } else {
            throw triedReadPrimaryType.error;
        }
    }

    private tryReadPrimaryType(): TryReadPrimaryType {
        const backup: StateBackup = this.backupState();

        const isTableTypeNext: boolean =
            this.isOnIdentifierConstant(Ast.IdentifierConstant.Table) &&
            (this.isNextTokenKind(TokenKind.LeftBracket) ||
                this.isNextTokenKind(TokenKind.LeftParenthesis) ||
                this.isNextTokenKind(TokenKind.AtSign) ||
                this.isNextTokenKind(TokenKind.Identifier));
        const isFunctionTypeNext: boolean =
            this.isOnIdentifierConstant(Ast.IdentifierConstant.Function) &&
            this.isNextTokenKind(TokenKind.LeftParenthesis);

        if (this.isOnTokenKind(TokenKind.LeftBracket)) {
            return {
                kind: ResultKind.Ok,
                value: this.readRecordType(),
            };
        } else if (this.isOnTokenKind(TokenKind.LeftBrace)) {
            return {
                kind: ResultKind.Ok,
                value: this.readListType(),
            };
        } else if (isTableTypeNext) {
            return {
                kind: ResultKind.Ok,
                value: this.readTableType(),
            };
        } else if (isFunctionTypeNext) {
            return {
                kind: ResultKind.Ok,
                value: this.readFunctionType(),
            };
        } else if (this.isOnIdentifierConstant(Ast.IdentifierConstant.Nullable)) {
            return {
                kind: ResultKind.Ok,
                value: this.readNullableType(),
            };
        } else {
            const triedReadPrimitiveType: TryReadPrimaryType = this.tryReadPrimitiveType();

            if (triedReadPrimitiveType.kind === ResultKind.Err) {
                this.restoreBackup(backup);
            }
            return triedReadPrimitiveType;
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readRecordType(): Ast.RecordType {
        const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const fields: Ast.FieldSpecificationList = this.readFieldSpecificationList(true);

        const astNode: Ast.RecordType = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            fields,
        };
        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.3.25 Type expression
    private readTableType(): Ast.TableType {
        const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const tableConstant: Ast.Constant = this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Table);
        const maybeCurrentTokenKind: Option<TokenKind> = this.maybeCurrentTokenKind;
        const isPrimaryExpressionExpected: boolean =
            maybeCurrentTokenKind === TokenKind.AtSign ||
            maybeCurrentTokenKind === TokenKind.Identifier ||
            maybeCurrentTokenKind === TokenKind.LeftParenthesis;

        let rowType: Ast.FieldSpecificationList | Ast.TPrimaryExpression;
        if (isPrimaryExpressionExpected) {
            rowType = this.readPrimaryExpression();
        } else {
            rowType = this.readFieldSpecificationList(false);
        }

        const astNode: Ast.TableType = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            tableConstant,
            rowType,
        };
        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.3.25 Type expression
    private readFieldSpecificationList(allowOpenMarker: boolean): Ast.FieldSpecificationList {
        const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const leftBracketConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.LeftBracket);
        const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
        let continueReadingValues: boolean = true;
        let maybeOpenRecordMarkerConstant: Option<Ast.Constant> = undefined;

        while (continueReadingValues) {
            if (this.isOnTokenKind(TokenKind.Ellipsis)) {
                if (allowOpenMarker) {
                    if (maybeOpenRecordMarkerConstant) {
                        throw this.fieldSpecificationListReadError(false);
                    } else {
                        maybeOpenRecordMarkerConstant = this.readTokenKindAsConstant(TokenKind.Ellipsis);
                        continueReadingValues = false;
                    }
                } else {
                    throw this.fieldSpecificationListReadError(allowOpenMarker);
                }
            } else if (this.isOnTokenKind(TokenKind.Identifier)) {
                const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
                this.startContext(csvNodeKind);
                this.startTokenRange(csvNodeKind);

                const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
                this.startContext(fieldSpecificationNodeKind);
                this.startTokenRange(fieldSpecificationNodeKind);

                const maybeOptionalConstant: Option<Ast.Constant> = this.maybeReadIdentifierConstantAsConstant(
                    Ast.IdentifierConstant.Optional,
                );
                const name: Ast.GeneralizedIdentifier = this.readGeneralizedIdentifier();
                const maybeFieldTypeSpeification: Option<
                    Ast.FieldTypeSpecification
                > = this.maybeReadFieldTypeSpecification();
                const maybeCommaConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
                continueReadingValues = maybeCommaConstant !== undefined;

                const field: Ast.FieldSpecification = {
                    ...this.expectContextNodeMetadata(),
                    kind: fieldSpecificationNodeKind,
                    tokenRange: this.popTokenRange(),
                    isLeaf: false,
                    maybeOptionalConstant,
                    name,
                    maybeFieldTypeSpeification,
                };
                this.endContext(field);

                const csv: Ast.ICsv<Ast.FieldSpecification> = {
                    ...this.expectContextNodeMetadata(),
                    kind: csvNodeKind,
                    tokenRange: this.popTokenRange(),
                    isLeaf: false,
                    node: field,
                    maybeCommaConstant,
                };
                this.endContext(csv);
                fields.push(csv);
            } else {
                throw this.fieldSpecificationListReadError(allowOpenMarker);
            }
        }

        const rightBracketConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.RightBracket);

        const astNode: Ast.FieldSpecificationList = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            openWrapperConstant: leftBracketConstant,
            content: fields,
            maybeOpenRecordMarkerConstant,
            closeWrapperConstant: rightBracketConstant,
        };
        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.3.25 Type expression
    private maybeReadFieldTypeSpecification(): Option<Ast.FieldTypeSpecification> {
        const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const maybeEqualConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Equal);
        if (maybeEqualConstant) {
            const fieldType: Ast.TType = this.readType();

            const astNode: Ast.FieldTypeSpecification = {
                ...this.expectContextNodeMetadata(),
                kind: Ast.NodeKind.FieldTypeSpecification,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                equalConstant: maybeEqualConstant,
                fieldType,
            };
            this.endContext(astNode);
            return astNode;
        } else {
            this.popTokenRangeNoop();
            this.deleteContext(undefined);
            return undefined;
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readFunctionType(): Ast.FunctionType {
        const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const functionConstant: Ast.Constant = this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Function);
        const parameters: Ast.IParameterList<Ast.AsType> = this.readParameterList(() => this.readAsType());
        const functionReturnType: Ast.AsType = this.readAsType();

        const astNode: Ast.FunctionType = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            functionConstant,
            parameters,
            functionReturnType,
        };
        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.3.25 Type expression
    private readNullableType(): Ast.NullableType {
        return this.readPairedConstant<Ast.NodeKind.NullableType, Ast.TType>(
            Ast.NodeKind.NullableType,
            () => this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Nullable),
            () => this.readType(),
        );
    }

    // 12.2.3.26 Error raising expression
    private readErrorRaisingExpression(): Ast.ErrorRaisingExpression {
        return this.readPairedConstant<Ast.NodeKind.ErrorRaisingExpression, Ast.TExpression>(
            Ast.NodeKind.ErrorRaisingExpression,
            () => this.readTokenKindAsConstant(TokenKind.KeywordError),
            () => this.readExpression(),
        );
    }

    // 12.2.3.27 Error handling expression
    private readErrorHandlingExpression(): Ast.ErrorHandlingExpression {
        const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const tryConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordTry);
        const protectedExpression: Ast.TExpression = this.readExpression();

        const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
        const maybeOtherwiseExpression: Option<Ast.OtherwiseExpression> = this.maybeReadPairedConstant<
            Ast.NodeKind.OtherwiseExpression,
            Ast.TExpression
        >(
            otherwiseExpressionNodeKind,
            () => this.isOnTokenKind(TokenKind.KeywordOtherwise),
            () => this.readTokenKindAsConstant(TokenKind.KeywordOtherwise),
            () => this.readExpression(),
        );

        const astNode: Ast.ErrorHandlingExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            tryConstant,
            protectedExpression,
            maybeOtherwiseExpression,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.4 Literal Attributes
    private maybeReadLiteralAttributes(): Option<Ast.RecordLiteral> {
        if (this.isOnTokenKind(TokenKind.LeftBracket)) {
            return this.readRecordLiteral();
        } else {
            return undefined;
        }
    }

    private readRecordLiteral(): Ast.RecordLiteral {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightBracket);
        const wrappedRead: Ast.IWrapped<
            Ast.NodeKind.RecordLiteral,
            ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedAnyLiteral>>
        > = this.readWrapped<
            Ast.NodeKind.RecordLiteral,
            ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedAnyLiteral>>
        >(
            Ast.NodeKind.RecordLiteral,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readFieldNamePairedAnyLiterals(continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
            false,
        );
        return {
            literalKind: Ast.LiteralKind.Record,
            ...wrappedRead,
        };
    }

    private readFieldNamePairedAnyLiterals(
        continueReadingValues: boolean,
    ): ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedAnyLiteral>> {
        return this.readCsv(
            () =>
                this.readKeyValuePair<
                    Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                    Ast.GeneralizedIdentifier,
                    Ast.TAnyLiteral
                >(
                    Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                    () => this.readGeneralizedIdentifier(),
                    () => this.readAnyLiteral(),
                ),
            continueReadingValues,
        );
    }

    private readListLiteral(): Ast.ListLiteral {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightBrace);
        const wrappedRead: Ast.IWrapped<
            Ast.NodeKind.ListLiteral,
            ReadonlyArray<Ast.ICsv<Ast.TAnyLiteral>>
        > = this.readWrapped<Ast.NodeKind.ListLiteral, ReadonlyArray<Ast.ICsv<Ast.TAnyLiteral>>>(
            Ast.NodeKind.ListLiteral,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readCsv(() => this.readAnyLiteral(), continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
            false,
        );
        return {
            literalKind: Ast.LiteralKind.List,
            ...wrappedRead,
        };
    }

    private readAnyLiteral(): Ast.TAnyLiteral {
        if (this.isOnTokenKind(TokenKind.LeftBracket)) {
            return this.readRecordLiteral();
        } else if (this.isOnTokenKind(TokenKind.LeftBrace)) {
            return this.readListLiteral();
        } else {
            return this.readLiteralExpression();
        }
    }

    private readParameterList<T>(typeReader: () => T & Ast.TParameterType): Ast.IParameterList<T> {
        const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const leftParenthesisConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.LeftParenthesis);
        let continueReadingValues: boolean = !this.isOnTokenKind(TokenKind.RightParenthesis);
        let reachedOptionalParameter: boolean = false;

        const parameters: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>>[] = [];
        while (continueReadingValues) {
            this.startContext(Ast.NodeKind.Csv);
            this.startTokenRange(Ast.NodeKind.Csv);
            this.startContext(Ast.NodeKind.Parameter);
            this.startTokenRange(Ast.NodeKind.Parameter);
            const maybeOptionalConstant: Option<Ast.Constant> = this.maybeReadIdentifierConstantAsConstant(
                Ast.IdentifierConstant.Optional,
            );

            if (reachedOptionalParameter && !maybeOptionalConstant) {
                const token: Token = this.expectTokenAt(this.tokenIndex);
                throw new ParserError.RequiredParameterAfterOptionalParameterError(
                    token,
                    this.lexerSnapshot.graphemePositionStartFrom(token),
                );
            } else if (maybeOptionalConstant) {
                reachedOptionalParameter = true;
            }

            const name: Ast.Identifier = this.readIdentifier();
            const maybeParameterType: T & Ast.TParameterType = typeReader();
            const parameter: Ast.IParameter<T & Ast.TParameterType> = {
                ...this.expectContextNodeMetadata(),
                kind: Ast.NodeKind.Parameter,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeParameterType,
            };
            this.endContext(parameter);

            const maybeCommaConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            const csv: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>> = {
                ...this.expectContextNodeMetadata(),
                kind: Ast.NodeKind.Csv,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                node: parameter,
                maybeCommaConstant,
            };
            this.endContext(csv);

            parameters.push(csv);
        }

        const rightParenthesisConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.RightParenthesis);

        const astNode: Ast.IParameterList<T & Ast.TParameterType> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            openWrapperConstant: leftParenthesisConstant,
            content: parameters,
            closeWrapperConstant: rightParenthesisConstant,
        };
        this.endContext(astNode);
        return astNode;
    }

    private maybeReadAsNullablePrimitiveType(): Option<Ast.AsNullablePrimitiveType> {
        return this.maybeReadPairedConstant<Ast.NodeKind.AsNullablePrimitiveType, Ast.TNullablePrimitiveType>(
            Ast.NodeKind.AsNullablePrimitiveType,
            () => this.isOnTokenKind(TokenKind.KeywordAs),
            () => this.readTokenKindAsConstant(TokenKind.KeywordAs),
            () => this.readNullablePrimitiveType(),
        );
    }

    private readAsType(): Ast.AsType {
        return this.readPairedConstant<Ast.NodeKind.AsType, Ast.TType>(
            Ast.NodeKind.AsType,
            () => this.readTokenKindAsConstant(TokenKind.KeywordAs),
            () => this.readType(),
        );
    }

    private readListType(): Ast.ListType {
        return this.readWrapped<Ast.NodeKind.ListType, Ast.TType>(
            Ast.NodeKind.ListType,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readType(),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
            false,
        );
    }

    private readRecursivePrimaryExpression(head: Ast.TPrimaryExpression): Ast.RecursivePrimaryExpression {
        const tokenRangeStart: number = head.tokenRange.startTokenIndex;
        const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
        this.startContext(nodeKind);
        this.startTokenRangeAt(nodeKind, tokenRangeStart);

        const recursiveExpressions: Ast.TRecursivePrimaryExpression[] = [];
        let continueReadingValues: boolean = true;

        while (continueReadingValues) {
            const maybeCurrentTokenKind: Option<TokenKind> = this.maybeCurrentTokenKind;

            if (maybeCurrentTokenKind === TokenKind.LeftParenthesis) {
                recursiveExpressions.push(this.readInvokeExpression());
            } else if (maybeCurrentTokenKind === TokenKind.LeftBrace) {
                recursiveExpressions.push(this.readItemAccessExpression());
            } else if (maybeCurrentTokenKind === TokenKind.LeftBracket) {
                const disambiguation: BracketDisambiguation = this.disambiguateBracket();

                switch (disambiguation) {
                    case BracketDisambiguation.FieldProjection:
                        recursiveExpressions.push(this.readFieldProjection());
                        break;

                    case BracketDisambiguation.FieldSelection:
                        recursiveExpressions.push(this.readFieldSelection());
                        break;

                    default:
                        throw new CommonError.InvariantError(
                            `grammer doesn't allow remaining BracketDisambiguation: ${disambiguation}`,
                        );
                }
            } else {
                continueReadingValues = false;
            }
        }

        const astNode: Ast.RecursivePrimaryExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            head,
            recursiveExpressions,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readIdentifier(): Ast.Identifier {
        const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
        this.startContext(nodeKind);

        const tokenRange: TokenRange = this.singleTokenRange(TokenKind.Identifier);
        const literal: string = this.readTokenKind(TokenKind.Identifier);

        const astNode: Ast.Identifier = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange,
            isLeaf: true,
            literal,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readGeneralizedIdentifier(): Ast.GeneralizedIdentifier {
        const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        let literal: string;

        const currentTokenKind: Option<TokenKind> = this.maybeCurrentTokenKind;
        const isKeywordGeneralizedIdentifier: boolean =
            currentTokenKind === TokenKind.KeywordAnd ||
            currentTokenKind === TokenKind.KeywordAs ||
            currentTokenKind === TokenKind.KeywordEach ||
            currentTokenKind === TokenKind.KeywordElse ||
            currentTokenKind === TokenKind.KeywordError ||
            currentTokenKind === TokenKind.KeywordFalse ||
            currentTokenKind === TokenKind.KeywordIf ||
            currentTokenKind === TokenKind.KeywordIn ||
            currentTokenKind === TokenKind.KeywordIs ||
            currentTokenKind === TokenKind.KeywordLet ||
            currentTokenKind === TokenKind.KeywordMeta ||
            currentTokenKind === TokenKind.KeywordNot ||
            currentTokenKind === TokenKind.KeywordOtherwise ||
            currentTokenKind === TokenKind.KeywordOr ||
            currentTokenKind === TokenKind.KeywordSection ||
            currentTokenKind === TokenKind.KeywordShared ||
            currentTokenKind === TokenKind.KeywordThen ||
            currentTokenKind === TokenKind.KeywordTrue ||
            currentTokenKind === TokenKind.KeywordTry ||
            currentTokenKind === TokenKind.KeywordType;
        if (isKeywordGeneralizedIdentifier) {
            literal = this.readToken();
        } else {
            const firstIdentifierTokenIndex: number = this.tokenIndex;
            let lastIdentifierTokenIndex: number = firstIdentifierTokenIndex;
            while (this.isOnTokenKind(TokenKind.Identifier)) {
                lastIdentifierTokenIndex = this.tokenIndex;
                this.readToken();
            }

            const lexerSnapshot: LexerSnapshot = this.lexerSnapshot;
            const tokens: ReadonlyArray<Token> = lexerSnapshot.tokens;
            const contiguousIdentifierStartIndex: number = tokens[firstIdentifierTokenIndex].positionStart.codeUnit;
            const contiguousIdentifierEndIndex: number = tokens[lastIdentifierTokenIndex].positionEnd.codeUnit;
            literal = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);
        }

        const astNode: Ast.GeneralizedIdentifier = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: true,
            literal,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readPrimitiveType(): Ast.PrimitiveType {
        const triedReadPrimitiveType: TryReadPrimitiveType = this.tryReadPrimitiveType();
        if (triedReadPrimitiveType.kind === ResultKind.Ok) {
            return triedReadPrimitiveType.value;
        } else {
            throw triedReadPrimitiveType.error;
        }
    }

    private tryReadPrimitiveType(): TryReadPrimitiveType {
        const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const backup: StateBackup = this.backupState();
        const expectedTokenKinds: ReadonlyArray<TokenKind> = [
            TokenKind.Identifier,
            TokenKind.KeywordType,
            TokenKind.NullLiteral,
        ];
        const maybeErr: Option<ParserError.ExpectedAnyTokenKindError> = this.expectAnyTokenKind(expectedTokenKinds);
        if (maybeErr) {
            throw maybeErr;
        }

        let primitiveType: Ast.Constant;
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            const currentTokenData: string = this.lexerSnapshot.tokens[this.tokenIndex].data;
            switch (currentTokenData) {
                case Ast.IdentifierConstant.Any:
                case Ast.IdentifierConstant.AnyNonNull:
                case Ast.IdentifierConstant.Binary:
                case Ast.IdentifierConstant.Date:
                case Ast.IdentifierConstant.DateTime:
                case Ast.IdentifierConstant.DateTimeZone:
                case Ast.IdentifierConstant.Duration:
                case Ast.IdentifierConstant.Function:
                case Ast.IdentifierConstant.List:
                case Ast.IdentifierConstant.Logical:
                case Ast.IdentifierConstant.None:
                case Ast.IdentifierConstant.Number:
                case Ast.IdentifierConstant.Record:
                case Ast.IdentifierConstant.Table:
                case Ast.IdentifierConstant.Text:
                    primitiveType = this.readIdentifierConstantAsConstant(currentTokenData);
                    break;

                default:
                    const token: Token = this.expectTokenAt(this.tokenIndex);
                    this.restoreBackup(backup);
                    return {
                        kind: ResultKind.Err,
                        error: new ParserError.InvalidPrimitiveTypeError(
                            token,
                            this.lexerSnapshot.graphemePositionStartFrom(token),
                        ),
                    };
            }
        } else if (this.isOnTokenKind(TokenKind.KeywordType)) {
            primitiveType = this.readTokenKindAsConstant(TokenKind.KeywordType);
        } else if (this.isOnTokenKind(TokenKind.NullLiteral)) {
            primitiveType = this.readTokenKindAsConstant(TokenKind.NullLiteral);
        } else {
            const details: {} = { tokenKind: this.maybeCurrentTokenKind };
            this.restoreBackup(backup);
            return {
                kind: ResultKind.Err,
                error: new CommonError.InvariantError(
                    `unknown currentTokenKind, not found in [${expectedTokenKinds}]`,
                    details,
                ),
            };
        }

        const astNode: Ast.PrimitiveType = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            primitiveType,
        };
        this.endContext(astNode);
        return {
            kind: ResultKind.Ok,
            value: astNode,
        };
    }

    private readIdentifierPairedExpressions(
        continueReadingValues: boolean,
    ): ReadonlyArray<Ast.ICsv<Ast.IdentifierPairedExpression>> {
        return this.readCsv(() => this.readIdentifierPairedExpression(), continueReadingValues);
    }

    private readGeneralizedIdentifierPairedExpressions(
        continueReadingValues: boolean,
    ): ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedExpression>> {
        return this.readCsv(() => this.readGeneralizedIdentifierPairedExpression(), continueReadingValues);
    }

    private readGeneralizedIdentifierPairedExpression(): Ast.GeneralizedIdentifierPairedExpression {
        return this.readKeyValuePair<
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.GeneralizedIdentifier,
            Ast.TExpression
        >(
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            () => this.readGeneralizedIdentifier(),
            () => this.readExpression(),
        );
    }

    private readIdentifierPairedExpression(): Ast.IdentifierPairedExpression {
        return this.readKeyValuePair<Ast.NodeKind.IdentifierPairedExpression, Ast.Identifier, Ast.TExpression>(
            Ast.NodeKind.IdentifierPairedExpression,
            () => this.readIdentifier(),
            () => this.readExpression(),
        );
    }

    private readToken(): string {
        const tokens: ReadonlyArray<Token> = this.lexerSnapshot.tokens;

        if (this.tokenIndex >= tokens.length) {
            const details: {} = {
                tokenIndex: this.tokenIndex,
                "tokens.length": tokens.length,
            };
            throw new CommonError.InvariantError("index beyond tokens.length", details);
        }

        const data: string = tokens[this.tokenIndex].data;
        this.tokenIndex += 1;

        if (this.tokenIndex === tokens.length) {
            this.maybeCurrentTokenKind = undefined;
        } else {
            this.maybeCurrentToken = tokens[this.tokenIndex];
            this.maybeCurrentTokenKind = this.maybeCurrentToken.kind;
        }

        return data;
    }

    private readTokenKind(tokenKind: TokenKind): string {
        const maybeErr: Option<ParserError.ExpectedTokenKindError> = this.expectTokenKind(tokenKind);
        if (maybeErr) {
            throw maybeErr;
        }

        return this.readToken();
    }

    private readTokenKindAsConstant(tokenKind: TokenKind): Ast.Constant {
        const maybeConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(tokenKind);
        if (!maybeConstant) {
            const maybeErr: Option<ParserError.ExpectedTokenKindError> = this.expectTokenKind(tokenKind);
            if (maybeErr) {
                throw maybeErr;
            } else {
                const details: {} = {
                    expectedTokenKind: tokenKind,
                    actualTokenKind: this.maybeCurrentTokenKind,
                };
                throw new CommonError.InvariantError(
                    "failures from maybeReadTokenKindAsConstant should be reportable by expectTokenKind",
                    details,
                );
            }
        }

        return maybeConstant;
    }

    private maybeReadTokenKindAsConstant(tokenKind: TokenKind): Option<Ast.Constant> {
        if (this.isOnTokenKind(tokenKind)) {
            const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
            this.startContext(nodeKind);

            const tokenRange: TokenRange = this.singleTokenRange(tokenKind);
            const maybeConstantKind: Option<Ast.ConstantKind> = Ast.constantKindFromTokenKind(tokenKind);
            if (maybeConstantKind === undefined) {
                throw new CommonError.InvariantError(`couldn't convert TokenKind=${tokenKind} into ConstantKind`);
            }
            const constantKind: Ast.ConstantKind = maybeConstantKind;

            this.readToken();
            const astNode: Ast.Constant = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                tokenRange,
                isLeaf: true,
                literal: constantKind,
            };
            this.endContext(astNode);

            return astNode;
        } else {
            return undefined;
        }
    }

    private readIdentifierConstantAsConstant(identifierConstant: Ast.IdentifierConstant): Ast.Constant {
        const maybeConstant: Option<Ast.Constant> = this.maybeReadIdentifierConstantAsConstant(identifierConstant);
        if (!maybeConstant) {
            throw new CommonError.InvariantError(
                `couldn't convert IdentifierConstant=${identifierConstant} into ConstantKind`,
            );
        }

        return maybeConstant;
    }

    private maybeReadIdentifierConstantAsConstant(identifierConstant: Ast.IdentifierConstant): Option<Ast.Constant> {
        if (this.isOnIdentifierConstant(identifierConstant)) {
            const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
            this.startContext(nodeKind);
            const tokenRange: TokenRange = this.singleTokenRange(identifierConstant);

            const maybeConstantKind: Option<Ast.ConstantKind> = Ast.constantKindFromIdentifieConstant(
                identifierConstant,
            );
            if (!maybeConstantKind) {
                throw new CommonError.InvariantError(
                    `couldn't convert IdentifierConstant=${identifierConstant} into ConstantKind`,
                );
            }

            this.readToken();
            const astNode: Ast.Constant = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                tokenRange,
                isLeaf: true,
                literal: maybeConstantKind,
            };
            this.endContext(astNode);
            return astNode;
        } else {
            return undefined;
        }
    }

    private readUnaryOperatorAsConstant(operator: Ast.TUnaryExpressionHelperOperator): Ast.Constant {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        this.startContext(nodeKind);
        const tokenRange: TokenRange = this.singleTokenRange(operator);

        this.readToken();

        const astNode: Ast.Constant = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange,
            isLeaf: true,
            literal: operator,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readKeyword(): Ast.IdentifierExpression {
        const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
        this.startContext(identifierExpressionNodeKind);
        const identifierExpressionTokenRange: TokenRange = this.singleTokenRange(TokenKind.Identifier);

        const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
        this.startContext(identifierNodeKind);
        const identifierTokenRange: TokenRange = this.singleTokenRange(TokenKind.Identifier);

        const literal: string = this.readToken();
        const identifier: Ast.Identifier = {
            ...this.expectContextNodeMetadata(),
            kind: identifierNodeKind,
            tokenRange: identifierTokenRange,
            isLeaf: true,
            literal,
        };
        this.endContext(identifier);

        const identifierExpression: Ast.IdentifierExpression = {
            ...this.expectContextNodeMetadata(),
            kind: identifierExpressionNodeKind,
            tokenRange: identifierExpressionTokenRange,
            isLeaf: false,
            maybeInclusiveConstant: undefined,
            identifier,
        };
        this.endContext(identifierExpression);
        return identifierExpression;
    }

    private fieldSpecificationListReadError(allowOpenMarker: boolean): Option<Error> {
        if (allowOpenMarker) {
            const expectedTokenKinds: ReadonlyArray<TokenKind> = [TokenKind.Identifier, TokenKind.Ellipsis];
            return this.expectAnyTokenKind(expectedTokenKinds);
        } else {
            return this.expectTokenKind(TokenKind.Identifier);
        }
    }

    private expectNoMoreTokens(): Option<ParserError.UnusedTokensRemainError> {
        if (this.tokenIndex !== this.lexerSnapshot.tokens.length) {
            const token: Token = this.expectTokenAt(this.tokenIndex);
            return new ParserError.UnusedTokensRemainError(token, this.lexerSnapshot.graphemePositionStartFrom(token));
        } else {
            return undefined;
        }
    }

    private expectTokenKind(expectedTokenKind: TokenKind): Option<ParserError.ExpectedTokenKindError> {
        if (expectedTokenKind !== this.maybeCurrentTokenKind) {
            const maybeTokenWithColumnNumber: Option<ParserError.TokenWithColumnNumber> =
                this.maybeCurrentToken !== undefined
                    ? {
                          token: this.maybeCurrentToken,
                          columnNumber: this.lexerSnapshot.columnNumberStartFrom(this.maybeCurrentToken),
                      }
                    : undefined;
            return new ParserError.ExpectedTokenKindError(expectedTokenKind, maybeTokenWithColumnNumber);
        } else {
            return undefined;
        }
    }

    private expectAnyTokenKind(
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
    ): Option<ParserError.ExpectedAnyTokenKindError> {
        const isError: boolean =
            this.maybeCurrentTokenKind === undefined || expectedAnyTokenKind.indexOf(this.maybeCurrentTokenKind) === -1;

        if (isError) {
            const maybeTokenWithColumnNumber: Option<ParserError.TokenWithColumnNumber> =
                this.maybeCurrentToken !== undefined
                    ? {
                          token: this.maybeCurrentToken,
                          columnNumber: this.lexerSnapshot.columnNumberStartFrom(this.maybeCurrentToken),
                      }
                    : undefined;
            return new ParserError.ExpectedAnyTokenKindError(expectedAnyTokenKind, maybeTokenWithColumnNumber);
        } else {
            return undefined;
        }
    }

    private readBinOpKeywordExpression<NodeKindVariant, L, KeywordTokenKindVariant, R>(
        nodeKind: NodeKindVariant & Ast.TBinOpKeywordNodeKind,
        leftExpressionReader: () => L,
        keywordTokenKind: KeywordTokenKindVariant & TokenKind,
        rightExpressionReader: () => R,
    ): L | Ast.IBinOpKeyword<NodeKindVariant, L, R> {
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const left: L = leftExpressionReader();
        const maybeConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(keywordTokenKind);

        if (maybeConstant) {
            const right: R = rightExpressionReader();

            const astNode: Ast.IBinOpKeyword<NodeKindVariant, L, R> = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                left,
                constant: maybeConstant,
                right,
            };

            // UNSAFE MARKER
            //
            // Purpose of code block:
            //      End the context started within the same function.
            //
            // Why are you trying to avoid a safer approach?
            //      endContext takes an Ast.TNode, but due to generics the parser
            //      can't prove for all types A, B, C, D that Ast.IBinOpKeyword<A, B, C, D>
            //      results in an Ast.TNode.
            //
            //      The alternative approach is let the callers of readBinOpKeywordExpression
            //      take the return and end the context themselves, which is messy.
            //
            // Why is it safe?
            //      All Ast.NodeKind.IBinOpKeyword used by the parser are of Ast.TBinOpKeywordExpression,
            //      a sub type of Ast.TNode.
            this.endContext((astNode as unknown) as Ast.TBinOpKeywordExpression);
            return astNode;
        } else {
            this.popTokenRangeNoop();
            this.deleteContext(undefined);
            return left;
        }
    }

    private readBinOpExpression<NodeKindVariant, Op, Operand>(
        nodeKind: NodeKindVariant & Ast.TBinOpExpressionNodeKind,
        operatorFrom: (tokenKind: Option<TokenKind>) => Option<Op & Ast.TUnaryExpressionHelperOperator>,
        operandReader: () => Operand,
    ): Operand | Ast.IBinOpExpression<NodeKindVariant, Op, Operand> {
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);
        const first: Operand = operandReader();

        let maybeOperator: Option<Op & Ast.TUnaryExpressionHelperOperator> = operatorFrom(this.maybeCurrentTokenKind);
        if (maybeOperator) {
            const rest: Ast.UnaryExpressionHelper<Op, Operand>[] = [];

            while (maybeOperator) {
                const helperNodeKind: Ast.NodeKind.UnaryExpressionHelper = Ast.NodeKind.UnaryExpressionHelper;
                this.startContext(helperNodeKind);
                this.startTokenRange(helperNodeKind);

                const operatorConstant: Ast.Constant = this.readUnaryOperatorAsConstant(maybeOperator);

                const helper: Ast.UnaryExpressionHelper<Op, Operand> = {
                    ...this.expectContextNodeMetadata(),
                    kind: helperNodeKind,
                    tokenRange: this.popTokenRange(),
                    isLeaf: false,
                    inBinaryExpression: true,
                    operator: maybeOperator,
                    operatorConstant,
                    node: operandReader(),
                };
                rest.push(helper);
                // UNSAFE MARKER
                //
                // Purpose of code block:
                //      End the context started within the same function.
                //
                // Why are you trying to avoid a safer approach?
                //      endContext takes an Ast.TNode, but due to generics the parser
                //      can't prove for all types A, B, C that Ast.UnaryExpressionHelper<A, B>
                //      results in an Ast.TNode.
                //
                //      The alternative approach is let the callers of readBinOpExpression
                //      take the return and end the context themselves, which is messy.
                //
                // Why is it safe?
                //      All Ast.NodeKind.UnaryExpressionHelper used by the parser are of Ast.TUnaryExpressionHelper,
                //      a sub type of Ast.TNode.
                this.endContext((helper as unknown) as Ast.TUnaryExpressionHelper);
                maybeOperator = operatorFrom(this.maybeCurrentTokenKind);
            }

            const astNode: Ast.IBinOpExpression<NodeKindVariant, Op, Operand> = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                first,
                rest,
            };
            // UNSAFE MARKER
            //
            // Purpose of code block:
            //      End the context started within the same function.
            //
            // Why are you trying to avoid a safer approach?
            //      endContext takes an Ast.TNode, but due to generics the parser
            //      can't prove for all types A, B, C that Ast.IBinOpExpression<A, B, C>
            //      results in an Ast.TNode.
            //
            //      The alternative approach is let the callers of readBinOpExpression
            //      take the return and end the context themselves, which is messy.
            //
            // Why is it safe?
            //      All Ast.NodeKind.IBinOpExpression used by the parser are of Ast.TBinOpExpression,
            //      a sub type of Ast.TNode.
            this.endContext((astNode as unknown) as Ast.TBinOpExpression);
            return astNode;
        } else {
            this.popTokenRangeNoop();
            this.deleteContext(undefined);
            return first;
        }
    }

    private readPairedConstant<NodeKindVariant, Paired>(
        nodeKind: NodeKindVariant & Ast.TPairedConstantNodeKind,
        constantReader: () => Ast.Constant,
        pairedReader: () => Paired,
    ): Ast.IPairedConstant<NodeKindVariant, Paired> {
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const constant: Ast.Constant = constantReader();
        const paired: Paired = pairedReader();

        const pairedConstant: Ast.IPairedConstant<NodeKindVariant, Paired> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            constant,
            paired,
        };

        // UNSAFE MARKER
        //
        // Purpose of code block:
        //      End the context started within the same function.
        //
        // Why are you trying to avoid a safer approach?
        //      endContext takes an Ast.TNode, but due to generics the parser
        //      can't prove for all types A, B that Ast.IPairedConstant<A, B>
        //      results in an Ast.TNode.
        //
        //      The alternative approach is let the callers of readPairedConstant
        //      take the return and end the context themselves, which is messy.
        //
        // Why is it safe?
        //      All Ast.NodeKind.IPairedConstant used by the parser are of Ast.TPairedConstant,
        //      a sub type of Ast.TNode.
        this.endContext((pairedConstant as unknown) as Ast.TPairedConstant);

        return pairedConstant;
    }

    private maybeReadPairedConstant<NodeKindVariant, Paired>(
        nodeKind: NodeKindVariant & Ast.TPairedConstantNodeKind,
        condition: () => boolean,
        constantReader: () => Ast.Constant,
        pairedReader: () => Paired,
    ): Option<Ast.IPairedConstant<NodeKindVariant, Paired>> {
        if (condition()) {
            return this.readPairedConstant<NodeKindVariant, Paired>(nodeKind, constantReader, pairedReader);
        } else {
            return undefined;
        }
    }

    private readWrapped<NodeKindVariant, Content>(
        nodeKind: NodeKindVariant & Ast.TWrappedNodeKind,
        openConstantReader: () => Ast.Constant,
        contentReader: () => Content,
        closeConstantReader: () => Ast.Constant,
        allowOptionalConstant: boolean,
    ): WrappedRead<NodeKindVariant, Content> {
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const openWrapperConstant: Ast.Constant = openConstantReader();
        const content: Content = contentReader();
        const closeWrapperConstant: Ast.Constant = closeConstantReader();

        let maybeOptionalConstant: Option<Ast.Constant>;
        if (allowOptionalConstant) {
            maybeOptionalConstant = this.maybeReadTokenKindAsConstant(TokenKind.QuestionMark);
        }

        const wrapped: WrappedRead<NodeKindVariant, Content> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            openWrapperConstant,
            content,
            closeWrapperConstant,
            maybeOptionalConstant,
        };

        // UNSAFE MARKER
        //
        // Purpose of code block:
        //      End the context started within the same function.
        //
        // Why are you trying to avoid a safer approach?
        //      endContext takes an Ast.TNode, but due to generics the parser
        //      can't prove for all types A, B that Ast.IWrapped<A, B>
        //      results in an Ast.TNode.
        //
        //      The alternative approach is let the callers of readWrapped
        //      take the return and end the context themselves, which is messy.
        //
        // Why is it safe?
        //      All Ast.NodeKind.IWrapped used by the parser are of Ast.TWrapped,
        //      a sub type of Ast.TNode.
        this.endContext((wrapped as unknown) as Ast.TWrapped);
        return wrapped;
    }

    private readKeyValuePair<NodeKindVariant, Key, Value>(
        nodeKind: NodeKindVariant & Ast.TKeyValuePairNodeKind,
        keyReader: () => Key,
        valueReader: () => Value,
    ): Ast.IKeyValuePair<NodeKindVariant, Key, Value> {
        this.startContext(nodeKind);
        this.startTokenRange(nodeKind);

        const key: Key = keyReader();
        const equalConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Equal);
        const value: Value = valueReader();

        const keyValuePair: Ast.IKeyValuePair<NodeKindVariant, Key, Value> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            isLeaf: false,
            key,
            equalConstant,
            value,
        };
        // UNSAFE MARKER
        //
        // Purpose of code block:
        //      End the context started within the same function.
        //
        // Why are you trying to avoid a safer approach?
        //      endContext takes an Ast.TNode, but due to generics the parser
        //      can't prove for all types A, B, C that Ast.IKeyValuePair<A, B, C>
        //      results in an Ast.TNode.
        //
        //      The alternative approach is let the callers of readKeyValuePair
        //      take the return and end the context themselves, which is messy.
        //
        // Why is it safe?
        //      All Ast.NodeKind.IKeyValuePair used by the parser are of Ast.TKeyValuePair,
        //      a sub type of Ast.TNode.
        this.endContext((keyValuePair as unknown) as Ast.TKeyValuePair);
        return keyValuePair;
    }

    private readCsv<T>(valueReader: () => T, continueReadingValues: boolean): ReadonlyArray<Ast.ICsv<T>> {
        const values: Ast.ICsv<T>[] = [];

        while (continueReadingValues) {
            const nodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            this.startContext(nodeKind);
            this.startTokenRange(nodeKind);

            const node: T = valueReader();
            const maybeCommaConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            const value: Ast.ICsv<T> = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                tokenRange: this.popTokenRange(),
                isLeaf: false,
                node,
                maybeCommaConstant,
            };
            values.push(value);
            // UNSAFE MARKER
            //
            // Purpose of code block:
            //      End the context started within the same function.
            //
            // Why are you trying to avoid a safer approach?
            //      endContext takes an Ast.TNode, but due to generics the parser
            //      can't prove for all types T that Ast.ICsv<T>
            //      results in an Ast.TNode.
            //
            //      The alternative approach is let the callers of readCsv
            //      take the return and end the context themselves, which is messy.
            //
            // Why is it safe?
            //      All Ast.NodeKind.Csv used by the parser are of Ast.TCsv,
            //      a sub type of Ast.TNode.
            this.endContext((value as unknown) as Ast.TCsv);
        }

        return values;
    }

    private disambiguateParenthesis(): ParenthesisDisambiguation {
        const initialTokenIndex: number = this.tokenIndex;
        const tokens: ReadonlyArray<Token> = this.lexerSnapshot.tokens;
        const totalTokens: number = tokens.length;
        let nestedDepth: number = 1;
        let offsetTokenIndex: number = initialTokenIndex + 1;

        while (offsetTokenIndex < totalTokens) {
            const offsetTokenKind: TokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === TokenKind.LeftParenthesis) {
                nestedDepth += 1;
            } else if (offsetTokenKind === TokenKind.RightParenthesis) {
                nestedDepth -= 1;
            }

            if (nestedDepth === 0) {
                // (as X) could either be either case,
                // so we need to consume type X and see if it's followed by a FatArrow.
                //
                // It's important we backup and eventually restore the original Parser state.
                if (this.isTokenKind(TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                    const parserStateBackup: StateBackup = this.backupState();
                    this.unsafeMoveTo(offsetTokenIndex + 2);

                    try {
                        this.readNullablePrimitiveType();
                    } catch {
                        this.restoreBackup(parserStateBackup);
                        if (this.isOnTokenKind(TokenKind.FatArrow)) {
                            return ParenthesisDisambiguation.FunctionExpression;
                        } else {
                            return ParenthesisDisambiguation.ParenthesizedExpression;
                        }
                    }

                    let result: ParenthesisDisambiguation;
                    if (this.isOnTokenKind(TokenKind.FatArrow)) {
                        result = ParenthesisDisambiguation.FunctionExpression;
                    } else {
                        result = ParenthesisDisambiguation.ParenthesizedExpression;
                    }

                    this.restoreBackup(parserStateBackup);
                    return result;
                } else {
                    if (this.isTokenKind(TokenKind.FatArrow, offsetTokenIndex + 1)) {
                        return ParenthesisDisambiguation.FunctionExpression;
                    } else {
                        return ParenthesisDisambiguation.ParenthesizedExpression;
                    }
                }
            }

            offsetTokenIndex += 1;
        }

        throw this.unterminatedParenthesesError(initialTokenIndex);
    }

    private unterminatedParenthesesError(openTokenIndex: number): ParserError.UnterminatedParenthesesError {
        const token: Token = this.expectTokenAt(openTokenIndex);
        return new ParserError.UnterminatedParenthesesError(token, this.lexerSnapshot.graphemePositionStartFrom(token));
    }

    private disambiguateBracket(): BracketDisambiguation {
        const tokens: ReadonlyArray<Token> = this.lexerSnapshot.tokens;
        let offsetTokenIndex: number = this.tokenIndex + 1;
        const offsetToken: Token = tokens[offsetTokenIndex];

        if (!offsetToken) {
            throw this.unterminatedBracketError(this.tokenIndex);
        }

        let offsetTokenKind: TokenKind = offsetToken.kind;
        if (offsetTokenKind === TokenKind.LeftBracket) {
            return BracketDisambiguation.FieldProjection;
        } else if (offsetTokenKind === TokenKind.RightBracket) {
            return BracketDisambiguation.Record;
        } else {
            const totalTokens: number = tokens.length;
            offsetTokenIndex += 1;
            while (offsetTokenIndex < totalTokens) {
                offsetTokenKind = tokens[offsetTokenIndex].kind;

                if (offsetTokenKind === TokenKind.Equal) {
                    return BracketDisambiguation.Record;
                } else if (offsetTokenKind === TokenKind.RightBracket) {
                    return BracketDisambiguation.FieldSelection;
                }

                offsetTokenIndex += 1;
            }

            throw this.unterminatedBracketError(this.tokenIndex);
        }
    }

    private unterminatedBracketError(openTokenIndex: number): ParserError.UnterminatedBracketError {
        const token: Token = this.expectTokenAt(openTokenIndex);
        return new ParserError.UnterminatedBracketError(token, this.lexerSnapshot.graphemePositionStartFrom(token));
    }

    private startTokenRange(nodeKind: Ast.NodeKind): void {
        this.startTokenRangeAt(nodeKind, this.tokenIndex);
    }

    private startTokenRangeAt(nodeKind: Ast.NodeKind, tokenIndex: number): void {
        if (tokenIndex >= this.lexerSnapshot.tokens.length) {
            const topOfTokenRangeStack: Ast.NodeKind = this.tokenRangeStack[this.tokenRangeStack.length - 1].nodeKind;
            throw new ParserError.UnexpectedEndOfTokensError(topOfTokenRangeStack);
        }

        const currentToken: Token = this.lexerSnapshot.tokens[tokenIndex];
        this.tokenRangeStack.push({
            nodeKind,
            tokenIndexStart: tokenIndex,
            positionStart: currentToken.positionStart,
        });
    }

    // faster version of popTokenRange, returns no value
    private popTokenRangeNoop(): void {
        if (!this.tokenRangeStack.pop()) {
            throw new CommonError.InvariantError("tried to pop from an empty stack");
        }
    }

    private popTokenRange(): TokenRange {
        const maybeElement: Option<TokenRangeStackElement> = this.tokenRangeStack.pop();
        if (maybeElement === undefined) {
            throw new CommonError.InvariantError("tried to pop from an empty stack");
        }

        const element: TokenRangeStackElement = maybeElement;
        const positionStart: TokenPosition = element.positionStart;
        const endTokenIndex: number = this.tokenIndex;
        const lastInclusiveToken: Token = this.lexerSnapshot.tokens[endTokenIndex - 1];

        return {
            startTokenIndex: element.tokenIndexStart,
            endTokenIndex,
            positionStart: element.positionStart,
            positionEnd: lastInclusiveToken.positionEnd,
            hash: tokenRangeHashFrom(maybeElement.nodeKind, positionStart, positionStart),
        };
    }

    // create a TokenRange of length 1
    private singleTokenRange(
        tag: TokenKind | Keyword | Ast.IdentifierConstant | Ast.TUnaryExpressionHelperOperator,
    ): TokenRange {
        const tokenIndex: number = this.tokenIndex;
        const token: Token = this.lexerSnapshot.tokens[tokenIndex];
        const positionStart: TokenPosition = token.positionStart;
        const positionEnd: TokenPosition = token.positionEnd;

        return {
            startTokenIndex: tokenIndex,
            endTokenIndex: tokenIndex + 1,
            positionStart,
            positionEnd,
            hash: tokenRangeHashFrom(tag, positionStart, positionEnd),
        };
    }

    private startContext(nodeKind: Ast.NodeKind): number {
        this.maybeCurrentContextNode = Context.addChild(
            this.contextState,
            this.maybeCurrentContextNode,
            nodeKind,
            this.nodeIdCounter,
            this.maybeCurrentToken,
        );
        const oldNodeIdCounter: number = this.nodeIdCounter;
        this.nodeIdCounter += 1;
        return oldNodeIdCounter;
    }

    private endContext(astNode: Ast.TNode): void {
        if (this.maybeCurrentContextNode === undefined) {
            throw new CommonError.InvariantError(
                "maybeContextNode should be truthy, can't end context if it doesn't exist.",
            );
        }

        this.maybeCurrentContextNode = Context.endContext(this.contextState, this.maybeCurrentContextNode, astNode);
    }

    private deleteContext(maybeNodeId: Option<number>): void {
        let nodeId: number;
        if (maybeNodeId === undefined) {
            if (this.maybeCurrentContextNode === undefined) {
                throw new CommonError.InvariantError(
                    "maybeContextNode should be truthy, can't end context if it doesn't exist.",
                );
            } else {
                const currentContextNode: Context.Node = this.maybeCurrentContextNode;
                nodeId = currentContextNode.nodeId;
            }
        } else {
            nodeId = maybeNodeId;
        }

        this.maybeCurrentContextNode = Context.deleteContext(this.contextState, nodeId);
    }

    private isNextTokenKind(tokenKind: TokenKind): boolean {
        return this.isTokenKind(tokenKind, this.tokenIndex + 1);
    }

    private isOnTokenKind(tokenKind: TokenKind, tokenIndex: number = this.tokenIndex): boolean {
        return this.isTokenKind(tokenKind, tokenIndex);
    }

    private isTokenKind(tokenKind: TokenKind, tokenIndex: number): boolean {
        const maybeToken: Option<Token> = this.lexerSnapshot.tokens[tokenIndex];

        if (maybeToken) {
            return maybeToken.kind === tokenKind;
        } else {
            return false;
        }
    }

    private isOnIdentifierConstant(identifierConstant: Ast.IdentifierConstant): boolean {
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            const currentToken: Token = this.lexerSnapshot.tokens[this.tokenIndex];
            if (currentToken === undefined || currentToken.data === undefined) {
                const details: {} = { currentToken };
                throw new CommonError.InvariantError(`expected data on Token`, details);
            }

            const data: string = currentToken.data;
            return data === identifierConstant;
        } else {
            return false;
        }
    }

    private expectTokenAt(tokenIndex: number): Token {
        const lexerSnapshot: LexerSnapshot = this.lexerSnapshot;
        const maybeToken: Option<Token> = lexerSnapshot.tokens[tokenIndex];

        if (maybeToken) {
            return maybeToken;
        } else {
            throw new CommonError.InvariantError(`this.tokens[${tokenIndex}] is falsey`);
        }
    }

    private expectContextNodeMetadata(): ContextNodeMetadata {
        if (this.maybeCurrentContextNode === undefined) {
            throw new CommonError.InvariantError("maybeCurrentContextNode should be truthy");
        }

        const contextNode: Context.Node = this.maybeCurrentContextNode;
        return {
            id: contextNode.nodeId,
            maybeParentId: contextNode.maybeParentId,
            childIds: contextNode.childNodeIds.slice(),
        };
    }

    // WARNING: Only updates tokenIndex and currentTokenKind,
    //          Manual management of TokenRangeStack is assumed.
    //          Best used in conjunction with backup/restore using ParserState.
    private unsafeMoveTo(tokenIndex: number): void {
        const tokens: ReadonlyArray<Token> = this.lexerSnapshot.tokens;
        this.tokenIndex = tokenIndex;

        if (tokenIndex < tokens.length) {
            this.maybeCurrentToken = tokens[tokenIndex];
            this.maybeCurrentTokenKind = this.maybeCurrentToken.kind;
        } else {
            this.maybeCurrentToken = undefined;
            this.maybeCurrentTokenKind = undefined;
        }
    }

    private backupState(): StateBackup {
        return {
            tokenIndex: this.tokenIndex,
            tokenRangeStackLength: this.tokenRangeStack.length,
            contextState: Context.deepCopy(this.contextState),
            maybeContextNodeId:
                this.maybeCurrentContextNode !== undefined ? this.maybeCurrentContextNode.nodeId : undefined,
        };
    }

    private restoreBackup(backup: StateBackup): void {
        this.tokenRangeStack.length = backup.tokenRangeStackLength;
        this.tokenIndex = backup.tokenIndex;
        this.maybeCurrentToken = this.lexerSnapshot.tokens[this.tokenIndex];
        this.maybeCurrentTokenKind = this.maybeCurrentToken !== undefined ? this.maybeCurrentToken.kind : undefined;

        this.contextState = backup.contextState;

        if (backup.maybeContextNodeId) {
            this.maybeCurrentContextNode = Context.expectContextNode(
                this.contextState.contextNodesById,
                backup.maybeContextNodeId,
            );
        } else {
            this.maybeCurrentContextNode = undefined;
        }
    }
}

export interface ParseOk {
    readonly document: Ast.TDocument;
    readonly nodesById: Map<number, Ast.TNode>;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export function parse(lexerSnapshot: LexerSnapshot): TriedParse {
    const parser: Parser = new Parser(lexerSnapshot);
    return parser.parse();
}

type TryReadPrimaryType = Result<Ast.TPrimaryType, ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError>;

type TryReadPrimitiveType = Result<
    Ast.PrimitiveType,
    ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

const enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

const enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    Record = "Record",
}

interface TokenRangeStackElement {
    readonly nodeKind: Ast.NodeKind;
    readonly tokenIndexStart: number;
    readonly positionStart: TokenPosition;
}

interface StateBackup {
    readonly tokenRangeStackLength: number;
    readonly tokenIndex: number;
    readonly contextState: Context.State;
    readonly maybeContextNodeId: Option<number>;
}
interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeParentId: Option<number>;
    readonly childIds: ReadonlyArray<number>;
}

interface WrappedRead<NodeKindVariant, Content> extends Ast.IWrapped<NodeKindVariant, Content> {
    readonly maybeOptionalConstant: Option<Ast.Constant>;
}
