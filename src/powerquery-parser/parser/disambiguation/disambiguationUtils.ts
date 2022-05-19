// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AmbiguousParse,
    BracketDisambiguation,
    DismabiguationBehavior,
    ParenthesisDisambiguation,
    TAmbiguousBracketNode,
    TAmbiguousParenthesisNode,
} from "./disambiguation";
import { ArrayUtils, Assert, Result, ResultUtils, TypeScriptUtils } from "../../common";
import { Ast, AstUtils, Constant, Token } from "../../language";
import { Parser, ParseStateCheckpoint } from "../parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { Trace, TraceConstant } from "../../common/trace";
import { NodeIdMapUtils } from "../nodeIdMap";
import { ParseError } from "..";

// For each given parse function it'll create a deep copy of the state then parse with the function.
// Mutates the given state to whatever parse state which matched the most amount of tokens.
// Ties are resolved by the ordering of the given parse functions.
export async function readAmbiguous<T extends Ast.TNode>(
    state: ParseState,
    parser: Parser,
    parseFns: ReadonlyArray<(state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) => Promise<T>>,
    maybeCorrelationId: number | undefined,
): Promise<AmbiguousParse<T>> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguous.name,
        maybeCorrelationId,
        {
            [TraceConstant.Length]: parseFns.length,
        },
    );

    ArrayUtils.assertNonZeroLength(parseFns, "requires at least one parse function");

    let maybeBestMatch: AmbiguousParse<T> | undefined = undefined;

    for (const parseFn of parseFns) {
        // eslint-disable-next-line no-await-in-loop
        const variantState: ParseState = await parser.copyState(state);

        let maybeNode: T | undefined;
        let variantResult: Result<T, ParseError.ParseError>;

        try {
            // eslint-disable-next-line no-await-in-loop
            maybeNode = await parseFn(variantState, parser, trace.id);
            variantResult = ResultUtils.boxOk(maybeNode);
        } catch (error) {
            if (!ParseError.isTInnerParseError(error)) {
                throw error;
            }

            variantResult = ResultUtils.boxError(new ParseError.ParseError(error, variantState));
        }

        const candiate: AmbiguousParse<T> = {
            parseState: variantState,
            result: variantResult,
        };

        maybeBestMatch = bestAmbiguousParseMatch<T>(maybeBestMatch, candiate);
    }

    Assert.isDefined(maybeBestMatch);
    trace.exit();

    return maybeBestMatch;
}

// Peeks at the token stream and either performs an explicit read or an ambiguous read.
export async function readAmbiguousBracket(
    state: ParseState,
    parser: Parser,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
    maybeCorrelationId: number | undefined,
): Promise<TAmbiguousBracketNode> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguousBracket.name,
        maybeCorrelationId,
    );

    // We might be able to peek at tokens to disambiguate what bracketed expression is next.
    const maybeDisambiguation: BracketDisambiguation | undefined = maybeDisambiguateBracket(
        state,
        allowedVariants,
        trace.id,
    );

    // Peeking gave us a concrete answer as to what's next.
    let ambiguousBracket: TAmbiguousBracketNode;

    if (maybeDisambiguation !== undefined) {
        const disambiguation: BracketDisambiguation = maybeDisambiguation;

        switch (disambiguation) {
            case BracketDisambiguation.FieldProjection:
                ambiguousBracket = await parser.readFieldProjection(state, parser, trace.id);
                break;

            case BracketDisambiguation.FieldSelection:
                ambiguousBracket = await parser.readFieldSelection(state, parser, trace.id);
                break;

            case BracketDisambiguation.RecordExpression:
                ambiguousBracket = await parser.readRecordExpression(state, parser, trace.id);
                break;

            default:
                throw Assert.isNever(disambiguation);
        }
    }
    // Else we branch on `IParseState.disambiguousBehavior`.
    else {
        switch (state.disambiguationBehavior) {
            case DismabiguationBehavior.Strict:
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw ParseStateUtils.unterminatedBracketError(state);

            case DismabiguationBehavior.Thorough:
                ambiguousBracket = await thoroughReadAmbiguousBracket(state, parser, allowedVariants, trace.id);
                break;

            default:
                throw Assert.isNever(state.disambiguationBehavior);
        }
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return ambiguousBracket;
}

