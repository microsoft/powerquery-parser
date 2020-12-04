// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Lexer } from "../../../powerquery-parser";
import {
    Assert,
    CommonError,
    Result,
    TimedCancellationToken,
    TypeScriptUtils,
} from "../../../powerquery-parser/common";
import { LexError } from "../../../powerquery-parser/lexer";
import { DefaultSettings, Settings, SettingsUtils } from "../../../powerquery-parser/settings";

function assertGetCancellationError<T, E>(tried: Result<T, E>): CommonError.CancellationError {
    Assert.isErr(tried);
    if (!CommonError.isCommonError(tried.error)) {
        throw new Error(`expected error to be a ${CommonError.CommonError.name}`);
    }
    const innerError: LexError.TInnerLexError = tried.error.innerError;
    if (!(innerError instanceof CommonError.CancellationError)) {
        throw new Error(`expected innerError to be a ${CommonError.CancellationError.name}`);
    }

    return innerError;
}

function assertGetLexerStateWithCancellationToken(): Lexer.State {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, "foo");
    Assert.isOk(triedLex);
    const state: TypeScriptUtils.StripReadonly<Lexer.State> = triedLex.value;
    state.maybeCancellationToken = new TimedCancellationToken(0);

    return state;
}

function settingsWithCancellationToken(): Settings {
    return SettingsUtils.defaultSettingsFactory(new TimedCancellationToken(0));
}

describe("CancellationToken", () => {
    describe(`lexer`, () => {
        it(`Lexer.tryLex`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryLex(settingsWithCancellationToken(), "foo");
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
