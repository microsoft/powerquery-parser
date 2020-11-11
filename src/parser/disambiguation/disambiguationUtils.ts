// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { ArrayUtils, Assert, Result, ResultUtils } from "../../common";
import { Ast, Token } from "../../language";
import { IParser, IParseStateCheckpoint } from "../IParser";
import { IParseState, IParseStateUtils } from "../IParseState";
import { BracketDisambiguation, DismabiguationBehavior, ParenthesisDisambiguation } from "./disambiguation";

export function readAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression {
    switch (state.disambiguationBehavior) {
        case DismabiguationBehavior.Strict:
            return readStrictAmbiguousBracket(state, parser, allowedVariants);

        case DismabiguationBehavior.Thorough:
            throw readThoroughAmbiguousBracket(state, parser, allowedVariants);

        default:
            throw Assert.isNever(state.disambiguationBehavior);
    }
}

export function readAmbiguousParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FunctionExpression | Ast.TExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedDisambiguation: Result<
        ParenthesisDisambiguation,
        ParseError.UnterminatedSequence
    > = tryDisambiguateParenthesis(state, parser);
    if (ResultUtils.isErr(triedDisambiguation)) {
        throw triedDisambiguation.error;
    }
    const disambiguation: ParenthesisDisambiguation = triedDisambiguation.value;

    switch (disambiguation) {
        case ParenthesisDisambiguation.FunctionExpression:
            return parser.readFunctionExpression(state, parser);

        case ParenthesisDisambiguation.ParenthesizedExpression:
            return parser.readNullCoalescingExpression(state, parser);

        default:
            throw Assert.isNever(disambiguation);
    }
}

function readStrictAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedDisambiguation: Result<BracketDisambiguation, ParseError.UnterminatedSequence> = tryDisambiguateBracket(
        state,
        parser,
    );
    if (ResultUtils.isErr(triedDisambiguation)) {
        throw triedDisambiguation.error;
    }
    const disambiguation: BracketDisambiguation = triedDisambiguation.value;
    ArrayUtils.assertIn(allowedVariants, disambiguation, `invalid disambiguation`);

    switch (disambiguation) {
        case BracketDisambiguation.FieldProjection:
            return parser.readFieldProjection(state, parser);

        case BracketDisambiguation.FieldSelection:
            return parser.readFieldSelection(state, parser);

        case BracketDisambiguation.RecordExpression:
            return parser.readRecordExpression(state, parser);

        default:
            throw Assert.isNever(disambiguation);
    }
}

export function tryDisambiguateParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Result<ParenthesisDisambiguation, ParseError.UnterminatedSequence> {
    state.maybeCancellationToken?.throwIfCancelled();

    const initialTokenIndex: number = state.tokenIndex;
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    const totalTokens: number = tokens.length;
    let nestedDepth: number = 1;
    let offsetTokenIndex: number = initialTokenIndex + 1;

    while (offsetTokenIndex < totalTokens) {
        const offsetTokenKind: Token.TokenKind = tokens[offsetTokenIndex].kind;

        if (offsetTokenKind === Token.TokenKind.LeftParenthesis) {
            nestedDepth += 1;
        } else if (offsetTokenKind === Token.TokenKind.RightParenthesis) {
            nestedDepth -= 1;
        }

        if (nestedDepth === 0) {
            // '(x as number) as number' could either be either case,
            // so we need to consume test if the trailing 'as number' is followed by a FatArrow.
            if (IParseStateUtils.isTokenKind(state, Token.TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                const checkpoint: IParseStateCheckpoint = parser.checkpointFactory(state);
                unsafeMoveTo(state, offsetTokenIndex + 2);

                try {
                    parser.readNullablePrimitiveType(state, parser);
                } catch {
                    parser.loadCheckpoint(state, checkpoint);
                    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                    } else {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                    }
                }

                let disambiguation: ParenthesisDisambiguation;
                if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                    disambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                parser.loadCheckpoint(state, checkpoint);
                return ResultUtils.okFactory(disambiguation);
            } else {
                if (IParseStateUtils.isTokenKind(state, Token.TokenKind.FatArrow, offsetTokenIndex + 1)) {
                    return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                } else {
                    return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                }
            }
        }

        offsetTokenIndex += 1;
    }

    return ResultUtils.errFactory(IParseStateUtils.unterminatedParenthesesError(state));
}

// WARNING: Only updates tokenIndex and currentTokenKind,
//          Manual management of TokenRangeStack is assumed.
//          Best used in conjunction with backup/restore using ParseState.
function unsafeMoveTo(state: IParseState, tokenIndex: number): void {
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    state.tokenIndex = tokenIndex;

    if (tokenIndex < tokens.length) {
        state.maybeCurrentToken = tokens[tokenIndex];
        state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
    } else {
        state.maybeCurrentToken = undefined;
        state.maybeCurrentTokenKind = undefined;
    }
}

export function tryDisambiguateBracket<S extends IParseState = IParseState>(
    state: S,
    _parser: IParser<S>,
): Result<BracketDisambiguation, ParseError.UnterminatedSequence> {
    state.maybeCancellationToken?.throwIfCancelled();

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    let offsetTokenIndex: number = state.tokenIndex + 1;
    const offsetToken: Token.Token = tokens[offsetTokenIndex];

    if (!offsetToken) {
        return ResultUtils.errFactory(IParseStateUtils.unterminatedBracketError(state));
    }

    let offsetTokenKind: Token.TokenKind = offsetToken.kind;
    if (offsetTokenKind === Token.TokenKind.LeftBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.FieldProjection);
    } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.RecordExpression);
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;
        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === Token.TokenKind.Equal) {
                return ResultUtils.okFactory(BracketDisambiguation.RecordExpression);
            } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
                return ResultUtils.okFactory(BracketDisambiguation.FieldSelection);
            }

            offsetTokenIndex += 1;
        }

        return ResultUtils.errFactory(IParseStateUtils.unterminatedBracketError(state));
    }
}

function readThoroughAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression {
    const startingCheckpoint = parser.checkpointFactory(state);

    const parses: S[] = [state];

    for (const variant of allowedVariants) {
        const variantState = 1 as any;
        // const variantState: S = parser.stateFactory(state.lexerSnapshot, {
        //     maybeCancellationToken: state.maybeCancellationToken,
        //     tokenIndex: state.tokenIndex,
        // });

        try {
            switch (variant) {
                case BracketDisambiguation.FieldProjection:
                    parser.readFieldProjection(variantState, parser);
                    break;

                case BracketDisambiguation.FieldSelection:
                    parser.readFieldProjection(variantState, parser);
                    break;

                case BracketDisambiguation.RecordExpression:
                    parser.readRecordExpression(variantState, parser);
                    break;

                default:
                    throw Assert.isNever(variant);
            }
        } catch (err) {}
    }

    throw new Error();
}
