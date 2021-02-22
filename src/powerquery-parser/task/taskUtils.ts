// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer, Parser } from "..";
import { CommonError, ResultKind, ResultUtils } from "../common";
import { Ast } from "../language";
import { IParserUtils, IParseState } from "../parser";
import { LexSettings, ParseSettings } from "../settings/settings";
import {
    LexTaskErr,
    LexTaskOk,
    ParseTaskCommonErr,
    ParseTaskOk,
    ParseTaskParseErr,
    TaskStage,
    TriedLexTask,
    TriedParseTask,
} from "./task";

export function tryLex(settings: LexSettings, text: string): TriedLexTask {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    if (ResultUtils.isErr(triedLex)) {
        return createLexTaskErr(triedLex.error);
    }
    const state: Lexer.State = triedLex.value;

    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        return createLexTaskErr(
            new Lexer.LexError.LexError(new Lexer.LexError.ErrorLineMapError(settings.locale, maybeErrorLineMap)),
        );
    }

    const triedLexerSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(state);

    if (ResultUtils.isOk(triedLexerSnapshot)) {
        return createLexTaskOk(triedLexerSnapshot.value);
    } else {
        return createLexTaskErr(triedLexerSnapshot.error);
    }
}

export function tryParse<S extends IParseState = IParseState>(
    settings: ParseSettings<S>,
    lexerSnapshot: Lexer.LexerSnapshot,
): TriedParseTask {
    const triedParse: Parser.TriedParse = IParserUtils.tryParse(settings, lexerSnapshot);

    if (ResultUtils.isOk(triedParse)) {
        return createParseTaskOk(lexerSnapshot, triedParse.value.root, triedParse.value.state);
    } else {
        if (CommonError.isCommonError(triedParse.error)) {
            return createParseTaskCommonErr(lexerSnapshot, triedParse.error);
        } else {
            return createParseTaskParseErr(lexerSnapshot, triedParse.error);
        }
    }
}

export function tryLexParse<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedLexTask | TriedParseTask {
    const triedLexTask: TriedLexTask = tryLex(settings, text);
    if (triedLexTask.resultKind === ResultKind.Err) {
        return triedLexTask;
    }
    const lexerSnapshot: Lexer.LexerSnapshot = triedLexTask.lexerSnapshot;

    return tryParse(settings, lexerSnapshot);
}

function createLexTaskOk(lexerSnapshot: Lexer.LexerSnapshot): LexTaskOk {
    return {
        stage: TaskStage.Lex,
        resultKind: ResultKind.Ok,
        lexerSnapshot,
    };
}

function createLexTaskErr(error: Lexer.LexError.TLexError): LexTaskErr {
    return {
        stage: TaskStage.Lex,
        resultKind: ResultKind.Err,
        error,
    };
}

function createParseTaskOk<S extends IParseState = IParseState>(
    lexerSnapshot: Lexer.LexerSnapshot,
    ast: Ast.TNode,
    parseState: S,
): ParseTaskOk {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Ok,
        lexerSnapshot,
        ast,
        parseState,
        nodeIdMapCollection: parseState.contextState.nodeIdMapCollection,
        leafNodeIds: parseState.contextState.leafNodeIds,
    };
}

function createParseTaskCommonErr(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: CommonError.CommonError,
): ParseTaskCommonErr {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Err,
        isCommonError: true,
        error,
        lexerSnapshot,
    };
}

function createParseTaskParseErr<S extends IParseState = IParseState>(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: Parser.ParseError.ParseError<S>,
): ParseTaskParseErr {
    const parseState: S = error.state;
    const contextState: Parser.ParseContext.State = parseState.contextState;

    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Err,
        isCommonError: false,
        error,
        lexerSnapshot,
        parseState,
        nodeIdMapCollection: contextState.nodeIdMapCollection,
        leafNodeIds: contextState.leafNodeIds,
    };
}
