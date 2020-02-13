import { Ast, ParseError } from "..";
import { CommonError, isNever, Result, ResultUtils } from "../../common";
import { Token, TokenKind } from "../../lexer";
import { BracketDisambiguation, IParser } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";

export function readToken(state: IParserState): string {
    const tokens: ReadonlyArray<Token> = state.lexerSnapshot.tokens;

    if (state.tokenIndex >= tokens.length) {
        const details: {} = {
            tokenIndex: state.tokenIndex,
            "tokens.length": tokens.length,
        };
        throw new CommonError.InvariantError("index beyond tokens.length", details);
    }

    const data: string = tokens[state.tokenIndex].data;
    state.tokenIndex += 1;

    if (state.tokenIndex === tokens.length) {
        state.maybeCurrentTokenKind = undefined;
    } else {
        state.maybeCurrentToken = tokens[state.tokenIndex];
        state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
    }

    return data;
}

export function readTokenKindAsConstant<T>(
    state: IParserState,
    tokenKind: TokenKind,
    constantKind: T & Ast.TConstantKind,
): Ast.TConstant & Ast.Constant<T & Ast.TConstantKind> {
    IParserStateUtils.startContext(state, Ast.NodeKind.Constant);

    const maybeErr: ParseError.ExpectedTokenKindError | undefined = IParserStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const tokenData: string = readToken(state);
    if (tokenData !== constantKind) {
        const details: {} = {
            tokenData,
            constantKind,
        };
        throw new CommonError.InvariantError("expected tokenData to be equal to constantKind", details);
    }

    const astNode: Ast.TConstant & Ast.Constant<T & Ast.TConstantKind> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: Ast.NodeKind.Constant,
        isLeaf: true,
        constantKind,
    };
    IParserStateUtils.endContext(state, astNode);

    return astNode;
}

export function maybeReadTokenKindAsConstant<T>(
    state: IParserState,
    tokenKind: TokenKind,
    constantKind: T & Ast.TConstantKind,
): Ast.TConstant & Ast.Constant<T & Ast.TConstantKind> | undefined {
    if (IParserStateUtils.isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParserStateUtils.startContext(state, nodeKind);

        const tokenData: string = readToken(state);
        if (tokenData !== constantKind) {
            const details: {} = {
                tokenData,
                constantKind,
            };
            throw new CommonError.InvariantError("expected tokenData to be equal to constantKind", details);
        }

        const astNode: Ast.TConstant & Ast.Constant<T & Ast.TConstantKind> = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            constantKind,
        };
        IParserStateUtils.endContext(state, astNode);

        return astNode;
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

export function readBracketDisambiguation(
    state: IParserState,
    parser: IParser<IParserState>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression {
    const triedDisambiguation: Result<
        BracketDisambiguation,
        ParseError.UnterminatedBracketError
    > = parser.disambiguateBracket(state, parser);
    if (ResultUtils.isErr(triedDisambiguation)) {
        throw triedDisambiguation.error;
    }
    const disambiguation: BracketDisambiguation = triedDisambiguation.value;
    if (allowedVariants.indexOf(disambiguation) === -1) {
        throw new CommonError.InvariantError(
            `grammer doesn't allow remaining BracketDisambiguation: ${disambiguation}`,
        );
    }

    switch (disambiguation) {
        case BracketDisambiguation.FieldProjection:
            return parser.readFieldProjection(state, parser);

        case BracketDisambiguation.FieldSelection:
            return parser.readFieldSelection(state, parser);

        case BracketDisambiguation.Record:
            return parser.readRecordExpression(state, parser);

        default:
            throw isNever(disambiguation);
    }
}
