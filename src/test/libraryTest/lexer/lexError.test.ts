// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Lexer, ResultUtils, StringUtils, Task, TaskUtils, Templates } from "../../..";

function assertGetLexError(text: string, locale: string = DefaultSettings.locale): Lexer.LexError.TInnerLexError {
    const triedLex: Lexer.TriedLex = Lexer.tryLex({ ...DefaultSettings, locale }, text);
    ResultUtils.assertIsError(triedLex);
    expect(triedLex.error).to.be.instanceOf(Error);

    if (!Lexer.LexError.isLexError(triedLex.error)) {
        throw new Error(`Expected a LexError: ${triedLex.error.message}`);
    }

    expect(Lexer.LexError.isTLexError(triedLex.error)).to.equal(true);
    expect(Lexer.LexError.isTInnerLexError(triedLex.error.innerError)).to.equal(true);
    expect(triedLex.error.message).to.equal(triedLex.error.innerError.message);
    expect(triedLex.error.innerError).not.to.have.property("errorLineMap");

    return triedLex.error.innerError;
}

describe("Lexer.Error", () => {
    describe(Lexer.LexError.ExpectedError.name, () => {
        for (const [text, kind] of [
            ["0x", Lexer.LexError.ExpectedKind.HexLiteral],
            ["^", Lexer.LexError.ExpectedKind.KeywordOrIdentifier],
        ] as const) {
            it(kind, () => {
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(text);
                expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);
                expect(error).to.have.property("kind", kind);
            });
        }
    });

    describe(Lexer.LexError.UnterminatedMultilineTokenError.name, () => {
        for (const [opening, kind] of [
            ["/*", Lexer.LexError.UnterminatedMultilineTokenKind.MultilineComment],
            ['"', Lexer.LexError.UnterminatedMultilineTokenKind.Text],
            ['#"', Lexer.LexError.UnterminatedMultilineTokenKind.QuotedIdentifier],
            ['#!"', Lexer.LexError.UnterminatedMultilineTokenKind.Text],
        ] as const) {
            it(kind, () => {
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(opening);
                expect(error).to.be.instanceOf(Lexer.LexError.UnterminatedMultilineTokenError);
                expect(error).to.have.property("kind", kind);
                expect(error.graphemePosition.codeUnit).to.equal(0);
            });

            it(`${kind} reports its opening delimiter after earlier multiline tokens`, () => {
                const prefix: string = '/*a\r\nb*/\n"c\u2028d"\u2029A\u0301 ';
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(`${prefix}${opening}\r\nunfinished`);
                expect(error).to.be.instanceOf(Lexer.LexError.UnterminatedMultilineTokenError);

                expect(error.graphemePosition).to.deep.equal({
                    codeUnit: prefix.length,
                    lineNumber: 4,
                    lineCodeUnit: 3,
                    columnNumber: 2,
                });
            });
        }

        for (const [opening, kind] of [
            ['"', Lexer.LexError.UnterminatedMultilineTokenKind.Text],
            ['#"', Lexer.LexError.UnterminatedMultilineTokenKind.QuotedIdentifier],
            ['#!"', Lexer.LexError.UnterminatedMultilineTokenKind.Text],
        ] as const) {
            it(`${kind} does not treat a doubled quote at EOF as a closing delimiter`, () => {
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(`${opening}a""""`);
                expect(error).to.be.instanceOf(Lexer.LexError.UnterminatedMultilineTokenError);
                expect(error).to.have.property("kind", kind);
                expect(error.graphemePosition.codeUnit).to.equal(0);
            });
        }
    });

    it("stops at the first error instead of collecting errors from later lines", async () => {
        const text: string = 'good\n0x\n#bad\n"unfinished';
        const direct: Lexer.LexError.TInnerLexError = assertGetLexError(text);
        expect(direct).to.have.property("kind", Lexer.LexError.ExpectedKind.HexLiteral);

        expect(direct.graphemePosition).to.deep.equal({
            codeUnit: 5,
            lineNumber: 1,
            lineCodeUnit: 0,
            columnNumber: 0,
        });

        for (const task of [
            TaskUtils.tryLex(DefaultSettings, text),
            await TaskUtils.tryLexParse(DefaultSettings, text),
        ]) {
            TaskUtils.assertIsLexStageError(task);
            expect(task.stage).to.equal(Task.TaskStage.Lex);
            expect(Object.keys(task).sort()).to.deep.equal(["error", "resultKind", "stage"]);
            expect(task.error.innerError).to.be.instanceOf(Lexer.LexError.ExpectedError);
            expect(task.error.innerError).to.have.property("kind", Lexer.LexError.ExpectedKind.HexLiteral);
        }
    });

    it("does not continue polling after encountering the first error", () => {
        let polls: number = 0;

        const tried: Lexer.TriedLex = Lexer.tryLex(
            {
                ...DefaultSettings,
                cancellationToken: {
                    isCancelled: (): boolean => false,
                    cancel: (): void => {},
                    throwIfCancelled: (): void => {
                        polls += 1;
                    },
                },
            },
            `0x\n${"later\n".repeat(1000)}`,
        );

        ResultUtils.assertIsError(tried);
        expect(tried.error.innerError).to.be.instanceOf(Lexer.LexError.ExpectedError);
        expect(polls).to.equal(2);
    });

    for (const newline of ["\n", "\r\n", "\u2028", "\u2029"]) {
        it(`reports UTF-16 offsets and grapheme columns after ${JSON.stringify(newline)}`, () => {
            const prefix: string = `/*a${newline}b*/${newline}\u{10400} A\u0301 `;
            const error: Lexer.LexError.TInnerLexError = assertGetLexError(`${prefix}^`);

            expect(error.graphemePosition).to.deep.equal({
                codeUnit: prefix.length,
                lineNumber: 2,
                lineCodeUnit: 6,
                columnNumber: 4,
            });
        });

        it(`does not combine tokens across ${JSON.stringify(newline)}`, () => {
            const error: Lexer.LexError.TInnerLexError = assertGetLexError(`0x${newline}A`);
            expect(error).to.have.property("kind", Lexer.LexError.ExpectedKind.HexLiteral);
            expect(error.graphemePosition.codeUnit).to.equal(0);
        });
    }

    for (const text of [".", ".\n1", ".\r\n1", ".\u2028", ".\u2029"]) {
        it(`reports an incomplete token for ${JSON.stringify(text)}`, () => {
            expect(assertGetLexError(text)).to.be.instanceOf(Lexer.LexError.UnexpectedEofError);
        });
    }

    for (const text of ["#", "#unknown", "#if", "#null", "#datex", "#date.", "#0", "#\n", ".0"]) {
        it(`reports an unexpected read for ${JSON.stringify(text)}`, () => {
            expect(assertGetLexError(text)).to.be.instanceOf(Lexer.LexError.UnexpectedReadError);
        });
    }

    it("reports the containing column when an invalid code unit is inside a grapheme", () => {
        const error: Lexer.LexError.TInnerLexError = assertGetLexError("0xA\u0301");
        expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);

        expect(error.graphemePosition).to.deep.equal({
            codeUnit: 3,
            lineNumber: 0,
            lineCodeUnit: 3,
            columnNumber: 2,
        });
    });

    for (const locale of [...Templates.TemplatesByLocale.keys(), "unknown-locale"]) {
        it(`uses localized diagnostics for ${locale}`, () => {
            const position: StringUtils.GraphemePosition = {
                codeUnit: 0,
                lineNumber: 0,
                lineCodeUnit: 0,
                columnNumber: 0,
            };

            const cases: ReadonlyArray<[string, Lexer.LexError.TInnerLexError]> = [
                ["0x", new Lexer.LexError.ExpectedError(position, Lexer.LexError.ExpectedKind.HexLiteral, locale)],
                [
                    "^",
                    new Lexer.LexError.ExpectedError(position, Lexer.LexError.ExpectedKind.KeywordOrIdentifier, locale),
                ],
                ["#", new Lexer.LexError.UnexpectedReadError(position, locale)],
                [".", new Lexer.LexError.UnexpectedEofError(position, locale)],
                [
                    '"',
                    new Lexer.LexError.UnterminatedMultilineTokenError(
                        locale,
                        position,
                        Lexer.LexError.UnterminatedMultilineTokenKind.Text,
                    ),
                ],
                [
                    '#"',
                    new Lexer.LexError.UnterminatedMultilineTokenError(
                        locale,
                        position,
                        Lexer.LexError.UnterminatedMultilineTokenKind.QuotedIdentifier,
                    ),
                ],
                [
                    "/*",
                    new Lexer.LexError.UnterminatedMultilineTokenError(
                        locale,
                        position,
                        Lexer.LexError.UnterminatedMultilineTokenKind.MultilineComment,
                    ),
                ],
            ];

            for (const [text, expected] of cases) {
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(text, locale);
                expect(error.constructor).to.equal(expected.constructor);
                expect(error.message).to.equal(expected.message).and.not.to.equal("");
                expect(error.graphemePosition).to.deep.equal(position);
            }
        });
    }
});
