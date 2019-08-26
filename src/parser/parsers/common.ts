// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserError } from "..";
import { CommonError, Option } from "../../common";
import { Token, TokenKind } from "../../lexer";
import { IParserState } from "../IParserState";
import {
    endContext,
    expectContextNodeMetadata,
    incrementAttributeCounter,
    isOnIdentifierConstant,
    startContext,
    testIsOnTokenKind,
} from "../IParserState/IParserStateUtils";

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
    const maybeErr: Option<ParserError.ExpectedTokenKindError> = testIsOnTokenKind(state, tokenKind);
    if (maybeErr) {
        throw maybeErr;
    }

    return readToken(state);
}

export function readIdentifierConstantAsConstant(
    state: IParserState,
    identifierConstant: Ast.IdentifierConstant,
): Ast.Constant {
    const maybeConstant: Option<Ast.Constant> = maybeReadIdentifierConstantAsConstant(state, identifierConstant);
    if (!maybeConstant) {
        const details: {} = { identifierConstant };
        throw new CommonError.InvariantError(`couldn't convert IdentifierConstant into ConstantKind`, details);
    }

    return maybeConstant;
}

export function maybeReadIdentifierConstantAsConstant(
    state: IParserState,
    identifierConstant: Ast.IdentifierConstant,
): Option<Ast.Constant> {
    if (isOnIdentifierConstant(state, identifierConstant)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        startContext(state, nodeKind);

        const maybeConstantKind: Option<Ast.ConstantKind> = Ast.constantKindFromIdentifieConstant(identifierConstant);
        if (!maybeConstantKind) {
            const details: {} = { identifierConstant };
            throw new CommonError.InvariantError(`couldn't convert IdentifierConstant into ConstantKind`, details);
        }

        readToken(state);
        const astNode: Ast.Constant = {
            ...expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal: maybeConstantKind,
        };
        endContext(state, astNode);
        return astNode;
    } else {
        incrementAttributeCounter(state);
        return undefined;
    }
}
