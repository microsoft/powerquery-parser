import { Ast, ParserContext, ParserError } from "..";
import { CommonError, Option } from "../../common";
import { Token, TokenKind } from "../../lexer";
import { IParserState, IParser } from "./IParser";

export function startContext(state: IParserState, nodeKind: Ast.NodeKind): void {
    const newContextNode: ParserContext.Node = ParserContext.startContext(
        state.contextState,
        nodeKind,
        state.tokenIndex,
        state.maybeCurrentToken,
        state.maybeCurrentContextNode,
    );
    state.maybeCurrentContextNode = newContextNode;
}

export function endContext(state: IParserState, astNode: Ast.TNode): void {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(
            "maybeContextNode should be truthy, can't end a context if it doesn't exist.",
        );
    }

    const maybeParentOfContextNode: Option<ParserContext.Node> = ParserContext.endContext(
        state.contextState,
        state.maybeCurrentContextNode,
        astNode,
    );
    state.maybeCurrentContextNode = maybeParentOfContextNode;
}

export function incrementAttributeCounter(state: IParserState): void {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParserContext.Node = state.maybeCurrentContextNode;
    currentContextNode.attributeCounter += 1;
}

export function expectContextNodeMetadata(state: IParserState): ContextNodeMetadata {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError("maybeCurrentContextNode should be truthy");
    }
    const currentContextNode: ParserContext.Node = state.maybeCurrentContextNode;

    const maybeTokenStart: Option<Token> = currentContextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        throw new CommonError.InvariantError(`maybeTokenStart should be truthy`);
    }
    const tokenStart: Token = maybeTokenStart;

    // inclusive token index
    const tokenIndexEnd: number = state.tokenIndex - 1;
    const maybeTokenEnd: Option<Token> = state.lexerSnapshot.tokens[tokenIndexEnd];
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

    const contextNode: ParserContext.Node = state.maybeCurrentContextNode;
    return {
        id: contextNode.id,
        maybeAttributeIndex: currentContextNode.maybeAttributeIndex,
        tokenRange,
    };
}

export function expectAnyTokenKind(
    state: IParserState,
    expectedAnyTokenKind: ReadonlyArray<TokenKind>,
): Option<ParserError.ExpectedAnyTokenKindError> {
    const isError: boolean =
        state.maybeCurrentTokenKind === undefined || expectedAnyTokenKind.indexOf(state.maybeCurrentTokenKind) === -1;

    if (isError) {
        const maybeTokenWithColumnNumber: Option<ParserError.TokenWithColumnNumber> =
            state.maybeCurrentToken !== undefined
                ? {
                      token: state.maybeCurrentToken,
                      columnNumber: state.lexerSnapshot.columnNumberStartFrom(state.maybeCurrentToken),
                  }
                : undefined;
        return new ParserError.ExpectedAnyTokenKindError(expectedAnyTokenKind, maybeTokenWithColumnNumber);
    } else {
        return undefined;
    }
}

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

export function readTokenKind(state: IParserState, tokenKind: TokenKind): string {
    const maybeErr: Option<ParserError.ExpectedTokenKindError> = expectTokenKind(state, tokenKind);
    if (maybeErr) {
        throw maybeErr;
    }

    return readToken(state);
}

interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeAttributeIndex: Option<number>;
    readonly tokenRange: Ast.TokenRange;
}

function expectTokenKind(
    state: IParserState,
    expectedTokenKind: TokenKind,
): Option<ParserError.ExpectedTokenKindError> {
    if (expectedTokenKind !== state.maybeCurrentTokenKind) {
        const maybeTokenWithColumnNumber: Option<ParserError.TokenWithColumnNumber> =
            state.maybeCurrentToken !== undefined
                ? {
                      token: state.maybeCurrentToken,
                      columnNumber: state.lexerSnapshot.columnNumberStartFrom(state.maybeCurrentToken),
                  }
                : undefined;
        return new ParserError.ExpectedTokenKindError(expectedTokenKind, maybeTokenWithColumnNumber);
    } else {
        return undefined;
    }
}
