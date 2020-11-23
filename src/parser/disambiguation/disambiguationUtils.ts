// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { ArrayUtils, Assert, Result, ResultUtils, TypeScriptUtils } from "../../common";
import { Ast, Token } from "../../language";
import { IParser, IParseStateCheckpoint } from "../IParser";
import { IParseState, IParseStateUtils } from "../IParseState";
import {
    AmbiguousParse,
    BracketDisambiguation,
    DismabiguationBehavior,
    ParenthesisDisambiguation,
    TAmbiguousBracketNode,
    TAmbiguousParenthesisNode,
} from "./disambiguation";

// For each given parse function it'll create a deep copy of the state then parse with the function.
// Mutates the given state to whatever parse state which matched the most amount of tokens.
// Ties are resolved in the order of the given parse functions.
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
        let variantResult: Result<T, ParseError.ParseError<S>>;

        try {
            maybeNode = parseFn(variantState, parser);
            variantResult = ResultUtils.okFactory(maybeNode);
        } catch (err) {
            if (!ParseError.isTInnerParseError(err)) {
                throw err;
            }
            variantResult = ResultUtils.errFactory(new ParseError.ParseError<S>(err, variantState));
        }

        const candiate: AmbiguousParse<T, S> = {
            parseState: variantState,
            result: variantResult,
        };

        maybeBestMatch = bestAmbiguousParseMatch<T, S>(maybeBestMatch, candiate);
    }

    Assert.isDefined(maybeBestMatch);
    return maybeBestMatch;
}

// Peeks at the token stream and either performs an explicit read or an ambiguous read.
export function readAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): TAmbiguousBracketNode {
    // We might be able to peek at tokens to disambiguate what bracketed expression is next.
    const maybeDisambiguation: BracketDisambiguation | undefined = maybeDisambiguateBracket(state);

    // Peeking gave us a concrete answer as to what's next.
    if (maybeDisambiguation !== undefined) {
        const disambiguation: BracketDisambiguation = maybeDisambiguation;
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
    // Else we branch on `IParseState.disambiguousBehavior`.
    else {
        switch (state.disambiguationBehavior) {
            case DismabiguationBehavior.Strict:
                throw IParseStateUtils.unterminatedBracketError(state);

            case DismabiguationBehavior.Thorough:
                return thoroughReadAmbiguousBracket(state, parser, allowedVariants);

            default:
                throw Assert.isNever(state.disambiguationBehavior);
        }
    }
}

// Peeks at the token stream and either performs an explicit read or an ambiguous read.
export function readAmbiguousParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FunctionExpression | Ast.TExpression {
    // We might be able to peek at tokens to disambiguate what bracketed expression is next.
    const maybeDisambiguation: ParenthesisDisambiguation | undefined = maybeDisambiguateParenthesis(state, parser);

    // Peeking gave us a concrete answer as to what's next.
    if (maybeDisambiguation !== undefined) {
        const disambiguation: ParenthesisDisambiguation = maybeDisambiguation;

        switch (disambiguation) {
            case ParenthesisDisambiguation.FunctionExpression:
                return parser.readFunctionExpression(state, parser);

            case ParenthesisDisambiguation.ParenthesizedExpression:
                return parser.readParenthesizedExpression(state, parser);

            default:
                throw Assert.isNever(disambiguation);
        }
    }
    // Else we branch on `IParseState.disambiguousBehavior`.
    else {
        switch (state.disambiguationBehavior) {
            case DismabiguationBehavior.Strict:
                throw IParseStateUtils.unterminatedParenthesesError(state);

            case DismabiguationBehavior.Thorough:
                return thoroughReadAmbiguousParenthesis(state, parser);

            default:
                throw Assert.isNever(state.disambiguationBehavior);
        }
    }
}

// Peeks at tokens which might give a concrete disambiguation.
export function maybeDisambiguateParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): ParenthesisDisambiguation | undefined {
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
                        return ParenthesisDisambiguation.FunctionExpression;
                    } else {
                        return ParenthesisDisambiguation.ParenthesizedExpression;
                    }
                }

                let disambiguation: ParenthesisDisambiguation;
                if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                    disambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                parser.restoreCheckpoint(state, checkpoint);
                return disambiguation;
            } else {
                if (IParseStateUtils.isTokenKind(state, Token.TokenKind.FatArrow, offsetTokenIndex + 1)) {
                    return ParenthesisDisambiguation.FunctionExpression;
                } else {
                    return ParenthesisDisambiguation.ParenthesizedExpression;
                }
            }
        }

        offsetTokenIndex += 1;
    }

    return undefined;
}

export function maybeDisambiguateBracket<S extends IParseState = IParseState>(
    state: S,
): BracketDisambiguation | undefined {
    let offsetTokenIndex: number = state.tokenIndex + 1;

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    const maybeOffsetToken: Token.Token | undefined = tokens[offsetTokenIndex];

    if (maybeOffsetToken === undefined) {
        return undefined;
    }
    const offsetToken: Token.Token = maybeOffsetToken;

    let offsetTokenKind: Token.TokenKind = offsetToken.kind;
    if (offsetTokenKind === Token.TokenKind.LeftBracket) {
        return BracketDisambiguation.FieldProjection;
    } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
        return BracketDisambiguation.RecordExpression;
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;
        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === Token.TokenKind.Equal) {
                return BracketDisambiguation.RecordExpression;
            } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
                return BracketDisambiguation.FieldSelection;
            }

            offsetTokenIndex += 1;
        }

        return undefined;
    }
}

// Copy the current state and attempt to read for each of the following:
//  FieldProjection, FieldSelection, and RecordExpression.
// Mutates the given state with the read attempt which matched the most tokens.
function thoroughReadAmbiguousBracket<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): TAmbiguousBracketNode {
    return thoroughReadAmbiguous(state, parser, bracketDisambiguationParseFunctions(parser, allowedVariants));
}

// Copy the current state and attempt to read for each of the following:
//  FunctionExpression, ParenthesisExpression.
// Mutates the given state with the read attempt which matched the most tokens.
function thoroughReadAmbiguousParenthesis<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): TAmbiguousParenthesisNode {
    return thoroughReadAmbiguous<TAmbiguousParenthesisNode, S>(state, parser, [
        parser.readFunctionExpression,
        parser.readParenthesizedExpression,
    ]);
}

function thoroughReadAmbiguous<T extends TAmbiguousBracketNode | TAmbiguousParenthesisNode, S extends IParseState>(
    state: S,
    parser: IParser<S>,
    parseFns: ReadonlyArray<(state: S, parser: IParser<S>) => T>,
): T {
    const ambiguousParse: AmbiguousParse<T, S> = readAmbiguous(state, parser, parseFns);

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

// Converts BracketDisambiguation into its corrosponding read function.
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
//          Manual cleanup of other state fields such as TokenRangeStack is assumed by the caller.
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

function bestAmbiguousParseMatch<T extends Ast.TNode, S extends IParseState = IParseState>(
    maybeBest: AmbiguousParse<T, S> | undefined,
    candidate: AmbiguousParse<T, S>,
): AmbiguousParse<T, S> {
    if (maybeBest === undefined || maybeBest.parseState.tokenIndex < candidate.parseState.tokenIndex) {
        return candidate;
    } else if (
        maybeBest.parseState.tokenIndex === candidate.parseState.tokenIndex &&
        ResultUtils.isErr(maybeBest.result) &&
        ResultUtils.isOk(candidate.result)
    ) {
        return candidate;
    } else {
        return maybeBest;
    }
}