// Peeks at the token stream and either performs an explicit read or an ambiguous read.
export async function readAmbiguousParenthesis(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<TAmbiguousParenthesisNode> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguousParenthesis.name,
        maybeCorrelationId,
    );

    // We might be able to peek at tokens to disambiguate what parenthesized expression is next.
    const maybeDisambiguation: ParenthesisDisambiguation | undefined = await maybeDisambiguateParenthesis(
        state,
        parser,
        trace.id,
    );

    // Peeking gave us a concrete answer as to what's next.
    let ambiguousParenthesis: TAmbiguousParenthesisNode;

    if (maybeDisambiguation !== undefined) {
        const disambiguation: ParenthesisDisambiguation = maybeDisambiguation;

        switch (disambiguation) {
            case ParenthesisDisambiguation.FunctionExpression:
                ambiguousParenthesis = await parser.readFunctionExpression(state, parser, trace.id);
                break;

            case ParenthesisDisambiguation.ParenthesizedExpression:
                ambiguousParenthesis = await readParenthesizedExpressionOrBinOpExpression(state, parser, trace.id);
                break;

            default:
                throw Assert.isNever(disambiguation);
        }
    }
    // Else we branch on `IParseState.disambiguousBehavior`.
    else {
        switch (state.disambiguationBehavior) {
            case DismabiguationBehavior.Strict:
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw ParseStateUtils.unterminatedParenthesesError(state);

            case DismabiguationBehavior.Thorough:
                ambiguousParenthesis = await thoroughReadAmbiguousParenthesis(state, parser, trace.id);
                break;

            default:
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw Assert.isNever(state.disambiguationBehavior);
        }
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return ambiguousParenthesis;
}

// Peeks at tokens which might give a concrete disambiguation.
export async function maybeDisambiguateParenthesis(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<ParenthesisDisambiguation | undefined> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        maybeDisambiguateParenthesis.name,
        maybeCorrelationId,
    );

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

        let maybeDisambiguation: ParenthesisDisambiguation | undefined = undefined;

        if (nestedDepth === 0) {
            // '(x as number) as number' could either be either case,
            // so we need to consume test if the trailing 'as number' is followed by a FatArrow.
            if (ParseStateUtils.isTokenKind(state, Token.TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                // eslint-disable-next-line no-await-in-loop
                const checkpoint: ParseStateCheckpoint = await parser.createCheckpoint(state);
                unsafeMoveTo(state, offsetTokenIndex + 2);

                try {
                    // eslint-disable-next-line no-await-in-loop
                    await parser.readNullablePrimitiveType(state, parser, trace.id);
                } catch {
                    // eslint-disable-next-line no-await-in-loop
                    await parser.restoreCheckpoint(state, checkpoint);

                    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                        return ParenthesisDisambiguation.FunctionExpression;
                    } else {
                        return ParenthesisDisambiguation.ParenthesizedExpression;
                    }
                }

                if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                    maybeDisambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    maybeDisambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                // eslint-disable-next-line no-await-in-loop
                await parser.restoreCheckpoint(state, checkpoint);
            } else if (ParseStateUtils.isTokenKind(state, Token.TokenKind.FatArrow, offsetTokenIndex + 1)) {
                maybeDisambiguation = ParenthesisDisambiguation.FunctionExpression;
            } else {
                maybeDisambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
            }
        }

        if (maybeDisambiguation) {
            trace.exit({ [TraceConstant.Result]: maybeDisambiguation });

            return maybeDisambiguation;
        }

        offsetTokenIndex += 1;
    }

    trace.exit({ [TraceConstant.Result]: undefined });

    return undefined;
}

export function maybeDisambiguateBracket(
    state: ParseState,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
    maybeCorrelationId: number | undefined,
): BracketDisambiguation | undefined {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        maybeDisambiguateBracket.name,
        maybeCorrelationId,
    );

    let offsetTokenIndex: number = state.tokenIndex + 1;
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    const maybeOffsetToken: Token.Token | undefined = tokens[offsetTokenIndex];

    if (maybeOffsetToken === undefined) {
        return undefined;
    }

    const offsetToken: Token.Token = maybeOffsetToken;

    let offsetTokenKind: Token.TokenKind = offsetToken.kind;
    let result: BracketDisambiguation | undefined;

    if (offsetTokenKind === Token.TokenKind.LeftBracket) {
        result = BracketDisambiguation.FieldProjection;
    } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
        result = BracketDisambiguation.RecordExpression;
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;

        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === Token.TokenKind.Equal) {
                result = BracketDisambiguation.RecordExpression;
                break;
            } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
                result = BracketDisambiguation.FieldSelection;
                break;
            }

            offsetTokenIndex += 1;
        }
    }

    trace.exit({ [TraceConstant.Result]: result });

    return result !== undefined && allowedVariants.includes(result) ? result : undefined;
}

const enum DisambiguationTraceConstant {
    Disambiguation = "Disambiguation",
}

