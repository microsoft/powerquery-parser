// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { ArrayUtils, Assert, CommonError, Result, ResultUtils, TypeScriptUtils } from "../../common";
import { Ast, Token } from "../../language";
import { IParser, IParseStateCheckpoint } from "../IParser";
import { IParseState, IParseStateUtils } from "../IParseState";
import {
    AmbiguousParse,
    BracketDisambiguation,
    DismabiguationBehavior,
    ParenthesisDisambiguation,
    TAmbiguousBracketNode,
} from "./disambiguation";

export function tryDisambiguateParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Result<ParenthesisDisambiguation, ParseError.UnterminatedSequence> {
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
                    parser.restoreCheckpoint(state, checkpoint);
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

                parser.restoreCheckpoint(state, checkpoint);
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

export function tryDisambiguateBracket<S extends IParseState = IParseState>(
    state: S,
): Result<BracketDisambiguation, ParseError.UnterminatedSequence> {
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

export function readAmbiguous<T extends Ast.TNode, S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    parseFns: ReadonlyArray<(state: S, parser: IParser<S>) => T>,
): AmbiguousParse<T, S> {
    ArrayUtils.assertNonZeroLength(parseFns, "requires at least one parse function");

    let maybeBestMatch: AmbiguousParse<T, S> | undefined = undefined;

    for (const parseFn of parseFns) {
        const variantState: S = parser.copyState(state);

        let maybeNode: T | undefined;
        let maybeError: ParseError.ParseError<S> | undefined;

        try {
            maybeNode = parseFn(variantState, parser);
            IParseStateUtils.assertNoMoreTokens(variantState);
        } catch (err) {
            if (!ParseError.isTInnerParseError(err)) {
                throw err;
            }
            maybeError = new ParseError.ParseError(err, variantState);
        }

        let variantResult: Result<T, ParseError.ParseError<S>>;
        if (maybeBestMatch === undefined || variantState.tokenIndex > maybeBestMatch.parseState.tokenIndex) {
            if (maybeNode !== undefined) {
                variantResult = ResultUtils.okFactory(maybeNode);
            } else if (maybeError !== undefined) {
                variantResult = ResultUtils.errFactory(maybeError);
            } else {
                throw new CommonError.InvariantError(`either maybeNode or maybeError should be truthy`);
            }

            maybeBestMatch = {
                parseState: variantState,
                result: variantResult,
            };
        }
        // They parsed the same amount of tokens and this iteration is an Ok where the previous was an Err.
        else if (
            variantState.tokenIndex === maybeBestMatch.parseState.tokenIndex &&
            maybeNode !== undefined &&
            ResultUtils.isErr(maybeBestMatch.result)
        ) {
            maybeBestMatch = {
                parseState: variantState,
                result: ResultUtils.okFactory(maybeNode),
            };
        }
    }

    Assert.isDefined(maybeBestMatch);
    return maybeBestMatch;
}

export function readAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): TAmbiguousBracketNode {
    switch (state.disambiguationBehavior) {
        case DismabiguationBehavior.Strict:
            return strictReadAmbiguousBracket(state, parser, allowedVariants);

        case DismabiguationBehavior.Thorough:
            return thoroughReadAmbiguousBracket(state, parser, allowedVariants);

        default:
            throw Assert.isNever(state.disambiguationBehavior);
    }
}

export function readAmbiguousParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FunctionExpression | Ast.TExpression {
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

function strictReadAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): TAmbiguousBracketNode {
    const triedDisambiguation: Result<BracketDisambiguation, ParseError.UnterminatedSequence> = tryDisambiguateBracket(
        state,
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

function thoroughReadAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): TAmbiguousBracketNode {
    const ambiguousParse: AmbiguousParse<TAmbiguousBracketNode, S> = readAmbiguous(
        state,
        parser,
        bracketDisambiguationParseFunctions(parser, allowedVariants),
    );
    parser.applyState(state, ambiguousParse.parseState);
    if (ResultUtils.isOk(ambiguousParse.result)) {
        return ambiguousParse.result.value;
    } else {
        // ParseError.state references the cloned state generated in readAmbiguous, not the current state parameter.
        // For correctness sake we need to update the existing state with the AmbiguousParse error,
        // then update the reference.
        const mutableParseError: TypeScriptUtils.StripReadonly<ParseError.ParseError<S>> = ambiguousParse.result.error;
        mutableParseError.state = state;
        throw ambiguousParse.result.error;
    }
}

function bracketDisambiguationParseFunctions<S extends IParseState = IParseState>(
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): ReadonlyArray<(state: S, parser: IParser<S>) => TAmbiguousBracketNode> {
    return allowedVariants.map((bracketDisambiguation: BracketDisambiguation) => {
        switch (bracketDisambiguation) {
            case BracketDisambiguation.FieldProjection:
                return parser.readFieldProjection;

            case BracketDisambiguation.FieldSelection:
                return parser.readFieldSelection;

            case BracketDisambiguation.RecordExpression:
                return parser.readRecordExpression;

            default:
                throw Assert.isNever(bracketDisambiguation);
        }
    });
}

// WARNING: Only updates tokenIndex and currentTokenKind,
//          Manual management of TokenRangeStack is assumed by way of IParseStateCheckpoint.
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
