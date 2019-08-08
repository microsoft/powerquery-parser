// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, ParserContext, ParserError } from ".";
import { CommonError, isNever, Option, Result, ResultKind, TypeUtils } from "../common";
import { LexerSnapshot, Token, TokenKind } from "../lexer";

export type TriedParse = Result<ParseOk, ParserError.TParserError>;

export class Parser {
    private maybeCurrentToken: Option<Token>;
    private maybeCurrentTokenKind: Option<TokenKind>;

    public constructor(
        private readonly lexerSnapshot: LexerSnapshot,
        private tokenIndex: number = 0,
        private contextState: ParserContext.State = ParserContext.empty(),
        private maybeCurrentContextNode: Option<ParserContext.Node> = undefined,
    ) {
        if (this.lexerSnapshot.tokens.length) {
            this.maybeCurrentToken = this.lexerSnapshot.tokens[0];
            this.maybeCurrentTokenKind = this.maybeCurrentToken.kind;
        }
    }

    public tryParse(): TriedParse {
        try {
            const document: Ast.TDocument = this.readDocument();
            if (this.maybeCurrentContextNode !== undefined) {
                const details: {} = { maybeContextNode: this.maybeCurrentContextNode };
                throw new CommonError.InvariantError(
                    "maybeContextNode should be falsey, there shouldn't be an open context",
                    details,
                );
            }

            const contextState: ParserContext.State = this.contextState;
            return {
                kind: ResultKind.Ok,
                value: {
                    document,
                    nodeIdMapCollection: contextState.nodeIdMapCollection,
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
                const expressionContextState: ParserContext.State = ParserContext.deepCopy(this.contextState);
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

        const maybeLiteralAttributes: Option<Ast.RecordLiteral> = this.maybeReadLiteralAttributes();
        this.incrementAttributeCounterIfUndefined(maybeLiteralAttributes);
        const sectionConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordSection);

        let maybeName: Option<Ast.Identifier>;
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            maybeName = this.readIdentifier();
        } else {
            this.incrementAttributeCounter();
        }

        const semicolonConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Semicolon);
        const sectionMembers: Ast.IArrayWrapper<Ast.SectionMember> = this.readSectionMembers();

        const astNode: Ast.Section = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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
    private readSectionMembers(): Ast.IArrayWrapper<Ast.SectionMember> {
        const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
        this.startContext(nodeKind);

        const totalTokens: number = this.lexerSnapshot.tokens.length;
        const sectionMembers: Ast.SectionMember[] = [];
        while (this.tokenIndex < totalTokens) {
            sectionMembers.push(this.readSectionMember());
        }

        const astNode: Ast.IArrayWrapper<Ast.SectionMember> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            elements: sectionMembers,
        };
        this.endContext(astNode);
        return astNode;
    }

