import { Ast, ParseError } from "..";
import { CommonError, isNever, Option, Result, ResultUtils } from "../../common";
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

export function readTokenKindAsConstant(state: IParserState, tokenKind: TokenKind): Ast.Constant {
    const maybeConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, tokenKind);
    if (maybeConstant === undefined) {
        const maybeErr: Option<ParseError.ExpectedTokenKindError> = IParserStateUtils.testIsOnTokenKind(
            state,
            tokenKind,
        );
        if (maybeErr) {
            throw maybeErr;
        } else {
            const details: {} = {
                expectedTokenKind: tokenKind,
                actualTokenKind: state.maybeCurrentTokenKind,
            };

            throw new CommonError.InvariantError(
                `failures from ${maybeReadTokenKindAsConstant.name} should be reportable by ${IParserStateUtils.testIsOnTokenKind.name}`,
                details,
            );
        }
    }

    return maybeConstant;
}

export function maybeReadTokenKindAsConstant(state: IParserState, tokenKind: TokenKind): Option<Ast.Constant> {
    if (IParserStateUtils.isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParserStateUtils.startContext(state, nodeKind);

        const literal: string = readToken(state);
        const astNode: Ast.Constant = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal,
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
