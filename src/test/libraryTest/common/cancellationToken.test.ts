// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { expect } from "chai";

import {
    CommonError,
    CounterCancellationToken,
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
    describe(`CounterCancellationToken`, () => {
        it(`throwIfCancelled should consume exactly 1 count`, () => {
            // With threshold of 3, we should be able to call throwIfCancelled 2 times
            // without throwing (counts 1 and 2), then the 3rd should throw (count 3).
            const token: CounterCancellationToken = new CounterCancellationToken(3);

            // First call: counter goes to 1, threshold is 3, no throw
            token.throwIfCancelled();

            // Second call: counter goes to 2, threshold is 3, no throw
            token.throwIfCancelled();

            // Third call: counter goes to 3, threshold is 3, should throw
            expect(() => token.throwIfCancelled()).to.throw(CommonError.CancellationError);
        });

        it(`isCancelled should consume exactly 1 count`, () => {
            const token: CounterCancellationToken = new CounterCancellationToken(3);

            // First call: counter goes to 1, not cancelled
            expect(token.isCancelled()).to.be.false;

            // Second call: counter goes to 2, not cancelled
            expect(token.isCancelled()).to.be.false;

            // Third call: counter goes to 3, cancelled
            expect(token.isCancelled()).to.be.true;
        });
    });

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