    // sub-item of 12.2.2 Section Documents
    private readSectionMember(): Ast.SectionMember {
        const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
        this.startContext(nodeKind);

        const maybeLiteralAttributes: Option<Ast.RecordLiteral> = this.maybeReadLiteralAttributes();
        this.incrementAttributeCounterIfUndefined(maybeLiteralAttributes);
        const maybeSharedConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.KeywordShared);
        this.incrementAttributeCounterIfUndefined(maybeSharedConstant);
        const namePairedExpression: Ast.IdentifierPairedExpression = this.readIdentifierPairedExpression();
        const semicolonConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Semicolon);

        const astNode: Ast.SectionMember = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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
        return this.recursiveReadBinOpExpressionOneOperand<
            Ast.NodeKind.LogicalExpression,
            Ast.TLogicalExpression,
            Ast.LogicalOperator
        >(
            Ast.NodeKind.LogicalExpression,
            () => this.readIsExpression(),
            maybeCurrentTokenKind => Ast.logicalOperatorFrom(maybeCurrentTokenKind),
        );
    }

    // 12.2.3.3 Is expression
    private readIsExpression(): Ast.TIsExpression {
        return this.recursiveReadBinOpExpressionTwoOperand<
            Ast.NodeKind.IsExpression,
            Ast.TAsExpression,
            Ast.ConstantKind.Is,
            Ast.TNullablePrimitiveType
        >(
            Ast.NodeKind.IsExpression,
            () => this.readAsExpression(),
            maybeCurrentTokenKind => (maybeCurrentTokenKind === TokenKind.KeywordIs ? Ast.ConstantKind.Is : undefined),
            () => this.readNullablePrimitiveType(),
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
        return this.recursiveReadBinOpExpressionTwoOperand<
            Ast.NodeKind.AsExpression,
            Ast.TEqualityExpression,
            Ast.ConstantKind.As,
            Ast.TNullablePrimitiveType
        >(
            Ast.NodeKind.AsExpression,
            () => this.readEqualityExpression(),
            maybeCurrentTokenKind => (maybeCurrentTokenKind === TokenKind.KeywordAs ? Ast.ConstantKind.As : undefined),
            () => this.readNullablePrimitiveType(),
        );
    }

    // 12.2.3.5 Equality expression
    private readEqualityExpression(): Ast.TEqualityExpression {
        return this.recursiveReadBinOpExpressionOneOperand<
            Ast.NodeKind.EqualityExpression,
            Ast.TEqualityExpression,
            Ast.EqualityOperator
        >(
            Ast.NodeKind.EqualityExpression,
            () => this.readRelationalExpression(),
            maybeCurrentTokenKind => Ast.equalityOperatorFrom(maybeCurrentTokenKind),
        );
    }

    // 12.2.3.6 Relational expression
    private readRelationalExpression(): Ast.TRelationalExpression {
        return this.recursiveReadBinOpExpressionOneOperand<
            Ast.NodeKind.RelationalExpression,
            Ast.TArithmeticExpression,
            Ast.RelationalOperator
        >(
            Ast.NodeKind.RelationalExpression,
            () => this.readArithmeticExpression(),
            maybeCurrentTokenKind => Ast.relationalOperatorFrom(maybeCurrentTokenKind),
        );
    }

    // 12.2.3.7 Arithmetic expressions
    private readArithmeticExpression(): Ast.TArithmeticExpression {
        return this.recursiveReadBinOpExpressionOneOperand<
            Ast.NodeKind.ArithmeticExpression,
            Ast.TMetadataExpression,
            Ast.ArithmeticOperator
        >(
            Ast.NodeKind.ArithmeticExpression,
            () => this.readMetadataExpression(),
            maybeCurrentTokenKind => Ast.arithmeticOperatorFrom(maybeCurrentTokenKind),
        );
    }

    // 12.2.3.8 Metadata expression
    private readMetadataExpression(): Ast.TMetadataExpression {
        const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;
        this.startContext(nodeKind);

        const left: Ast.TUnaryExpression = this.readUnaryExpression();
        const maybeConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.KeywordMeta);
        this.incrementAttributeCounterIfUndefined(maybeConstant);

        if (maybeConstant) {
            const right: Ast.TUnaryExpression = this.readUnaryExpression();

            const astNode: Ast.MetadataExpression = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                isLeaf: false,
                left,
                constant: maybeConstant,
                right,
            };

            this.endContext(astNode);
            return astNode;
        } else {
            this.deleteContext(undefined);
            return left;
        }
    }

    // 12.2.3.9 Unary expression
    private readUnaryExpression(): Ast.TUnaryExpression {
        let maybeOperator: Option<Ast.UnaryOperator> = Ast.unaryOperatorFrom(this.maybeCurrentTokenKind);
        if (maybeOperator === undefined) {
            return this.readTypeExpression();
        }

        const unaryNodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
        this.startContext(unaryNodeKind);

        const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
        this.startContext(arrayNodeKind);

        const operatorConstants: Ast.Constant[] = [];
        while (maybeOperator) {
            operatorConstants.push(this.readTokenKindAsConstant(this.maybeCurrentTokenKind as TokenKind));
            maybeOperator = Ast.unaryOperatorFrom(this.maybeCurrentTokenKind);
        }
        const operators: Ast.IArrayWrapper<Ast.Constant> = {
            ...this.expectContextNodeMetadata(),
            kind: arrayNodeKind,
            isLeaf: false,
            elements: operatorConstants,
        };
        this.endContext(operators);

        const typeExpression: Ast.TTypeExpression = this.readTypeExpression();

        const astNode: Ast.UnaryExpression = {
            ...this.expectContextNodeMetadata(),
            kind: unaryNodeKind,
            isLeaf: false,
            operators,
            typeExpression,
        };
        this.endContext(astNode);
        return astNode;
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

        const maybeInclusiveConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.AtSign);
        this.incrementAttributeCounterIfUndefined(maybeInclusiveConstant);
        const identifier: Ast.Identifier = this.readIdentifier();

        const astNode: Ast.IdentifierExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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

        const ellipsisConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Ellipsis);

        const astNode: Ast.NotImplementedExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            ellipsisConstant,
        };
        this.endContext(astNode);
        return astNode;
    }

    // 12.2.3.16 Invoke expression
    private readInvokeExpression(): Ast.InvokeExpression {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightParenthesis);
        return this.readWrapped<Ast.NodeKind.InvokeExpression, Ast.InvokeExpression["content"]>(
            Ast.NodeKind.InvokeExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftParenthesis),
            () => this.readCsvArray(() => this.readExpression(), continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightParenthesis),
            false,
        );
    }

    // 12.2.3.17 List expression
    private readListExpression(): Ast.ListExpression {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightBrace);
        return this.readWrapped<Ast.NodeKind.ListExpression, Ast.ListExpression["content"]>(
            Ast.NodeKind.ListExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readCsvArray(() => this.readExpression(), continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
            false,
        );
    }

    // 12.2.3.18 Record expression
    private readRecordExpression(): Ast.RecordExpression {
        const continueReadingValues: boolean = !this.isNextTokenKind(TokenKind.RightBracket);
        return this.readWrapped<Ast.NodeKind.RecordExpression, Ast.RecordExpression["content"]>(
            Ast.NodeKind.RecordExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readGeneralizedIdentifierPairedExpressions(continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
            false,
        );
    }

    // 12.2.3.19 Item access expression
    private readItemAccessExpression(): Ast.ItemAccessExpression {
        return this.readWrapped<Ast.NodeKind.ItemAccessExpression, Ast.TExpression>(
            Ast.NodeKind.ItemAccessExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readExpression(),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
            true,
        );
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldSelection(): Ast.FieldSelector {
        return this.readFieldSelector(true);
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldProjection(): Ast.FieldProjection {
        return this.readWrapped<Ast.NodeKind.FieldProjection, Ast.FieldProjection["content"]>(
            Ast.NodeKind.FieldProjection,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readCsvArray(() => this.readFieldSelector(false), true),
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

        const parameters: Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>> = this.readParameterList(() =>
            this.maybeReadAsNullablePrimitiveType(),
        );
        const maybeFunctionReturnType: Option<Ast.AsNullablePrimitiveType> = this.maybeReadAsNullablePrimitiveType();
        this.incrementAttributeCounterIfUndefined(maybeFunctionReturnType);
        const fatArrowConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.FatArrow);
        const expression: Ast.TExpression = this.readExpression();

        const astNode: Ast.FunctionExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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

        const letConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordLet);
        const identifierExpressionPairedExpressions: Ast.ICsvArray<
            Ast.IdentifierPairedExpression
        > = this.readIdentifierPairedExpressions(true);
        const inConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordIn);
        const expression: Ast.TExpression = this.readExpression();

        const astNode: Ast.LetExpression = {
            ...this.expectContextNodeMetadata(),
            kind: Ast.NodeKind.LetExpression,
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

        const ifConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordIf);
        const condition: Ast.TExpression = this.readExpression();

        const thenConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordThen);
        const trueExpression: Ast.TExpression = this.readExpression();

        const elseConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.KeywordElse);
        const falseExpression: Ast.TExpression = this.readExpression();

        const astNode: Ast.IfExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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
        const triedReadPrimaryType: TriedReadPrimaryType = this.tryReadPrimaryType();

        if (triedReadPrimaryType.kind === ResultKind.Ok) {
            return triedReadPrimaryType.value;
        } else {
            return this.readPrimaryExpression();
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readPrimaryType(): Ast.TPrimaryType {
        const triedReadPrimaryType: TriedReadPrimaryType = this.tryReadPrimaryType();

        if (triedReadPrimaryType.kind === ResultKind.Ok) {
            return triedReadPrimaryType.value;
        } else {
            throw triedReadPrimaryType.error;
        }
    }

    private tryReadPrimaryType(): TriedReadPrimaryType {
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
            const triedReadPrimitiveType: TriedReadPrimaryType = this.tryReadPrimitiveType();

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

        const fields: Ast.FieldSpecificationList = this.readFieldSpecificationList(true);

        const astNode: Ast.RecordType = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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

        const leftBracketConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.LeftBracket);
        const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
        let continueReadingValues: boolean = true;
        let maybeOpenRecordMarkerConstant: Option<Ast.Constant> = undefined;

        const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
        this.startContext(fieldArrayNodeKind);

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

                const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
                this.startContext(fieldSpecificationNodeKind);

                const maybeOptionalConstant: Option<Ast.Constant> = this.maybeReadIdentifierConstantAsConstant(
                    Ast.IdentifierConstant.Optional,
                );
                this.incrementAttributeCounterIfUndefined(maybeOptionalConstant);

                const name: Ast.GeneralizedIdentifier = this.readGeneralizedIdentifier();

                const maybeFieldTypeSpeification: Option<
                    Ast.FieldTypeSpecification
                > = this.maybeReadFieldTypeSpecification();
                this.incrementAttributeCounterIfUndefined(maybeFieldTypeSpeification);

                const maybeCommaConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
                this.incrementAttributeCounterIfUndefined(maybeCommaConstant);
                continueReadingValues = maybeCommaConstant !== undefined;

                const field: Ast.FieldSpecification = {
                    ...this.expectContextNodeMetadata(),
                    kind: fieldSpecificationNodeKind,
                    isLeaf: false,
                    maybeOptionalConstant,
                    name,
                    maybeFieldTypeSpeification,
                };
                this.endContext(field);

                const csv: Ast.ICsv<Ast.FieldSpecification> = {
                    ...this.expectContextNodeMetadata(),
                    kind: csvNodeKind,
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

        const fieldArray: Ast.ICsvArray<Ast.FieldSpecification> = {
            ...this.expectContextNodeMetadata(),
            kind: fieldArrayNodeKind,
            elements: fields,
            isLeaf: false,
        };
        this.endContext(fieldArray);

        const rightBracketConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.RightBracket);

        const astNode: Ast.FieldSpecificationList = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            openWrapperConstant: leftBracketConstant,
            content: fieldArray,
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

        const maybeEqualConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Equal);
        if (maybeEqualConstant) {
            const fieldType: Ast.TType = this.readType();

            const astNode: Ast.FieldTypeSpecification = {
                ...this.expectContextNodeMetadata(),
                kind: Ast.NodeKind.FieldTypeSpecification,
                isLeaf: false,
                equalConstant: maybeEqualConstant,
                fieldType,
            };
            this.endContext(astNode);
            return astNode;
        } else {
            this.deleteContext(undefined);
            return undefined;
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readFunctionType(): Ast.FunctionType {
        const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
        this.startContext(nodeKind);

        const functionConstant: Ast.Constant = this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Function);
        const parameters: Ast.IParameterList<Ast.AsType> = this.readParameterList(() => this.readAsType());
        const functionReturnType: Ast.AsType = this.readAsType();

        const astNode: Ast.FunctionType = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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
        this.incrementAttributeCounterIfUndefined(maybeOtherwiseExpression);

        const astNode: Ast.ErrorHandlingExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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
        const wrappedRead: Ast.IWrapped<Ast.NodeKind.RecordLiteral, Ast.RecordLiteral["content"]> = this.readWrapped<
            Ast.NodeKind.RecordLiteral,
            Ast.RecordLiteral["content"]
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
    ): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> {
        return this.readCsvArray(
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
        const wrappedRead: Ast.IWrapped<Ast.NodeKind.ListLiteral, Ast.ListLiteral["content"]> = this.readWrapped<
            Ast.NodeKind.ListLiteral,
            Ast.ListLiteral["content"]
        >(
            Ast.NodeKind.ListLiteral,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readCsvArray(() => this.readAnyLiteral(), continueReadingValues),
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

        const leftParenthesisConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.LeftParenthesis);
        let continueReadingValues: boolean = !this.isOnTokenKind(TokenKind.RightParenthesis);
        let reachedOptionalParameter: boolean = false;

        const paramaterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
        this.startContext(paramaterArrayNodeKind);

        const parameters: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>>[] = [];
        while (continueReadingValues) {
            this.startContext(Ast.NodeKind.Csv);
            this.startContext(Ast.NodeKind.Parameter);

            const maybeOptionalConstant: Option<Ast.Constant> = this.maybeReadIdentifierConstantAsConstant(
                Ast.IdentifierConstant.Optional,
            );
            this.incrementAttributeCounterIfUndefined(maybeOptionalConstant);

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
            this.incrementAttributeCounterIfUndefined(maybeParameterType);

            const parameter: Ast.IParameter<T & Ast.TParameterType> = {
                ...this.expectContextNodeMetadata(),
                kind: Ast.NodeKind.Parameter,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeParameterType,
            };
            this.endContext(parameter);

            const maybeCommaConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
            this.incrementAttributeCounterIfUndefined(maybeCommaConstant);
            continueReadingValues = maybeCommaConstant !== undefined;

            const csv: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>> = {
                ...this.expectContextNodeMetadata(),
                kind: Ast.NodeKind.Csv,
                isLeaf: false,
                node: parameter,
                maybeCommaConstant,
            };
            this.endContext(csv);

            parameters.push(csv);
        }

        const parameterArray: Ast.ICsvArray<Ast.IParameter<T & Ast.TParameterType>> = {
            ...this.expectContextNodeMetadata(),
            kind: paramaterArrayNodeKind,
            elements: parameters,
            isLeaf: false,
        };
        this.endContext(parameterArray);

        const rightParenthesisConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.RightParenthesis);

        const astNode: Ast.IParameterList<T & Ast.TParameterType> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            openWrapperConstant: leftParenthesisConstant,
            content: parameterArray,
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
        const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
        this.startContext(nodeKind);

        // The head of the recursive primary expression is created before the recursive primrary expression,
        // meaning the parent/child mapping for contexts are in reverse order.
        // The clean up for that happens here.
        const nodeIdMapCollection: NodeIdMap.Collection = this.contextState.nodeIdMapCollection;
        if (this.maybeCurrentContextNode === undefined) {
            throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
        }
        const currentContextNode: ParserContext.Node = this.maybeCurrentContextNode;

        const maybeHeadParentId: Option<number> = nodeIdMapCollection.parentIdById.get(head.id);
        if (maybeHeadParentId === undefined) {
            const details: {} = { nodeId: head.id };
            throw new CommonError.InvariantError(`head's nodeId isn't in parentIdById`, details);
        }
        const headParentId: number = maybeHeadParentId;

        // Remove head as a child of its current parent.
        const parentChildIds: ReadonlyArray<number> = NodeIdMap.expectChildIds(
            nodeIdMapCollection.childIdsById,
            headParentId,
        );
        const replacementIndex: number = parentChildIds.indexOf(head.id);
        if (replacementIndex === -1) {
            const details: {} = {
                parentNodeId: headParentId,
                childNodeId: head.id,
            };
            throw new CommonError.InvariantError(`node isn't a child of parentNode`, details);
        }

        nodeIdMapCollection.childIdsById.set(headParentId, [
            ...parentChildIds.slice(0, replacementIndex),
            ...parentChildIds.slice(replacementIndex + 1),
        ]);

        // Update mappings for head.
        nodeIdMapCollection.astNodeById.set(head.id, head);
        nodeIdMapCollection.parentIdById.set(head.id, currentContextNode.id);

        // Mark head as a child of the recursive primary expression context (currentContextNode).
        nodeIdMapCollection.childIdsById.set(currentContextNode.id, [head.id]);

        // Update start positions for recursive primary expression context
        const recursiveTokenIndexStart: number = head.tokenRange.tokenIndexStart;
        const mutableContext: TypeUtils.StripReadonly<ParserContext.Node> = currentContextNode;
        // UNSAFE MARKER
        //
        // Purpose of code block:
        //      Shift the start of ParserContext from the default location (which doesn't include head),
        //      to the left so that head is also included.
        //
        // Why are you trying to avoid a safer approach?
        //      There isn't one? At least not without refactoring in ways which will make things messier.
        //
        // Why is it safe?
        //      I'm only mutating start locations in the recursive expression to those on head.
        mutableContext.maybeTokenStart = this.lexerSnapshot.tokens[recursiveTokenIndexStart];
        mutableContext.tokenIndexStart = recursiveTokenIndexStart;

        // Begin normal parsing behavior.
        const recursiveExpressions: Ast.TRecursivePrimaryExpression[] = [];
        const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
        this.startContext(recursiveArrayNodeKind);
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

        const recursiveArray: Ast.IArrayWrapper<Ast.TRecursivePrimaryExpression> = {
            ...this.expectContextNodeMetadata(),
            kind: recursiveArrayNodeKind,
            isLeaf: false,
            elements: recursiveExpressions,
        };
        this.endContext(recursiveArray);

        const astNode: Ast.RecursivePrimaryExpression = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            head,
            recursiveExpressions: recursiveArray,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readIdentifier(): Ast.Identifier {
        const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
        this.startContext(nodeKind);

        const literal: string = this.readTokenKind(TokenKind.Identifier);

        const astNode: Ast.Identifier = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: true,
            literal,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readGeneralizedIdentifier(): Ast.GeneralizedIdentifier {
        const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
        this.startContext(nodeKind);

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
            isLeaf: true,
            literal,
        };
        this.endContext(astNode);
        return astNode;
    }

    private readPrimitiveType(): Ast.PrimitiveType {
        const triedReadPrimitiveType: TriedReadPrimitiveType = this.tryReadPrimitiveType();
        if (triedReadPrimitiveType.kind === ResultKind.Ok) {
            return triedReadPrimitiveType.value;
        } else {
            throw triedReadPrimitiveType.error;
        }
    }

    private tryReadPrimitiveType(): TriedReadPrimitiveType {
        const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
        this.startContext(nodeKind);

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
    ): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
        return this.readCsvArray(() => this.readIdentifierPairedExpression(), continueReadingValues);
    }

    private readGeneralizedIdentifierPairedExpressions(
        continueReadingValues: boolean,
    ): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
        return this.readCsvArray(() => this.readGeneralizedIdentifierPairedExpression(), continueReadingValues);
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
        if (maybeConstant === undefined) {
            const maybeErr: Option<ParserError.ExpectedTokenKindError> = this.expectTokenKind(tokenKind);
            if (maybeErr) {
                throw maybeErr;
            } else {
                const details: {} = {
                    expectedTokenKind: tokenKind,
                    actualTokenKind: this.maybeCurrentTokenKind,
                };

                throw new CommonError.InvariantError(
                    `failures from ${this.maybeReadTokenKindAsConstant.name} should be reportable by ${
                        this.expectTokenKind.name
                    }`,
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

            const literal: string = this.readToken();
            const astNode: Ast.Constant = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                isLeaf: true,
                literal,
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
            const details: {} = { identifierConstant };
            throw new CommonError.InvariantError(`couldn't convert IdentifierConstant into ConstantKind`, details);
        }

        return maybeConstant;
    }

    private maybeReadIdentifierConstantAsConstant(identifierConstant: Ast.IdentifierConstant): Option<Ast.Constant> {
        if (this.isOnIdentifierConstant(identifierConstant)) {
            const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
            this.startContext(nodeKind);

            const maybeConstantKind: Option<Ast.ConstantKind> = Ast.constantKindFromIdentifieConstant(
                identifierConstant,
            );
            if (!maybeConstantKind) {
                const details: {} = { identifierConstant };
                throw new CommonError.InvariantError(`couldn't convert IdentifierConstant into ConstantKind`, details);
            }

            this.readToken();
            const astNode: Ast.Constant = {
                ...this.expectContextNodeMetadata(),
                kind: nodeKind,
                isLeaf: true,
                literal: maybeConstantKind,
            };
            this.endContext(astNode);
            return astNode;
        } else {
            return undefined;
        }
    }

    private readKeyword(): Ast.IdentifierExpression {
        const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
        this.startContext(identifierExpressionNodeKind);

        const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
        this.startContext(identifierNodeKind);

        const literal: string = this.readToken();
        const identifier: Ast.Identifier = {
            ...this.expectContextNodeMetadata(),
            kind: identifierNodeKind,
            isLeaf: true,
            literal,
        };
        this.endContext(identifier);

        const identifierExpression: Ast.IdentifierExpression = {
            ...this.expectContextNodeMetadata(),
            kind: identifierExpressionNodeKind,
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
    private recursiveReadBinOpExpressionOneOperand<Kind, Operand, Operator>(
        nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
        operandReader: () => Operand,
        maybeOperatorFrom: (tokenKind: Option<TokenKind>) => Option<Operator>,
    ): Operand | Ast.IBinOpExpression<Kind, Operand, Operator, Operand> {
        this.startContext(nodeKind);
        const left: Operand = operandReader();

        const maybeOperator: Option<Operator> = maybeOperatorFrom(this.maybeCurrentTokenKind);
        if (maybeOperator === undefined) {
            this.deleteContext(undefined);
            return left;
        }
        const operator: Operator = maybeOperator;
        const operatorConstant: Ast.Constant = this.readTokenKindAsConstant(this.maybeCurrentTokenKind as TokenKind);

        const right:
            | Operand
            | Ast.IBinOpExpression<Kind, Operand, Operator, Operand> = this.recursiveReadBinOpExpressionOneOperand<
            Kind,
            Operand,
            Operator
        >(nodeKind, operandReader, maybeOperatorFrom);

        const astNode: Ast.IBinOpExpression<Kind, Operand, Operator, Operand> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            left,
            operator,
            operatorConstant,
            right,
        };
        this.endContext((astNode as unknown) as Ast.TNode);

        return astNode;
    }

    private recursiveReadBinOpExpressionTwoOperand<Kind, Left, Operator, Right>(
        nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
        leftReader: () => Left,
        maybeOperatorFrom: (tokenKind: Option<TokenKind>) => Option<Operator>,
        rightReader: () => Right,
    ): Left | Ast.IBinOpExpression<Kind, Left, Operator, Right> {
        this.startContext(nodeKind);
        const left: Left = leftReader();

        // If no operator, return Left
        const maybeOperator: Option<Operator> = maybeOperatorFrom(this.maybeCurrentTokenKind);
        if (maybeOperator === undefined) {
            this.deleteContext(undefined);
            return left;
        }
        const operator: Operator = maybeOperator;
        const operatorConstant: Ast.Constant = this.readTokenKindAsConstant(this.maybeCurrentTokenKind as TokenKind);
        const right:
            | Right
            | Ast.IBinOpExpression<Kind, Right, Operator, Right> = this.recursiveReadBinOpExpressionTwoOperandHelper<
            Kind,
            Operator,
            Right
        >(nodeKind, maybeOperatorFrom, rightReader);

        const astNode: Ast.IBinOpExpression<Kind, Left, Operator, Right> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            left,
            operator,
            operatorConstant,
            right,
        };
        this.endContext((astNode as unknown) as Ast.TNode);

        return astNode;
    }

    private recursiveReadBinOpExpressionTwoOperandHelper<Kind, Operator, Right>(
        nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
        maybeOperatorFrom: (tokenKind: Option<TokenKind>) => Option<Operator>,
        rightReader: () => Right,
    ): Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> {
        this.startContext(nodeKind);
        const rightAsLeft: Right = rightReader();

        const maybeOperator: Option<Operator> = maybeOperatorFrom(this.maybeCurrentTokenKind);
        if (maybeOperator === undefined) {
            this.deleteContext(undefined);
            return rightAsLeft;
        }
        const operator: Operator = maybeOperator;
        const operatorConstant: Ast.Constant = this.readTokenKindAsConstant(this.maybeCurrentTokenKind as TokenKind);
        const right:
            | Right
            | Ast.IBinOpExpression<Kind, Right, Operator, Right> = this.recursiveReadBinOpExpressionTwoOperandHelper<
            Kind,
            Operator,
            Right
        >(nodeKind, maybeOperatorFrom, rightReader);

        const astNode: Ast.IBinOpExpression<Kind, Right, Operator, Right> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            left: rightAsLeft,
            operator,
            operatorConstant,
            right,
        };
        this.endContext((astNode as unknown) as Ast.TNode);

        return astNode;
    }

    private readPairedConstant<Kind, Paired>(
        nodeKind: Kind & Ast.TPairedConstantNodeKind,
        constantReader: () => Ast.Constant,
        pairedReader: () => Paired,
    ): Ast.IPairedConstant<Kind, Paired> {
        this.startContext(nodeKind);

        const constant: Ast.Constant = constantReader();
        const paired: Paired = pairedReader();

        const pairedConstant: Ast.IPairedConstant<Kind, Paired> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            constant,
            paired,
        };

        this.endContext((pairedConstant as unknown) as Ast.TPairedConstant);

        return pairedConstant;
    }

    private maybeReadPairedConstant<Kind, Paired>(
        nodeKind: Kind & Ast.TPairedConstantNodeKind,
        condition: () => boolean,
        constantReader: () => Ast.Constant,
        pairedReader: () => Paired,
    ): Option<Ast.IPairedConstant<Kind, Paired>> {
        if (condition()) {
            return this.readPairedConstant<Kind, Paired>(nodeKind, constantReader, pairedReader);
        } else {
            return undefined;
        }
    }

    private readWrapped<Kind, Content>(
        nodeKind: Kind & Ast.TWrappedNodeKind,
        openConstantReader: () => Ast.Constant,
        contentReader: () => Content,
        closeConstantReader: () => Ast.Constant,
        allowOptionalConstant: boolean,
    ): WrappedRead<Kind, Content> {
        this.startContext(nodeKind);

        const openWrapperConstant: Ast.Constant = openConstantReader();
        const content: Content = contentReader();
        const closeWrapperConstant: Ast.Constant = closeConstantReader();

        let maybeOptionalConstant: Option<Ast.Constant>;
        if (allowOptionalConstant) {
            maybeOptionalConstant = this.maybeReadTokenKindAsConstant(TokenKind.QuestionMark);
            this.incrementAttributeCounterIfUndefined(maybeOptionalConstant);
        }

        const wrapped: WrappedRead<Kind, Content> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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

    private readKeyValuePair<Kind, Key, Value>(
        nodeKind: Kind & Ast.TKeyValuePairNodeKind,
        keyReader: () => Key,
        valueReader: () => Value,
    ): Ast.IKeyValuePair<Kind, Key, Value> {
        this.startContext(nodeKind);

        const key: Key = keyReader();
        const equalConstant: Ast.Constant = this.readTokenKindAsConstant(TokenKind.Equal);
        const value: Value = valueReader();

        const keyValuePair: Ast.IKeyValuePair<Kind, Key, Value> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
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

    private readCsvArray<T>(
        valueReader: () => T & Ast.TCsvType,
        continueReadingValues: boolean,
    ): Ast.TCsvArray & Ast.ICsvArray<T & Ast.TCsvType> {
        const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
        this.startContext(nodeKind);

        const elements: Ast.ICsv<T & Ast.TCsvType>[] = [];

        while (continueReadingValues) {
            const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            this.startContext(csvNodeKind);

            const node: T & Ast.TCsvType = valueReader();
            const maybeCommaConstant: Option<Ast.Constant> = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
            this.incrementAttributeCounterIfUndefined(maybeCommaConstant);
            continueReadingValues = maybeCommaConstant !== undefined;

            const element: Ast.TCsv & Ast.ICsv<T & Ast.TCsvType> = {
                ...this.expectContextNodeMetadata(),
                kind: csvNodeKind,
                isLeaf: false,
                node,
                maybeCommaConstant,
            };
            elements.push(element);
            this.endContext(element);
        }

        const astNode: Ast.ICsvArray<T & Ast.TCsvType> = {
            ...this.expectContextNodeMetadata(),
            kind: nodeKind,
            isLeaf: false,
            elements,
        };
        this.endContext(astNode);
        return astNode;
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

    private incrementAttributeCounter(): void {
        if (this.maybeCurrentContextNode === undefined) {
            throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
        }
        const currentContextNode: ParserContext.Node = this.maybeCurrentContextNode;
        currentContextNode.attributeCounter += 1;
    }

    private incrementAttributeCounterIfUndefined(node: Option<Ast.TNode>): void {
        if (node === undefined) {
            this.incrementAttributeCounter();
        }
    }

    private startContext(nodeKind: Ast.NodeKind): void {
        this.maybeCurrentContextNode = ParserContext.startContext(
            this.contextState,
            nodeKind,
            this.tokenIndex,
            this.maybeCurrentToken,
            this.maybeCurrentContextNode,
        );
    }

    private endContext(astNode: Ast.TNode): void {
        if (this.maybeCurrentContextNode === undefined) {
            throw new CommonError.InvariantError(
                "maybeContextNode should be truthy, can't end a context if it doesn't exist.",
            );
        }

        this.maybeCurrentContextNode = ParserContext.endContext(
            this.contextState,
            this.maybeCurrentContextNode,
            astNode,
        );
    }

    private deleteContext(maybeNodeId: Option<number>): void {
        let nodeId: number;
        if (maybeNodeId === undefined) {
            if (this.maybeCurrentContextNode === undefined) {
                throw new CommonError.InvariantError(
                    "maybeContextNode should be truthy, can't delete a context if it doesn't exist.",
                );
            } else {
                const currentContextNode: ParserContext.Node = this.maybeCurrentContextNode;
                nodeId = currentContextNode.id;
            }
        } else {
            nodeId = maybeNodeId;
        }

        this.maybeCurrentContextNode = ParserContext.deleteContext(this.contextState, nodeId);
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
        const currentContextNode: ParserContext.Node = this.maybeCurrentContextNode;

        const maybeTokenStart: Option<Token> = currentContextNode.maybeTokenStart;
        if (maybeTokenStart === undefined) {
            throw new CommonError.InvariantError(`maybeTokenStart should be truthy`);
        }
        const tokenStart: Token = maybeTokenStart;

        // inclusive token index
        const tokenIndexEnd: number = this.tokenIndex - 1;
        const maybeTokenEnd: Option<Token> = this.lexerSnapshot.tokens[tokenIndexEnd];
        if (maybeTokenEnd === undefined) {
            throw new CommonError.InvariantError(`maybeTokenEnd should be truthy`);
        }
        const tokenEnd: Token = maybeTokenEnd;

        const tokenRange: Ast.TokenRange = {
            tokenIndexStart: currentContextNode.tokenIndexStart,
            tokenIndexEnd,
            positionStart: tokenStart.positionStart,
            positionEnd: tokenEnd.positionEnd,
        };

        const contextNode: ParserContext.Node = this.maybeCurrentContextNode;
        return {
            id: contextNode.id,
            maybeAttributeIndex: currentContextNode.maybeAttributeIndex,
            tokenRange,
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
            contextState: ParserContext.deepCopy(this.contextState),
            maybeContextNodeId:
                this.maybeCurrentContextNode !== undefined ? this.maybeCurrentContextNode.id : undefined,
        };
    }

    private restoreBackup(backup: StateBackup): void {
        this.tokenIndex = backup.tokenIndex;
        this.maybeCurrentToken = this.lexerSnapshot.tokens[this.tokenIndex];
        this.maybeCurrentTokenKind = this.maybeCurrentToken !== undefined ? this.maybeCurrentToken.kind : undefined;

        this.contextState = backup.contextState;

        if (backup.maybeContextNodeId) {
            this.maybeCurrentContextNode = NodeIdMap.expectContextNode(
                this.contextState.nodeIdMapCollection.contextNodeById,
                backup.maybeContextNodeId,
            );
        } else {
            this.maybeCurrentContextNode = undefined;
        }
    }
}

export interface ParseOk {
    readonly document: Ast.TDocument;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export function tryParse(lexerSnapshot: LexerSnapshot): TriedParse {
    const parser: Parser = new Parser(lexerSnapshot);
    return parser.tryParse();
}

type TriedReadPrimaryType = Result<
    Ast.TPrimaryType,
    ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

type TriedReadPrimitiveType = Result<
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

interface StateBackup {
    readonly tokenIndex: number;
    readonly contextState: ParserContext.State;
    readonly maybeContextNodeId: Option<number>;
}
interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeAttributeIndex: Option<number>;
    readonly tokenRange: Ast.TokenRange;
}

interface WrappedRead<Kind, Content> extends Ast.IWrapped<Kind, Content> {
    readonly maybeOptionalConstant: Option<Ast.Constant>;
}
