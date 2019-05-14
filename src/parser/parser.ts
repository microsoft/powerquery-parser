// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, StringHelpers } from "../common";
import { isNever } from "../common/assert";
import { Option } from "../common/option";
import { Result, ResultKind } from "../common/result";
import { Keyword } from "../lexer/keywords";
import { LexerSnapshot } from "../lexer/lexerSnapshot";
import { Token, TokenKind } from "../lexer/token";
import { Ast } from "./ast";
import { ParserError } from "./error";
import { TokenRange, tokenRangeHashFrom } from "./tokenRange";

export class Parser {
    private currentToken: Option<Token>;
    private currentTokenKind: Option<TokenKind>;

    private constructor(
        private readonly lexerSnapshot: LexerSnapshot,
        private tokenIndex: number = 0,
        private readonly tokenRangeStack: TokenRangeStackElement[] = [],
    ) {
        if (this.lexerSnapshot.tokens.length) {
            this.currentToken = this.lexerSnapshot.tokens[0];
            this.currentTokenKind = this.currentToken.kind;
        }
    }

    public static run(lexerSnapshot: LexerSnapshot): Result<Ast.TDocument, ParserError.TParserError> {
        if (!lexerSnapshot.tokens.length) {
            throw new CommonError.InvariantError("the parser received an empty token array");
        }

        const parser = new Parser(lexerSnapshot);
        try {
            return {
                kind: ResultKind.Ok,
                value: parser.readDocument(),
            };
        }
        catch (e) {
            let error: ParserError.TParserError;
            if (ParserError.isTInnerParserError(e)) {
                error = new ParserError.ParserError(e);
            }
            else {
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
        let document;
        if (this.isOnTokenKind(TokenKind.KeywordSection)) {
            document = this.readSection();
        }
        else {
            const state = this.backup();
            try {
                document = this.readExpression();
                const maybeErr = this.expectNoMoreTokens();
                if (maybeErr) {
                    throw maybeErr;
                }
            }
            catch (firstErr) {
                this.restore(state);
                try {
                    document = this.readSection();
                    const maybeErr = this.expectNoMoreTokens();
                    if (maybeErr) {
                        throw maybeErr;
                    }
                }
                catch {
                    throw firstErr;
                }
            }
        }

        return document;
    }

    private readSection(): Ast.Section {
        this.startTokenRange(Ast.NodeKind.Section);

        const maybeLiteralAttributes = this.maybeReadLiteralAttributes();
        const sectionConstant = this.readTokenKindAsConstant(TokenKind.KeywordSection);

        let maybeName: Option<Ast.Identifier>;
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            maybeName = this.readIdentifier();
        }

        const semicolonConstant = this.readTokenKindAsConstant(TokenKind.Semicolon);

        const totalTokens = this.lexerSnapshot.tokens.length;
        const sectionMembers = [];
        while (this.tokenIndex < totalTokens) {
            sectionMembers.push(this.readSectionMember());
        }

        return {
            kind: Ast.NodeKind.Section,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            maybeLiteralAttributes,
            sectionConstant,
            maybeName,
            semicolonConstant,
            sectionMembers
        }
    }

    // sub-item of 12.2.2 Section Documents
    private readSectionMember(): Ast.SectionMember {
        this.startTokenRange(Ast.NodeKind.SectionMember);

        const maybeLiteralAttributes = this.maybeReadLiteralAttributes();
        const maybeSharedConstant = this.maybeReadTokenKindAsConstant(TokenKind.KeywordShared);
        const namePairedExpression = this.readIdentifierPairedExpression();
        const semicolonConstant = this.readTokenKindAsConstant(TokenKind.Semicolon);

        return {
            kind: Ast.NodeKind.SectionMember,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            maybeLiteralAttributes,
            maybeSharedConstant,
            namePairedExpression,
            semicolonConstant,
        }
    }

    // 12.2.3.1 Expressions
    private readExpression(): Ast.TExpression {
        switch (this.currentTokenKind) {
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
                const disambiguation = this.disambiguateParenthesis();
                switch (disambiguation) {
                    case ParenthesisDisambiguation.FunctionExpression:
                        return this.readFunctionExpression();

                    case ParenthesisDisambiguation.ParenthesizedExpression:
                        return this.readLogicalExpression()

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
        return this.readBinOpKeywordExpression<Ast.NodeKind.IsExpression, Ast.TAsExpression, TokenKind.KeywordIs, Ast.TNullablePrimitiveType>(
            Ast.NodeKind.IsExpression,
            () => this.readAsExpression(),
            TokenKind.KeywordIs,
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
        }
        else {
            return this.readPrimitiveType();
        }
    }

    // 12.2.3.4 As expression
    private readAsExpression(): Ast.TAsExpression {
        return this.readBinOpKeywordExpression<Ast.NodeKind.AsExpression, Ast.TEqualityExpression, TokenKind.KeywordAs, Ast.TNullablePrimitiveType>(
            Ast.NodeKind.AsExpression,
            () => this.readEqualityExpression(),
            TokenKind.KeywordAs,
            () => this.readNullablePrimitiveType(),
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
        return this.readBinOpExpression<Ast.NodeKind.RelationalExpression, Ast.RelationalOperator, Ast.TRelationalExpression>(
            Ast.NodeKind.RelationalExpression,
            Ast.relationalOperatorFrom,
            () => this.readArithmeticExpression(),
        );
    }

    // 12.2.3.7 Arithmetic expressions
    private readArithmeticExpression(): Ast.TArithmeticExpression {
        return this.readBinOpExpression<Ast.NodeKind.ArithmeticExpression, Ast.ArithmeticOperator, Ast.TArithmeticExpression>(
            Ast.NodeKind.ArithmeticExpression,
            Ast.arithmeticOperatorFrom,
            () => this.readMetadataExpression(),
        );
    }

    // 12.2.3.8 Metadata expression
    private readMetadataExpression(): Ast.TMetadataExpression {
        return this.readBinOpKeywordExpression<Ast.NodeKind.MetadataExpression, Ast.TUnaryExpression, TokenKind.KeywordMeta, Ast.TUnaryExpression>(
            Ast.NodeKind.MetadataExpression,
            () => this.readUnaryExpression(),
            TokenKind.KeywordMeta,
            () => this.readUnaryExpression(),
        )
    }

    // 12.2.3.9 Unary expression
    private readUnaryExpression(): Ast.TUnaryExpression {
        let maybeOperator = Ast.unaryOperatorFrom(this.currentTokenKind);

        if (maybeOperator) {
            this.startTokenRange(Ast.NodeKind.UnaryExpression);
            const expressions: Ast.UnaryExpressionHelper<Ast.UnaryOperator, Ast.TUnaryExpression>[] = [];

            while (maybeOperator) {
                this.startTokenRange(Ast.NodeKind.UnaryExpressionHelper);
                const operatorConstant = this.readUnaryOperatorAsConstant(maybeOperator);
                expressions.push({
                    kind: Ast.NodeKind.UnaryExpressionHelper,
                    tokenRange: this.popTokenRange(),
                    terminalNode: false,
                    inBinaryExpression: false,
                    operator: maybeOperator,
                    operatorConstant,
                    node: this.readUnaryExpression(),
                });
                maybeOperator = Ast.unaryOperatorFrom(this.currentTokenKind);
            };

            const result: Ast.UnaryExpression = {
                kind: Ast.NodeKind.UnaryExpression,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                expressions,
            };
            return result;
        }
        else {
            return this.readTypeExpression();
        }
    }

    // 12.2.3.10 Primary expression
    private readPrimaryExpression(): Ast.TPrimaryExpression {
        // I'd prefer to use a switch statement here but there's an issue with Typescript.
        // Doing a switch on this.currentTokenKind makes all child expressions think it's constant,
        // but it gets updated with readX calls.

        let primaryExpression: Option<Ast.TPrimaryExpression>;
        const currentTokenKind = this.currentTokenKind;
        const isIdentifierExpressionNext = (
            currentTokenKind === TokenKind.AtSign
            || currentTokenKind === TokenKind.Identifier
        );

        if (isIdentifierExpressionNext) {
            primaryExpression = this.readIdentifierExpression();
        }

        else {
            switch (currentTokenKind) {
                case TokenKind.LeftParenthesis:
                    primaryExpression = this.readParenthesizedExpression();
                    break;

                case TokenKind.LeftBracket:
                    const disambiguation = this.disambiguateBracket();
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
                    break;
            }
        }

        const isRecursivePrimaryExpression = (
            // this.isOnTokenKind(TokenKind.Bang)               // section-access-expression
            this.isOnTokenKind(TokenKind.LeftBrace)             // field-access-expression
            || this.isOnTokenKind(TokenKind.LeftBracket)        // item-access-expression
            || this.isOnTokenKind(TokenKind.LeftParenthesis)    // invoke-expression
        )
        if (isRecursivePrimaryExpression) {
            return this.readRecursivePrimaryExpression(primaryExpression);
        }
        else {
            return primaryExpression;
        }
    }

    // 12.2.3.11 Literal expression
    private readLiteralExpression(): Ast.LiteralExpression {
        this.startTokenRange(Ast.NodeKind.LiteralExpression);

        const expectedTokenKinds = [
            TokenKind.HexLiteral,
            TokenKind.KeywordFalse,
            TokenKind.KeywordTrue,
            TokenKind.NumericLiteral,
            TokenKind.NullLiteral,
            TokenKind.StringLiteral,
        ];
        const maybeErr = this.expectAnyTokenKind(expectedTokenKinds);
        if (maybeErr) {
            throw maybeErr;
        }

        let maybeLiteralKind = Ast.literalKindFrom(this.currentTokenKind);
        if (maybeLiteralKind === undefined) {
            throw new CommonError.InvariantError(`couldn't convert TokenKind=${this.currentTokenKind} into LiteralKind`);
        }

        const literal = this.readToken();
        return {
            kind: Ast.NodeKind.LiteralExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: true,
            literal: literal,
            literalKind: maybeLiteralKind,
        };
    }

    // 12.2.3.12 Identifier expression
    private readIdentifierExpression(): Ast.IdentifierExpression {
        this.startTokenRange(Ast.NodeKind.IdentifierExpression);

        const maybeInclusiveConstant = this.maybeReadTokenKindAsConstant(TokenKind.AtSign);
        const identifier = this.readIdentifier();

        return {
            kind: Ast.NodeKind.IdentifierExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            maybeInclusiveConstant,
            identifier,
        }
    }

    // 12.2.3.14 Parenthesized expression
    private readParenthesizedExpression(): Ast.ParenthesizedExpression {
        return this.readWrapped<Ast.NodeKind.ParenthesizedExpression, Ast.TExpression>(
            Ast.NodeKind.ParenthesizedExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftParenthesis),
            () => this.readExpression(),
            () => this.readTokenKindAsConstant(TokenKind.RightParenthesis),
        );
    }

    // 12.2.3.15 Not-implemented expression
    private readNotImplementedExpression(): Ast.NotImplementedExpression {
        this.startTokenRange(Ast.NodeKind.NotImplementedExpression);

        const ellipsisConstant = this.readTokenKindAsConstant(TokenKind.Ellipsis);

        return {
            kind: Ast.NodeKind.NotImplementedExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            ellipsisConstant,
        };
    }

    // 12.2.3.16 Invoke expression
    private readInvokeExpression(): Ast.InvokeExpression {
        const continueReadingValues = !this.isNextTokenKind(TokenKind.RightParenthesis);
        return this.readWrapped<Ast.NodeKind.InvokeExpression, ReadonlyArray<Ast.ICsv<Ast.TExpression>>>(
            Ast.NodeKind.InvokeExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftParenthesis),
            () => this.readCsv(
                () => this.readExpression(),
                continueReadingValues,
            ),
            () => this.readTokenKindAsConstant(TokenKind.RightParenthesis),
        );
    }

    // 12.2.3.17 List expression
    private readListExpression(): Ast.ListExpression {
        const continueReadingValues = !this.isNextTokenKind(TokenKind.RightBrace);
        return this.readWrapped<Ast.NodeKind.ListExpression, ReadonlyArray<Ast.ICsv<Ast.TExpression>>>(
            Ast.NodeKind.ListExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readCsv(
                () => this.readExpression(),
                continueReadingValues,
            ),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
        );
    }

    // 12.2.3.18 Record expression
    private readRecordExpression(): Ast.RecordExpression {
        const continueReadingValues = !this.isNextTokenKind(TokenKind.RightBracket);
        return this.readWrapped<Ast.NodeKind.RecordExpression, ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedExpression>>>(
            Ast.NodeKind.RecordExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readGeneralizedIdentifierPairedExpressions(continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
        );
    }

    // 12.2.3.19 Item access expression
    private readItemAccessExpression(): Ast.ItemAccessExpression {
        this.startTokenRange(Ast.NodeKind.ItemAccessExpression);
        const maybeReturn = this.readWrapped<Ast.NodeKind.ItemAccessExpression, Ast.TExpression>(
            Ast.NodeKind.ItemAccessExpression,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readExpression(),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
        );

        // hack to conditionally read '?' after closeWrapperConstant
        const maybeOptionalConstant = this.maybeReadTokenKindAsConstant(TokenKind.QuestionMark);
        if (maybeOptionalConstant) {
            const newTokenRange = this.popTokenRange();
            return {
                tokenRange: newTokenRange,
                maybeOptionalConstant,
                ...maybeReturn
            };
        }
        else {
            this.popTokenRangeNoop();
            return {
                maybeOptionalConstant: undefined,
                ...maybeReturn
            }
        }
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldSelection(): Ast.FieldSelector {
        return this.readFieldSelector(true);
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldProjection(): Ast.FieldProjection {
        this.startTokenRange(Ast.NodeKind.FieldProjection);
        const maybeReturn = this.readWrapped<Ast.NodeKind.FieldProjection, ReadonlyArray<Ast.ICsv<Ast.FieldSelector>>>(
            Ast.NodeKind.FieldProjection,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readCsv(
                () => this.readFieldSelector(false),
                true,
            ),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
        );

        // hack to conditionally read '?' after closeWrapperConstant
        // and to add in "implicit" metatdata
        const maybeOptionalConstant = this.maybeReadTokenKindAsConstant(TokenKind.QuestionMark);
        if (maybeOptionalConstant) {
            const newTokenRange = this.popTokenRange();
            return {
                tokenRange: newTokenRange,
                maybeOptionalConstant,
                ...maybeReturn
            };
        }
        else {
            this.popTokenRangeNoop();
            return {
                maybeOptionalConstant: undefined,
                ...maybeReturn,
            };
        }
    }

    // sub-item of 12.2.3.20 Field access expressions
    private readFieldSelector(allowOptional: boolean): Ast.FieldSelector {
        this.startTokenRange(Ast.NodeKind.FieldSelector);
        const maybeReturn = this.readWrapped<Ast.NodeKind.FieldSelector, Ast.GeneralizedIdentifier>(
            Ast.NodeKind.FieldSelector,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readGeneralizedIdentifier(),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
        );

        // hack to conditionally read '?' after closeWrapperConstant
        // and to add in "implicit" metatdata
        const maybeOptionalConstant = allowOptional && this.maybeReadTokenKindAsConstant(TokenKind.QuestionMark);
        if (maybeOptionalConstant) {
            const newTokenRange = this.popTokenRange();
            return {
                tokenRange: newTokenRange,
                maybeOptionalConstant,
                ...maybeReturn
            };
        }
        else {
            this.popTokenRangeNoop();
            return {
                maybeOptionalConstant: undefined,
                ...maybeReturn,
            };
        }
    }

    // 12.2.3.21 Function expression
    private readFunctionExpression(): Ast.FunctionExpression {
        this.startTokenRange(Ast.NodeKind.FunctionExpression);

        const parameters = this.readParameterList(() => this.maybeReadAsNullablePrimitiveType());
        const maybeFunctionReturnType = this.maybeReadAsNullablePrimitiveType();
        const fatArrowConstant = this.readTokenKindAsConstant(TokenKind.FatArrow);
        const expression = this.readExpression();

        return {
            kind: Ast.NodeKind.FunctionExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            parameters,
            maybeFunctionReturnType,
            fatArrowConstant,
            expression,
        }
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
        this.startTokenRange(Ast.NodeKind.LetExpression);

        const letConstant = this.readTokenKindAsConstant(TokenKind.KeywordLet);
        const identifierExpressionPairedExpressions = this.readIdentifierPairedExpressions(true);
        const inConstant = this.readTokenKindAsConstant(TokenKind.KeywordIn);
        const expression = this.readExpression();

        return {
            kind: Ast.NodeKind.LetExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            letConstant,
            variableList: identifierExpressionPairedExpressions,
            inConstant,
            expression,
        };
    }

    // 12.2.3.24 If expression
    private readIfExpression(): Ast.IfExpression {
        this.startTokenRange(Ast.NodeKind.IfExpression);

        const ifConstant = this.readTokenKindAsConstant(TokenKind.KeywordIf);
        const condition = this.readExpression();

        const thenConstant = this.readTokenKindAsConstant(TokenKind.KeywordThen);
        const trueExpression = this.readExpression();

        const elseConstant = this.readTokenKindAsConstant(TokenKind.KeywordElse);
        const falseExpression = this.readExpression();

        return {
            kind: Ast.NodeKind.IfExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            ifConstant,
            condition,
            thenConstant,
            trueExpression,
            elseConstant,
            falseExpression,
        };
    }

    // 12.2.3.25 Type expression
    private readTypeExpression(): Ast.TTypeExpression {
        if (this.isOnTokenKind(TokenKind.KeywordType)) {
            return this.readPairedConstant<Ast.NodeKind.TypePrimaryType, Ast.TPrimaryType>(
                Ast.NodeKind.TypePrimaryType,
                () => this.readTokenKindAsConstant(TokenKind.KeywordType),
                () => this.readPrimaryType(),
            )
        }
        else {
            return this.readPrimaryExpression();
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readType(): Ast.TType {
        const triedReadPrimaryType = this.tryReadPrimaryType();
        if (triedReadPrimaryType.kind === ResultKind.Ok) {
            return triedReadPrimaryType.value;
        }
        else {
            return this.readPrimaryExpression();
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readPrimaryType(): Ast.TPrimaryType {
        const triedReadPrimaryType = this.tryReadPrimaryType();
        if (triedReadPrimaryType.kind === ResultKind.Ok) {
            return triedReadPrimaryType.value;
        }
        else {
            throw triedReadPrimaryType.error;
        }
    }

    private tryReadPrimaryType(): Result<Ast.TPrimaryType, ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError> {
        const state = this.backup();

        const isTableTypeNext = (
            this.isOnIdentifierConstant(Ast.IdentifierConstant.Table)
            && (
                this.isNextTokenKind(TokenKind.LeftBracket)
                || this.isNextTokenKind(TokenKind.LeftParenthesis)
                || this.isNextTokenKind(TokenKind.AtSign)
                || this.isNextTokenKind(TokenKind.Identifier)
            )
        );
        const isFunctionTypeNext = (
            this.isOnIdentifierConstant(Ast.IdentifierConstant.Function)
            && this.isNextTokenKind(TokenKind.LeftParenthesis)
        );

        if (this.isOnTokenKind(TokenKind.LeftBracket)) {
            return {
                kind: ResultKind.Ok,
                value: this.readRecordType(),
            };
        }
        else if (this.isOnTokenKind(TokenKind.LeftBrace)) {
            return {
                kind: ResultKind.Ok,
                value: this.readListType(),
            };
        }
        else if (isTableTypeNext) {
            return {
                kind: ResultKind.Ok,
                value: this.readTableType(),
            };
        }
        else if (isFunctionTypeNext) {
            return {
                kind: ResultKind.Ok,
                value: this.readFunctionType(),
            };
        }
        else if (this.isOnIdentifierConstant(Ast.IdentifierConstant.Nullable)) {
            return {
                kind: ResultKind.Ok,
                value: this.readNullableType(),
            };
        }
        else {
            const triedReadPrimitiveType = this.tryReadPrimitiveType();
            if (triedReadPrimitiveType.kind === ResultKind.Err) {
                this.restore(state);
            }
            return triedReadPrimitiveType;
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readRecordType(): Ast.RecordType {
        this.startTokenRange(Ast.NodeKind.RecordType)

        const fields = this.readFieldSpecificationList(true);

        return {
            kind: Ast.NodeKind.RecordType,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            fields,
        };
    }

    // sub-item of 12.2.3.25 Type expression
    private readTableType(): Ast.TableType {
        this.startTokenRange(Ast.NodeKind.TableType)

        const tableConstant = this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Table);
        const currentTokenKind = this.currentTokenKind;
        const isPrimaryExpressionExpected = (
            currentTokenKind === TokenKind.AtSign
            || currentTokenKind === TokenKind.Identifier
            || currentTokenKind === TokenKind.LeftParenthesis
        )

        let rowType;
        if (isPrimaryExpressionExpected) {
            rowType = this.readPrimaryExpression();
        }
        else {
            rowType = this.readFieldSpecificationList(false);
        }

        return {
            kind: Ast.NodeKind.TableType,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            tableConstant,
            rowType,
        };
    }

    // sub-item of 12.2.3.25 Type expression
    private readFieldSpecificationList(allowOpenMarker: boolean): Ast.FieldSpecificationList {
        this.startTokenRange(Ast.NodeKind.FieldSpecificationList);

        const leftBracketConstant = this.readTokenKindAsConstant(TokenKind.LeftBracket);
        const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
        let continueReadingValues = true;
        let maybeOpenRecordMarkerConstant = undefined;

        while (continueReadingValues) {
            if (this.isOnTokenKind(TokenKind.Ellipsis)) {
                if (allowOpenMarker) {
                    if (maybeOpenRecordMarkerConstant) {
                        throw this.fieldSpecificationListReadError(false);
                    }
                    else {
                        maybeOpenRecordMarkerConstant = this.readTokenKindAsConstant(TokenKind.Ellipsis);
                        continueReadingValues = false;
                    }
                }
                else {
                    throw this.fieldSpecificationListReadError(allowOpenMarker);
                }
            }

            else if (this.isOnTokenKind(TokenKind.Identifier)) {
                this.startTokenRange(Ast.NodeKind.Csv);
                this.startTokenRange(Ast.NodeKind.FieldSpecification);

                const maybeOptionalConstant = this.maybeReadIdentifierConstantAsConstant(Ast.IdentifierConstant.Optional);
                const name = this.readGeneralizedIdentifier();
                const maybeFieldTypeSpeification = this.maybeReadFieldTypeSpecification();
                const maybeCommaConstant = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
                continueReadingValues = maybeCommaConstant !== undefined;

                const field: Ast.FieldSpecification = {
                    kind: Ast.NodeKind.FieldSpecification,
                    tokenRange: this.popTokenRange(),
                    terminalNode: false,
                    maybeOptionalConstant,
                    name,
                    maybeFieldTypeSpeification,
                };
                fields.push({
                    kind: Ast.NodeKind.Csv,
                    tokenRange: this.popTokenRange(),
                    terminalNode: false,
                    node: field,
                    maybeCommaConstant,
                })
            }

            else {
                throw this.fieldSpecificationListReadError(allowOpenMarker);
            }
        }

        const rightBracketConstant = this.readTokenKindAsConstant(TokenKind.RightBracket);

        return {
            kind: Ast.NodeKind.FieldSpecificationList,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            openWrapperConstant: leftBracketConstant,
            content: fields,
            maybeOpenRecordMarkerConstant,
            closeWrapperConstant: rightBracketConstant,
        };
    }

    // sub-item of 12.2.3.25 Type expression
    private maybeReadFieldTypeSpecification(): Option<Ast.FieldTypeSpecification> {
        this.startTokenRange(Ast.NodeKind.FieldTypeSpecification);
        const maybeEqualConstant = this.maybeReadTokenKindAsConstant(TokenKind.Equal);
        if (maybeEqualConstant) {
            const fieldType = this.readType();

            return {
                kind: Ast.NodeKind.FieldTypeSpecification,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                equalConstant: maybeEqualConstant,
                fieldType,
            }
        }
        else {
            this.popTokenRangeNoop();
            return undefined;
        }
    }

    // sub-item of 12.2.3.25 Type expression
    private readFunctionType(): Ast.FunctionType {
        this.startTokenRange(Ast.NodeKind.FunctionType)

        const functionConstant = this.readIdentifierConstantAsConstant(Ast.IdentifierConstant.Function);
        const parameters = this.readParameterList(() => this.readAsType());
        const functionReturnType = this.readAsType();

        return {
            kind: Ast.NodeKind.FunctionType,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            functionConstant,
            parameters,
            functionReturnType,
        };
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
        this.startTokenRange(Ast.NodeKind.ErrorHandlingExpression);

        const tryConstant = this.readTokenKindAsConstant(TokenKind.KeywordTry);
        const protectedExpression = this.readExpression();

        const otherwiseExpressionNodeKind = Ast.NodeKind.OtherwiseExpression;
        const maybeOtherwiseExpression = this.maybeReadPairedConstant<Ast.NodeKind.OtherwiseExpression, Ast.TExpression>(
            otherwiseExpressionNodeKind,
            () => this.isOnTokenKind(TokenKind.KeywordOtherwise),
            () => this.readTokenKindAsConstant(TokenKind.KeywordOtherwise),
            () => this.readExpression(),
        );

        return {
            kind: Ast.NodeKind.ErrorHandlingExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            tryConstant,
            protectedExpression,
            maybeOtherwiseExpression,
        };
    }

    // 12.2.4 Literal Attributes
    private maybeReadLiteralAttributes(): Option<Ast.RecordLiteral> {
        if (this.isOnTokenKind(TokenKind.LeftBracket)) {
            return this.readRecordLiteral();
        }
        else {
            return undefined;
        }
    }

    private readRecordLiteral(): Ast.RecordLiteral {
        const continueReadingValues = !this.isNextTokenKind(TokenKind.RightBracket);
        const wrappedRead = this.readWrapped<Ast.NodeKind.RecordLiteral, ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedAnyLiteral>>>(
            Ast.NodeKind.RecordLiteral,
            () => this.readTokenKindAsConstant(TokenKind.LeftBracket),
            () => this.readFieldNamePairedAnyLiterals(continueReadingValues),
            () => this.readTokenKindAsConstant(TokenKind.RightBracket),
        );
        return {
            literalKind: Ast.LiteralKind.Record,
            ...wrappedRead
        }
    }

    private readFieldNamePairedAnyLiterals(
        continueReadingValues: boolean
    ): ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedAnyLiteral>> {
        return this.readCsv(
            () => this.readKeyValuePair<Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, Ast.GeneralizedIdentifier, Ast.TAnyLiteral>(
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                () => this.readGeneralizedIdentifier(),
                () => this.readAnyLiteral(),
            ),
            continueReadingValues,
        );
    }

    private readListLiteral(): Ast.ListLiteral {
        const continueReadingValues = !this.isNextTokenKind(TokenKind.RightBrace);
        const wrappedRead = this.readWrapped<Ast.NodeKind.ListLiteral, ReadonlyArray<Ast.ICsv<Ast.TAnyLiteral>>>(
            Ast.NodeKind.ListLiteral,
            () => this.readTokenKindAsConstant(TokenKind.LeftBrace),
            () => this.readCsv(
                () => this.readAnyLiteral(),
                continueReadingValues,
            ),
            () => this.readTokenKindAsConstant(TokenKind.RightBrace),
        );
        return {
            literalKind: Ast.LiteralKind.List,
            ...wrappedRead
        }
    }

    private readAnyLiteral(): Ast.TAnyLiteral {
        if (this.isOnTokenKind(TokenKind.LeftBracket)) {
            return this.readRecordLiteral();
        }
        else if (this.isOnTokenKind(TokenKind.LeftBrace)) {
            return this.readListLiteral();
        }
        else {
            return this.readLiteralExpression();
        }
    }

    private readParameterList<T>(typeReader: () => T): Ast.ParameterList<T> {
        this.startTokenRange(Ast.NodeKind.ParameterList);

        const leftParenthesisConstant = this.readTokenKindAsConstant(TokenKind.LeftParenthesis);
        let continueReadingValues = !this.isOnTokenKind(TokenKind.RightParenthesis);
        let reachedOptionalParameter = false;

        let parameters: Ast.ICsv<Ast.Parameter<T>>[] = [];
        while (continueReadingValues) {
            this.startTokenRange(Ast.NodeKind.Csv);
            this.startTokenRange(Ast.NodeKind.Parameter);
            const maybeOptionalConstant = this.maybeReadIdentifierConstantAsConstant(Ast.IdentifierConstant.Optional);

            if (reachedOptionalParameter && !maybeOptionalConstant) {
                const token = this.expectTokenAt(this.tokenIndex);
                throw new ParserError.RequiredParameterAfterOptionalParameterError(token);
            }
            else if (maybeOptionalConstant) {
                reachedOptionalParameter = true;
            }

            const name = this.readIdentifier();
            const maybeParameterType = typeReader();

            const node: Ast.Parameter<T> = {
                kind: Ast.NodeKind.Parameter,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                maybeOptionalConstant,
                name,
                maybeParameterType,
            };

            const maybeCommaConstant = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            parameters.push({
                kind: Ast.NodeKind.Csv,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                node,
                maybeCommaConstant,
            });
        }

        const rightParenthesisConstant = this.readTokenKindAsConstant(TokenKind.RightParenthesis);

        return {
            kind: Ast.NodeKind.ParameterList,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            openWrapperConstant: leftParenthesisConstant,
            content: parameters,
            closeWrapperConstant: rightParenthesisConstant,
        };
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
        );
    }

    private readRecursivePrimaryExpression(head: Ast.TPrimaryExpression): Ast.RecursivePrimaryExpression {
        const tokenRangeStart = head.tokenRange.startTokenIndex;
        this.startTokenRangeAt(Ast.NodeKind.RecursivePrimaryExpression, tokenRangeStart);

        const recursiveExpressions = [];
        let continueReadingValues = true;

        while (continueReadingValues) {
            const currentTokenKind = this.currentTokenKind;

            if (currentTokenKind === TokenKind.LeftParenthesis) {
                recursiveExpressions.push(this.readInvokeExpression());
            }

            else if (currentTokenKind === TokenKind.LeftBrace) {
                recursiveExpressions.push(this.readItemAccessExpression());
            }

            else if (currentTokenKind === TokenKind.LeftBracket) {
                const disambiguation = this.disambiguateBracket();

                switch (disambiguation) {
                    case BracketDisambiguation.FieldProjection:
                        recursiveExpressions.push(this.readFieldProjection());
                        break;

                    case BracketDisambiguation.FieldSelection:
                        recursiveExpressions.push(this.readFieldSelection());
                        break;

                    default:
                        throw new CommonError.InvariantError(`grammer doesn't allow remaining BracketDisambiguation: ${disambiguation}`);
                }
            }

            else {
                continueReadingValues = false;
            }
        }

        return {
            kind: Ast.NodeKind.RecursivePrimaryExpression,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            head,
            recursiveExpressions,
        };
    }

    private readIdentifier(): Ast.Identifier {
        const tokenRange = this.singleTokenRange(TokenKind.Identifier);
        const literal = this.readTokenKind(TokenKind.Identifier);

        return {
            kind: Ast.NodeKind.Identifier,
            tokenRange,
            terminalNode: true,
            literal,
        }
    }

    private readGeneralizedIdentifier(): Ast.GeneralizedIdentifier {
        this.startTokenRange(Ast.NodeKind.GeneralizedIdentifier);
        let literal;

        const currentTokenKind = this.currentTokenKind;
        const isKeywordGeneralizedIdentifier = (
            currentTokenKind === TokenKind.KeywordAnd
            || currentTokenKind === TokenKind.KeywordAs
            || currentTokenKind === TokenKind.KeywordEach
            || currentTokenKind === TokenKind.KeywordElse
            || currentTokenKind === TokenKind.KeywordError
            || currentTokenKind === TokenKind.KeywordFalse
            || currentTokenKind === TokenKind.KeywordIf
            || currentTokenKind === TokenKind.KeywordIn
            || currentTokenKind === TokenKind.KeywordIs
            || currentTokenKind === TokenKind.KeywordLet
            || currentTokenKind === TokenKind.KeywordMeta
            || currentTokenKind === TokenKind.KeywordNot
            || currentTokenKind === TokenKind.KeywordOtherwise
            || currentTokenKind === TokenKind.KeywordOr
            || currentTokenKind === TokenKind.KeywordSection
            || currentTokenKind === TokenKind.KeywordShared
            || currentTokenKind === TokenKind.KeywordThen
            || currentTokenKind === TokenKind.KeywordTrue
            || currentTokenKind === TokenKind.KeywordTry
            || currentTokenKind === TokenKind.KeywordType
        );
        if (isKeywordGeneralizedIdentifier) {
            literal = this.readToken();
        }
        else {
            const firstIdentifierTokenIndex = this.tokenIndex;
            let lastIdentifierTokenIndex = firstIdentifierTokenIndex;
            while (this.isOnTokenKind(TokenKind.Identifier)) {
                lastIdentifierTokenIndex = this.tokenIndex;
                this.readToken();
            }

            const lexerSnapshot = this.lexerSnapshot;
            const tokens = lexerSnapshot.tokens;
            const contiguousIdentifierStartIndex = tokens[firstIdentifierTokenIndex].positionStart.codeUnit;
            const contiguousIdentifierEndIndex = tokens[lastIdentifierTokenIndex].positionEnd.codeUnit;
            literal = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);
        }

        return {
            kind: Ast.NodeKind.GeneralizedIdentifier,
            tokenRange: this.popTokenRange(),
            terminalNode: true,
            literal,
        }
    }

    private readPrimitiveType(): Ast.PrimitiveType {
        const res = this.tryReadPrimitiveType();
        if (res.kind === ResultKind.Ok) {
            return res.value;
        }
        else {
            throw res.error;
        }
    }

    private tryReadPrimitiveType(): Result<Ast.PrimitiveType, ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError> {
        this.startTokenRange(Ast.NodeKind.PrimitiveType);
        const state = this.backup();
        const expectedTokenKinds = [
            TokenKind.Identifier,
            TokenKind.KeywordType,
            TokenKind.NullLiteral,
        ];
        const maybeErr = this.expectAnyTokenKind(expectedTokenKinds);
        if (maybeErr) {
            throw maybeErr;
        }

        let primitiveType: Ast.Constant;
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            const currentTokenData = this.lexerSnapshot.tokens[this.tokenIndex].data;
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
                    const token = this.expectTokenAt(this.tokenIndex);
                    this.restore(state);
                    return {
                        kind: ResultKind.Err,
                        error: new ParserError.InvalidPrimitiveTypeError(token),
                    }
            }
        }
        else if (this.isOnTokenKind((TokenKind.KeywordType))) {
            primitiveType = this.readTokenKindAsConstant(TokenKind.KeywordType);
        }
        else if (this.isOnTokenKind(TokenKind.NullLiteral)) {
            primitiveType = this.readTokenKindAsConstant(TokenKind.NullLiteral);
        }
        else {
            const details = { tokenKind: this.currentTokenKind };
            this.restore(state);
            return {
                kind: ResultKind.Err,
                error: new CommonError.InvariantError(
                    `unknown currentTokenKind, not found in [${expectedTokenKinds}]`,
                    details,
                )
            }
        }

        return {
            kind: ResultKind.Ok,
            value: {
                kind: Ast.NodeKind.PrimitiveType,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                primitiveType,
            }
        };
    }

    private readIdentifierPairedExpressions(
        continueReadingValues: boolean
    ): ReadonlyArray<Ast.ICsv<Ast.IdentifierPairedExpression>> {
        return this.readCsv(
            () => this.readIdentifierPairedExpression(),
            continueReadingValues,
        );
    }

    private readGeneralizedIdentifierPairedExpressions(
        continueReadingValues: boolean
    ): ReadonlyArray<Ast.ICsv<Ast.GeneralizedIdentifierPairedExpression>> {
        return this.readCsv(
            () => this.readGeneralizedIdentifierPairedExpression(),
            continueReadingValues,
        );
    }

    private readGeneralizedIdentifierPairedExpression(): Ast.GeneralizedIdentifierPairedExpression {
        return this.readKeyValuePair<Ast.NodeKind.GeneralizedIdentifierPairedExpression, Ast.GeneralizedIdentifier, Ast.TExpression>(
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
        const tokens = this.lexerSnapshot.tokens;

        if (this.tokenIndex >= tokens.length) {
            const details = {
                tokenIndex: this.tokenIndex,
                "tokens.length": tokens.length,
            }
            throw new CommonError.InvariantError("index beyond tokens.length", details);
        }

        const data = tokens[this.tokenIndex].data;
        this.tokenIndex += 1;

        if (this.tokenIndex === tokens.length) {
            this.currentTokenKind = undefined;
        }
        else {
            this.currentToken = tokens[this.tokenIndex];
            this.currentTokenKind = this.currentToken.kind;
        }

        return data;
    }

    private readTokenKind(tokenKind: TokenKind): string {
        const maybeErr = this.expectTokenKind(tokenKind);
        if (maybeErr) {
            throw maybeErr;
        }

        return this.readToken();
    }

    private readTokenKindAsConstant(tokenKind: TokenKind): Ast.Constant {
        const maybeConstant = this.maybeReadTokenKindAsConstant(tokenKind);
        if (!maybeConstant) {
            const maybeErr = this.expectTokenKind(tokenKind);
            if (maybeErr) {
                throw maybeErr;
            }
            else {
                const details = {
                    expectedTokenKind: tokenKind,
                    actualTokenKind: this.currentTokenKind,
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
            const tokenRange = this.singleTokenRange(tokenKind);

            const maybeConstantKind = Ast.constantKindFromTokenKind(tokenKind);
            if (!maybeConstantKind) {
                throw new CommonError.InvariantError(`couldn't convert TokenKind=${tokenKind} into ConstantKind`);
            }

            this.readToken();
            return {
                kind: Ast.NodeKind.Constant,
                tokenRange,
                terminalNode: true,
                literal: maybeConstantKind,
            }
        }
        else {
            return undefined;
        }
    }

    private readIdentifierConstantAsConstant(identifierConstant: Ast.IdentifierConstant): Ast.Constant {
        const maybeConstant = this.maybeReadIdentifierConstantAsConstant(identifierConstant);
        if (!maybeConstant) {
            throw new CommonError.InvariantError(`couldn't convert IdentifierConstant=${identifierConstant} into ConstantKind`);
        }

        return maybeConstant;
    }

    private maybeReadIdentifierConstantAsConstant(identifierConstant: Ast.IdentifierConstant): Option<Ast.Constant> {
        if (this.isOnIdentifierConstant(identifierConstant)) {
            const tokenRange = this.singleTokenRange(identifierConstant);

            const maybeConstantKind = Ast.constantKindFromIdentifieConstant(identifierConstant);
            if (!maybeConstantKind) {
                throw new CommonError.InvariantError(`couldn't convert IdentifierConstant=${identifierConstant} into ConstantKind`);
            }

            this.readToken();
            return {
                kind: Ast.NodeKind.Constant,
                tokenRange,
                terminalNode: true,
                literal: maybeConstantKind,
            }
        }
        else {
            return undefined;
        }
    }

    private readUnaryOperatorAsConstant(operator: Ast.TUnaryExpressionHelperOperator): Ast.Constant {
        const tokenRange = this.singleTokenRange(operator);
        this.readToken();

        return {
            kind: Ast.NodeKind.Constant,
            tokenRange,
            terminalNode: true,
            literal: operator,
        }
    }

    private readKeyword(): Ast.IdentifierExpression {
        const tokenRange = this.singleTokenRange(TokenKind.Identifier);
        const literal = this.readToken();
        const identifier: Ast.Identifier = {
            kind: Ast.NodeKind.Identifier,
            tokenRange,
            terminalNode: true,
            literal,
        }

        return {
            kind: Ast.NodeKind.IdentifierExpression,
            tokenRange,
            terminalNode: false,
            maybeInclusiveConstant: undefined,
            identifier,
        }
    }

    private fieldSpecificationListReadError(allowOpenMarker: boolean): Option<Error> {
        if (allowOpenMarker) {
            const expectedTokenKinds = [
                TokenKind.Identifier,
                TokenKind.Ellipsis,
            ];
            return this.expectAnyTokenKind(expectedTokenKinds)
        }
        else {
            return this.expectTokenKind(TokenKind.Identifier);
        }
    }

    private expectNoMoreTokens(): Option<ParserError.UnusedTokensRemainError> {
        if (this.tokenIndex !== this.lexerSnapshot.tokens.length) {
            const token = this.expectTokenAt(this.tokenIndex);
            return new ParserError.UnusedTokensRemainError(token);
        }
        else {
            return undefined;
        }
    }

    private expectTokenKind(expectedTokenKind: TokenKind): Option<ParserError.ExpectedTokenKindError> {
        if (expectedTokenKind !== this.currentTokenKind) {
            return new ParserError.ExpectedTokenKindError(expectedTokenKind, this.currentToken);
        }
        else {
            return undefined;
        }
    }

    private expectAnyTokenKind(
        expectedAnyTokenKind: ReadonlyArray<TokenKind>
    ): Option<ParserError.ExpectedAnyTokenKindError> {
        const isError = (
            this.currentTokenKind === undefined
            || expectedAnyTokenKind.indexOf(this.currentTokenKind) === -1
        )

        if (isError) {
            return new ParserError.ExpectedAnyTokenKindError(expectedAnyTokenKind, this.currentToken);
        }
        else {
            return undefined;
        }
    }

    private readBinOpKeywordExpression<NodeKindVariant, L, KeywordTokenKindVariant, R>(
        nodeKind: NodeKindVariant & Ast.TBinOpKeywordNodeKind,
        leftExpressionReader: () => L,
        keywordTokenKind: KeywordTokenKindVariant & TokenKind,
        rightExpressionReader: () => R,
    ): L | Ast.IBinOpKeyword<NodeKindVariant, L, R> {
        this.startTokenRange(nodeKind);
        const left = leftExpressionReader()
        const maybeConstant = this.maybeReadTokenKindAsConstant(keywordTokenKind);

        if (maybeConstant) {
            const right = rightExpressionReader();
            return {
                kind: nodeKind,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                left,
                constant: maybeConstant,
                right,
            }
        }
        else {
            this.popTokenRangeNoop();
            return left;
        }
    }

    private readBinOpExpression<NodeKindVariant, Operator, Operand>(
        nodeKind: NodeKindVariant & Ast.TBinOpExpressionNodeKind,
        operatorFrom: (tokenKind: Option<TokenKind>) => Option<(Operator & Ast.TUnaryExpressionHelperOperator)>,
        operandReader: () => Operand,
    ): Operand | Ast.IBinOpExpression<NodeKindVariant, Operator, Operand> {
        this.startTokenRange(nodeKind);
        const first = operandReader();

        let maybeOperator = operatorFrom(this.currentTokenKind);
        if (maybeOperator) {
            const rest: Ast.UnaryExpressionHelper<Operator, Operand>[] = [];

            while (maybeOperator) {
                this.startTokenRange(Ast.NodeKind.UnaryExpressionHelper);
                const operatorConstant = this.readUnaryOperatorAsConstant(maybeOperator);
                rest.push({
                    kind: Ast.NodeKind.UnaryExpressionHelper,
                    tokenRange: this.popTokenRange(),
                    terminalNode: false,
                    inBinaryExpression: true,
                    operator: maybeOperator,
                    operatorConstant,
                    node: operandReader(),
                });
                maybeOperator = operatorFrom(this.currentTokenKind);
            }

            return {
                kind: nodeKind,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                first,
                rest,
            };
        }
        else {
            this.popTokenRangeNoop();
            return first;
        }
    }

    private readPairedConstant<NodeKindVariant, Paired>(
        nodeKind: NodeKindVariant & Ast.TPairedConstantNodeKind,
        constantReader: () => Ast.Constant,
        pairedReader: () => Paired,
    ): Ast.IPairedConstant<NodeKindVariant, Paired> {
        this.startTokenRange(nodeKind);
        const constant = constantReader();
        const paired = pairedReader();
        return {
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            constant,
            paired,
        }
    }

    private maybeReadPairedConstant<NodeKindVariant, Paired>(
        nodeKind: NodeKindVariant & Ast.TPairedConstantNodeKind,
        condition: () => boolean,
        constantReader: () => Ast.Constant,
        pairedReader: () => Paired,
    ): Option<Ast.IPairedConstant<NodeKindVariant, Paired>> {
        if (condition()) {
            return this.readPairedConstant<NodeKindVariant, Paired>(
                nodeKind,
                constantReader,
                pairedReader,
            );
        }
        else {
            return undefined;
        }
    }

    private readWrapped<NodeKindVariant, Content>(
        nodeKind: NodeKindVariant & Ast.TWrappedNodeKind,
        openConstantReader: () => Ast.Constant,
        contentReader: () => Content,
        closeConstantReader: () => Ast.Constant,
    ): Ast.IWrapped<NodeKindVariant, Content> {
        this.startTokenRange(nodeKind);

        const openWrapperConstant = openConstantReader();
        const content = contentReader();
        const closeWrapperConstant = closeConstantReader();

        return {
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            openWrapperConstant,
            content,
            closeWrapperConstant,
        }
    }

    private readKeyValuePair<NodeKindVariant, Key, Value>(
        nodeKind: NodeKindVariant & Ast.TKeyValuePairNodeKind,
        keyReader: () => Key,
        valueReader: () => Value,
    ): Ast.IKeyValuePair<NodeKindVariant, Key, Value> {
        this.startTokenRange(nodeKind);
        const key = keyReader();
        const equalConstant = this.readTokenKindAsConstant(TokenKind.Equal);
        const value = valueReader();

        return {
            kind: nodeKind,
            tokenRange: this.popTokenRange(),
            terminalNode: false,
            key,
            equalConstant,
            value,
        }
    }

    private readCsv<T>(
        valueReader: () => T,
        continueReadingValues: boolean,
    ): ReadonlyArray<Ast.ICsv<T>> {
        const values: Ast.ICsv<T>[] = [];

        while (continueReadingValues) {
            this.startTokenRange(Ast.NodeKind.Csv);

            const node = valueReader();
            const maybeCommaConstant = this.maybeReadTokenKindAsConstant(TokenKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            values.push({
                kind: Ast.NodeKind.Csv,
                tokenRange: this.popTokenRange(),
                terminalNode: false,
                node,
                maybeCommaConstant,
            })
        }

        return values;
    }

    private disambiguateParenthesis(): ParenthesisDisambiguation {
        const initialTokenIndex = this.tokenIndex;
        const tokens = this.lexerSnapshot.tokens;
        const totalTokens = tokens.length;
        let nestedDepth = 1;
        let offsetTokenIndex = initialTokenIndex + 1;

        while (offsetTokenIndex < totalTokens) {
            const offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === TokenKind.LeftParenthesis) {
                nestedDepth += 1;
            }
            else if (offsetTokenKind === TokenKind.RightParenthesis) {
                nestedDepth -= 1;
            }

            if (nestedDepth === 0) {
                // (as X) could either be either case,
                // so we need to consume type X and see if it's followed by a FatArrow.
                //
                // It's important we backup and eventually restore the original Parser state.
                if (this.isTokenKind(TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                    const parserStateBackup = this.backup();
                    this.unsafeMoveTo(offsetTokenIndex + 2);

                    try {
                        this.readNullablePrimitiveType();
                    }
                    catch {
                        this.restore(parserStateBackup);
                        if (this.isOnTokenKind(TokenKind.FatArrow)) {
                            return ParenthesisDisambiguation.FunctionExpression;
                        }
                        else {
                            return ParenthesisDisambiguation.ParenthesizedExpression;
                        }
                    }

                    let result;
                    if (this.isOnTokenKind(TokenKind.FatArrow)) {
                        result = ParenthesisDisambiguation.FunctionExpression;
                    }
                    else {
                        result = ParenthesisDisambiguation.ParenthesizedExpression;
                    }

                    this.restore(parserStateBackup);
                    return result;
                }
                else {
                    if (this.isTokenKind(TokenKind.FatArrow, offsetTokenIndex + 1)) {
                        return ParenthesisDisambiguation.FunctionExpression;
                    }
                    else {
                        return ParenthesisDisambiguation.ParenthesizedExpression;
                    }
                }
            }

            offsetTokenIndex += 1;
        }

        throw this.unterminatedParenthesesError(initialTokenIndex);
    }

    private unterminatedParenthesesError(openTokenIndex: number): ParserError.UnterminatedParenthesesError {
        const token = this.expectTokenAt(openTokenIndex);
        return new ParserError.UnterminatedParenthesesError(token);
    }

    private disambiguateBracket(): BracketDisambiguation {
        const tokens = this.lexerSnapshot.tokens;
        let offsetTokenIndex = this.tokenIndex + 1;
        let offsetToken = tokens[offsetTokenIndex];

        if (!offsetToken) {
            throw this.unterminatedBracketError(this.tokenIndex);
        }

        let offsetTokenKind = offsetToken.kind;
        if (offsetTokenKind === TokenKind.LeftBracket) {
            return BracketDisambiguation.FieldProjection;
        }

        else if (offsetTokenKind === TokenKind.RightBracket) {
            return BracketDisambiguation.Record;
        }

        else {
            const totalTokens = tokens.length;
            offsetTokenIndex += 1;
            while (offsetTokenIndex < totalTokens) {
                offsetTokenKind = tokens[offsetTokenIndex].kind;

                if (offsetTokenKind === TokenKind.Equal) {
                    return BracketDisambiguation.Record;
                }
                else if (offsetTokenKind === TokenKind.RightBracket) {
                    return BracketDisambiguation.FieldSelection;
                }

                offsetTokenIndex += 1;
            }

            throw this.unterminatedBracketError(this.tokenIndex);
        }
    }

    private unterminatedBracketError(openTokenIndex: number): ParserError.UnterminatedBracketError {
        const token = this.expectTokenAt(openTokenIndex);
        return new ParserError.UnterminatedBracketError(token);
    }

    private startTokenRange(nodeKind: Ast.NodeKind) {
        return this.startTokenRangeAt(nodeKind, this.tokenIndex);
    }

    private startTokenRangeAt(nodeKind: Ast.NodeKind, tokenIndex: number) {
        if (tokenIndex >= this.lexerSnapshot.tokens.length) {
            const topOfTokenRangeStack = this.tokenRangeStack[this.tokenRangeStack.length - 1].nodeKind;
            throw new ParserError.UnexpectedEndOfTokensError(topOfTokenRangeStack);
        }

        const currentToken = this.lexerSnapshot.tokens[tokenIndex];
        this.tokenRangeStack.push({
            nodeKind,
            tokenIndexStart: tokenIndex,
            positionStart: currentToken.positionStart,
        });
    }

    // faster version of popTokenRange, returns no value
    private popTokenRangeNoop() {
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
        const positionStart = element.positionStart;
        const endTokenIndex = this.tokenIndex;
        const lastInclusiveToken = this.lexerSnapshot.tokens[endTokenIndex - 1];

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
        const tokenIndex = this.tokenIndex;
        const token = this.lexerSnapshot.tokens[tokenIndex];
        const positionStart = token.positionStart;
        const positionEnd = token.positionEnd;

        return {
            startTokenIndex: tokenIndex,
            endTokenIndex: tokenIndex + 1,
            positionStart,
            positionEnd,
            hash: tokenRangeHashFrom(tag, positionStart, positionEnd),
        }
    }

    private isNextTokenKind(tokenKind: TokenKind): boolean {
        return this.isTokenKind(tokenKind, this.tokenIndex + 1);
    }

    private isOnTokenKind(tokenKind: TokenKind, tokenIndex = this.tokenIndex): boolean {
        return this.isTokenKind(tokenKind, tokenIndex);
    }

    private isTokenKind(tokenKind: TokenKind, tokenIndex: number): boolean {
        const maybeToken: Option<Token> = this.lexerSnapshot.tokens[tokenIndex];

        if (maybeToken) {
            return maybeToken.kind === tokenKind;
        }
        else {
            return false;
        }
    }

    private isOnIdentifierConstant(identifierConstant: Ast.IdentifierConstant): boolean {
        if (this.isOnTokenKind(TokenKind.Identifier)) {
            const currentToken = this.lexerSnapshot.tokens[this.tokenIndex];
            if (currentToken === undefined || currentToken.data === undefined) {
                const details = { currentToken }
                throw new CommonError.InvariantError(`expected data on Token`, details);
            }

            const data = currentToken.data;
            return data === identifierConstant;
        }
        else {
            return false;
        }
    }

    private expectTokenAt(tokenIndex: number): Token {
        const lexerSnapshot = this.lexerSnapshot;
        const maybeToken = lexerSnapshot.tokens[tokenIndex];

        if (maybeToken) {
            return maybeToken;
        }
        else {
            throw new CommonError.InvariantError(`this.tokens[${tokenIndex}] is falsey`)
        }
    }

    // WARNING: Only updates tokenIndex and currentTokenKind,
    //          Manual management of TokenRangeStack is assumed.
    //          Best used in conjunction with backup/restore using ParserState.
    private unsafeMoveTo(tokenIndex: number) {
        const tokens = this.lexerSnapshot.tokens;
        this.tokenIndex = tokenIndex;

        if (tokenIndex < tokens.length) {
            this.currentToken = tokens[tokenIndex];
            this.currentTokenKind = this.currentToken.kind;
        }
        else {
            this.currentToken = undefined;
            this.currentTokenKind = undefined;
        }
    }

    private backup(): ParserState {
        return {
            tokenIndex: this.tokenIndex,
            tokenRangeStackLength: this.tokenRangeStack.length,
        };
    }

    private restore(state: ParserState) {
        this.tokenRangeStack.length = state.tokenRangeStackLength;
        this.tokenIndex = state.tokenIndex;
        this.currentToken = this.lexerSnapshot.tokens[this.tokenIndex]
        this.currentTokenKind = this.currentToken !== undefined
            ? this.currentToken.kind
            : undefined;
    }
}

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
    readonly nodeKind: Ast.NodeKind,
    readonly tokenIndexStart: number,
    readonly positionStart: StringHelpers.GraphemePosition,
}

interface ParserState {
    readonly tokenRangeStackLength: number,
    readonly tokenIndex: number,
}