// Copy the current state and attempt to read for each of the following:
//  FieldProjection, FieldSelection, and RecordExpression.
// Mutates the given state with the read attempt which matched the most tokens.
async function thoroughReadAmbiguousBracket(
    state: ParseState,
    parser: Parser,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
    maybeCorrelationId: number | undefined,
): Promise<TAmbiguousBracketNode> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguousBracket.name,
        maybeCorrelationId,
    );

    const ambiguousBracket: TAmbiguousBracketNode = await thoroughReadAmbiguous(
        state,
        parser,
        bracketDisambiguationParseFunctions(parser, allowedVariants),
        trace.id,
    );

    trace.exit({ allowedVariants });

    return ambiguousBracket;
}

// Copy the current state and attempt to read for each of the following:
//  FunctionExpression, ParenthesisExpression.
// Mutates the given state with the read attempt which matched the most tokens.
async function thoroughReadAmbiguousParenthesis(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<TAmbiguousParenthesisNode> {
    return await thoroughReadAmbiguous<TAmbiguousParenthesisNode>(
        state,
        parser,
        [parser.readFunctionExpression, readParenthesizedExpressionOrBinOpExpression],
        maybeCorrelationId,
    );
}

async function thoroughReadAmbiguous<T extends TAmbiguousBracketNode | TAmbiguousParenthesisNode>(
    state: ParseState,
    parser: Parser,
    parseFns: ReadonlyArray<(state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) => Promise<T>>,
    maybeCorrelationId: number | undefined,
): Promise<T> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        thoroughReadAmbiguous.name,
        maybeCorrelationId,
        {
            [TraceConstant.Length]: parseFns.length,
        },
    );

    const ambiguousParse: AmbiguousParse<T> = await readAmbiguous(state, parser, parseFns, trace.id);

    await parser.applyState(state, ambiguousParse.parseState);

    if (ResultUtils.isOk(ambiguousParse.result)) {
        trace.exit({
            [TraceConstant.IsThrowing]: false,
            [TraceConstant.Result]: ambiguousParse.result,
        });

        return ambiguousParse.result.value;
    } else {
        // ParseError.state references the cloned state generated in readAmbiguous, not the current state parameter.
        // For correctness sake we need to update the existing state with the AmbiguousParse error,
        // then update the reference.
        const mutableParseError: TypeScriptUtils.StripReadonly<ParseError.ParseError> = ambiguousParse.result.error;
        mutableParseError.state = state;

        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw ambiguousParse.result.error;
    }
}

// Converts BracketDisambiguation into its corrosponding read function.
function bracketDisambiguationParseFunctions(
    parser: Parser,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): ReadonlyArray<
    (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) => Promise<TAmbiguousBracketNode>
> {
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

// When the next token is an open parenthesis we can't directly read
// a ParenthesisExpression as it may leave trailing tokens behind.
// `(1) + 2`
async function readParenthesizedExpressionOrBinOpExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ParenthesizedExpression | Ast.TLogicalExpression> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readParenthesizedExpressionOrBinOpExpression.name,
        maybeCorrelationId,
    );

    const node: Ast.TNode = await parser.readLogicalExpression(state, parser, trace.id);

    const leftMostNode: Ast.TNode = NodeIdMapUtils.assertUnboxLeftMostLeaf(
        state.contextState.nodeIdMapCollection,
        node.id,
    );

    AstUtils.assertAsTConstant(leftMostNode);

    Assert.isTrue(
        leftMostNode.kind === Ast.NodeKind.Constant &&
            leftMostNode.constantKind === Constant.WrapperConstant.LeftParenthesis,
        `leftMostNode should be a ${Ast.NodeKind.Constant} with a constantKind of ${Constant.WrapperConstant.LeftParenthesis}`,
    );

    trace.exit();

    return node;
}

// WARNING: Only updates tokenIndex and currentTokenKind,
//          Manual cleanup of other state fields such as TokenRangeStack is assumed by the caller.
function unsafeMoveTo(state: ParseState, tokenIndex: number): void {
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

function bestAmbiguousParseMatch<T extends Ast.TNode>(
    maybeBest: AmbiguousParse<T> | undefined,
    candidate: AmbiguousParse<T>,
): AmbiguousParse<T> {
    if (maybeBest === undefined || maybeBest.parseState.tokenIndex < candidate.parseState.tokenIndex) {
        return candidate;
    } else if (
        maybeBest.parseState.tokenIndex === candidate.parseState.tokenIndex &&
        ResultUtils.isError(maybeBest.result) &&
        ResultUtils.isOk(candidate.result)
    ) {
        return candidate;
    } else {
        return maybeBest;
    }
}
