// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { CommonError, ResultUtils } from "../../common";
import { Ast } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { getLocalizationTemplates } from "../../localization";
import { ParseSettings } from "../../settings";
import { IParserState, IParserStateUtils } from "../IParserState";
import { TriedParse } from "./IParser";

export function tryParse<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): TriedParse<S> {
    if (parseSettings.parser.maybeInitialRead === undefined) {
        return tryParseDocument<S>(parseSettings, lexerSnapshot, stateFactoryFn) as TriedParse<S>;
    }

    const parseState: S = stateFactoryFn(parseSettings, lexerSnapshot);
    try {
        const root: Ast.TNode = parseSettings.parser.maybeInitialRead(parseState, parseSettings.parser);
        IParserStateUtils.assertNoMoreTokens(parseState);
        IParserStateUtils.assertNoOpenContext(parseState);
        return ResultUtils.okFactory({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (error) {
        return ResultUtils.errFactory(ensureParseError(parseState, error, parseSettings.locale));
    }
}

export function tryParseDocument<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): TriedParse {
    let root: Ast.TNode;

    const expressionDocumentState: S = stateFactoryFn(parseSettings, lexerSnapshot);
    try {
        root = parseSettings.parser.readExpression(expressionDocumentState, parseSettings.parser);
        IParserStateUtils.assertNoMoreTokens(expressionDocumentState);
        IParserStateUtils.assertNoOpenContext(expressionDocumentState);
        return ResultUtils.okFactory({
            lexerSnapshot,
            root,
            state: expressionDocumentState,
        });
    } catch (expressionDocumentError) {
        const sectionDocumentState: S = stateFactoryFn(parseSettings, lexerSnapshot);
        try {
            root = parseSettings.parser.readSectionDocument(sectionDocumentState, parseSettings.parser);
            IParserStateUtils.assertNoMoreTokens(sectionDocumentState);
            IParserStateUtils.assertNoOpenContext(sectionDocumentState);
            return ResultUtils.okFactory({
                lexerSnapshot,
                root,
                state: sectionDocumentState,
            });
        } catch (sectionDocumentError) {
            let betterParsedState: S;
            let betterParsedError: Error;

            if (expressionDocumentState.tokenIndex > sectionDocumentState.tokenIndex) {
                betterParsedState = expressionDocumentState;
                betterParsedError = expressionDocumentError;
            } else {
                betterParsedState = sectionDocumentState;
                betterParsedError = sectionDocumentError;
            }

            return ResultUtils.errFactory(ensureParseError(betterParsedState, betterParsedError, parseSettings.locale));
        }
    }
}

function ensureParseError<S extends IParserState = IParserState>(
    state: S,
    error: Error,
    locale: string,
): ParseError.TParseError<S> {
    if (ParseError.isTInnerParseError(error)) {
        return new ParseError.ParseError(error, state);
    } else {
        return CommonError.ensureCommonError(getLocalizationTemplates(locale), error);
    }
}
