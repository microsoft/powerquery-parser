// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { Result, ResultUtils } from "../../common";
import { Token } from "../../language";
import { BracketDisambiguation, IParser, IParserStateCheckpoint } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";
import { ParenthesisDisambiguation } from "./disambiguation";

export function tryDisambiguateParenthesis<S extends IParserState = IParserState>(
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
            if (IParserStateUtils.isTokenKind(state, Token.TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                const checkpoint: IParserStateCheckpoint = parser.createCheckpoint(state);
                unsafeMoveTo(state, offsetTokenIndex + 2);

                try {
                    parser.readNullablePrimitiveType(state, parser);
                } catch {
                    parser.restoreFromCheckpoint(state, checkpoint);
                    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                    } else {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                    }
                }

                let disambiguation: ParenthesisDisambiguation;
                if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                    disambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                parser.restoreFromCheckpoint(state, checkpoint);
                return ResultUtils.okFactory(disambiguation);
            } else {
                if (IParserStateUtils.isTokenKind(state, Token.TokenKind.FatArrow, offsetTokenIndex + 1)) {
                    return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                } else {
                    return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                }
            }
        }

        offsetTokenIndex += 1;
    }

    return ResultUtils.errFactory(IParserStateUtils.unterminatedParenthesesError(state));
}

// WARNING: Only updates tokenIndex and currentTokenKind,
//          Manual management of TokenRangeStack is assumed.
//          Best used in conjunction with backup/restore using ParserState.
function unsafeMoveTo(state: IParserState, tokenIndex: number): void {
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

export function tryDisambiguateBracket<S extends IParserState = IParserState>(
    state: S,
    _parser: IParser<S>,
): Result<BracketDisambiguation, ParseError.UnterminatedSequence> {
    state.maybeCancellationToken?.throwIfCancelled();

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    let offsetTokenIndex: number = state.tokenIndex + 1;
    const offsetToken: Token.Token = tokens[offsetTokenIndex];

    if (!offsetToken) {
        return ResultUtils.errFactory(IParserStateUtils.unterminatedBracketError(state));
    }

    let offsetTokenKind: Token.TokenKind = offsetToken.kind;
    if (offsetTokenKind === Token.TokenKind.LeftBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.FieldProjection);
    } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.Record);
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;
        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === Token.TokenKind.Equal) {
                return ResultUtils.okFactory(BracketDisambiguation.Record);
            } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
                return ResultUtils.okFactory(BracketDisambiguation.FieldSelection);
            }

            offsetTokenIndex += 1;
        }

        return ResultUtils.errFactory(IParserStateUtils.unterminatedBracketError(state));
    }
}
