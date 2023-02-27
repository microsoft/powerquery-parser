// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import {
    CommonError,
    DefaultSettings,
    Lexer,
    Result,
    ResultUtils,
    Settings,
    TimedCancellationToken,
    TypeScriptUtils,
} from "../../..";

function assertGetCancellationError<T, E>(tried: Result<T, E>): CommonError.CancellationError {
    ResultUtils.assertIsError(tried);

    if (!CommonError.isCommonError(tried.error)) {
        throw new Error(`expected error to be a ${CommonError.CommonError.name}`);
    }

    const innerError: Lexer.LexError.TInnerLexError = tried.error.innerError;

    if (!(innerError instanceof CommonError.CancellationError)) {
        throw new Error(`expected innerError to be a ${CommonError.CancellationError.name}`);
    }

    return innerError;
}

function assertGetLexerStateWithCancellationToken(): Lexer.State {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, "foo");
    ResultUtils.assertIsOk(triedLex);
    const state: TypeScriptUtils.StripReadonly<Lexer.State> = triedLex.value;
    state.cancellationToken = new TimedCancellationToken(0);

    return state;
}

function defaultSettingsWithExpiredCancellationToken(): Settings {
    return {
        ...DefaultSettings,
        cancellationToken: new TimedCancellationToken(0),
    };
}

describe("CancellationToken", () => {
    describe(`lexer`, () => {
        it(`Lexer.tryLex`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryLex(defaultSettingsWithExpiredCancellationToken(), "foo");
            assertGetCancellationError(triedLex);
        });

        it(`Lexer.tryAppendLine`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryAppendLine(
                assertGetLexerStateWithCancellationToken(),
                "bar",
                "\n",
            );

            assertGetCancellationError(triedLex);
        });

        it(`Lexer.tryDeleteLine`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryDeleteLine(assertGetLexerStateWithCancellationToken(), 0);
            assertGetCancellationError(triedLex);
        });

        it(`Lexer.tryUpdateLine`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryUpdateLine(assertGetLexerStateWithCancellationToken(), 0, "");
            assertGetCancellationError(triedLex);
        });

        it(`Lexer.tryUpdateRange`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryUpdateRange(
                assertGetLexerStateWithCancellationToken(),
                {
                    start: {
                        lineCodeUnit: 0,
                        lineNumber: 0,
                    },
                    end: {
                        lineNumber: 0,
                        lineCodeUnit: 1,
                    },
                },
                "",
            );

            assertGetCancellationError(triedLex);
        });
    });
});
