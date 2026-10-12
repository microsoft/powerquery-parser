// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Lexer, ResultUtils, StringUtils, Task, TaskUtils } from "../../..";

function assertGetLexError(text: string, locale: string = DefaultSettings.locale): Lexer.LexError.LexError {
    const triedLex: Lexer.TriedLex = Lexer.tryLex({ ...DefaultSettings, locale }, text);
    ResultUtils.assertIsError(triedLex);
    expect(triedLex.error).to.be.instanceOf(Error);
    expect(Lexer.LexError.isLexError(triedLex.error)).to.equal(true);

    if (!Lexer.LexError.isLexError(triedLex.error)) {
        throw new Error("Expected a lexical diagnostic, not a common error");
    }

    expect(Lexer.LexError.isTLexError(triedLex.error)).to.equal(true);
    expect(Lexer.LexError.isTInnerLexError(triedLex.error.innerError)).to.equal(true);
    expect(triedLex.error.message).to.equal(triedLex.error.innerError.message);

    return triedLex.error;
}

describe("Lexer.Error", () => {
    describe(Lexer.LexError.ExpectedError.name, () => {
        const cases: ReadonlyArray<[string, Lexer.LexError.ExpectedKind]> = [
            ["0x", Lexer.LexError.ExpectedKind.HexLiteral],
            ["^", Lexer.LexError.ExpectedKind.KeywordOrIdentifier],
        ];

        for (const [text, kind] of cases) {
            it(kind, () => {
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(text).innerError;
                expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);
                expect((error as Lexer.LexError.ExpectedError).kind).to.equal(kind);
            });
        }
    });

    describe(Lexer.LexError.UnterminatedMultilineTokenError.name, () => {
        const cases: ReadonlyArray<[string, Lexer.LexError.UnterminatedMultilineTokenKind]> = [
            ["/*", Lexer.LexError.UnterminatedMultilineTokenKind.MultilineComment],
            ['"', Lexer.LexError.UnterminatedMultilineTokenKind.Text],
            ['#"', Lexer.LexError.UnterminatedMultilineTokenKind.QuotedIdentifier],
        ];

        for (const [text, kind] of cases) {
            it(kind, () => {
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(text).innerError;
                expect(error).to.be.instanceOf(Lexer.LexError.UnterminatedMultilineTokenError);
                expect((error as Lexer.LexError.UnterminatedMultilineTokenError).kind).to.equal(kind);
            });

            it(`${kind} reports the opening position across mixed newlines`, () => {
                const input: string = `// heading\r\nA\u0301 ${text}\r\n\n\u2028unfinished`;
                const error: Lexer.LexError.TInnerLexError = assertGetLexError(input).innerError;
                expect(error).to.be.instanceOf(Lexer.LexError.UnterminatedMultilineTokenError);

                expect(error.graphemePosition).to.deep.equal({
                    lineNumber: 1,
                    lineCodeUnit: 3,
                    columnNumber: 2,
                    codeUnit: 15,
                });
            });
        }
    });

    it("returns the first lexical failure directly, without line-state aggregation", () => {
        const task: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, "good\n0x\n#bad\n$");
        TaskUtils.assertIsLexStageError(task);
        expect(Object.keys(task).sort()).to.deep.equal(["error", "resultKind", "stage"]);
        expect(task.error).to.be.instanceOf(Lexer.LexError.LexError);
        expect(task.error.innerError).to.be.instanceOf(Lexer.LexError.ExpectedError);

        const error: Lexer.LexError.ExpectedError = task.error.innerError as Lexer.LexError.ExpectedError;
        expect(error.kind).to.equal(Lexer.LexError.ExpectedKind.HexLiteral);

        expect(error.graphemePosition).to.deep.equal({
            lineNumber: 1,
            lineCodeUnit: 0,
            columnNumber: 0,
            codeUnit: 5,
        });

        expect(error).not.to.have.property("errorLineMap");
    });

    it("does not scan later malformed lines or give them priority over an earlier error", () => {
        const error: Lexer.LexError.TInnerLexError = assertGetLexError('0x\n"unfinished').innerError;
        expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);
        expect(error.graphemePosition.codeUnit).to.equal(0);
    });

    for (const newline of ["\n", "\r\n", "\u2028", "\u2029"]) {
        it(`locates a diagnostic after multiline comments and text with ${JSON.stringify(newline)}`, () => {
            const prefix: string = `/*first${newline}second*/${newline}"line${newline}text" `;
            const error: Lexer.LexError.TInnerLexError = assertGetLexError(`${prefix}A\u0301 ^`).innerError;

            expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);

            expect(error.graphemePosition).to.deep.equal({
                lineNumber: 3,
                lineCodeUnit: 9,
                columnNumber: 8,
                codeUnit: prefix.length + 3,
            });
        });

        it(`preserves diagnostic columns after a long comment and ${JSON.stringify(newline)}`, () => {
            const prefix: string = `//${"x".repeat(32768)}\rbare${newline}`;
            const error: Lexer.LexError.TInnerLexError = assertGetLexError(`${prefix}A\u0301 ^`).innerError;

            expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);

            expect(error.graphemePosition).to.deep.equal({
                lineNumber: 1,
                lineCodeUnit: 3,
                columnNumber: 2,
                codeUnit: prefix.length + 3,
            });
        });
    }

    for (const text of [".", ".\r\n1", ".\u2028"]) {
        it(`reports unexpected end of line for ${JSON.stringify(text)}`, () => {
            const error: Lexer.LexError.TInnerLexError = assertGetLexError(text).innerError;
            expect(error).to.be.instanceOf(Lexer.LexError.UnexpectedEofError);
            expect(error.graphemePosition.codeUnit).to.equal(0);
        });
    }

    for (const text of [".0", "#", "#unknown"]) {
        it(`reports an unexpected read for ${JSON.stringify(text)}`, () => {
            expect(assertGetLexError(text).innerError).to.be.instanceOf(Lexer.LexError.UnexpectedReadError);
        });
    }

    it("reports the containing grapheme when an invalid character follows a hex literal", () => {
        const error: Lexer.LexError.TInnerLexError = assertGetLexError("0xA\u0301").innerError;
        expect(error).to.be.instanceOf(Lexer.LexError.ExpectedError);

        expect(error.graphemePosition).to.deep.equal({
            lineNumber: 0,
            lineCodeUnit: 3,
            columnNumber: 2,
            codeUnit: 3,
        });
    });

    it("reports UTF-16 offsets and grapheme columns independently", () => {
        const error: Lexer.LexError.TInnerLexError = assertGetLexError("//x\r\n\u{10400} A\u0301 $").innerError;

        expect(error.graphemePosition).to.deep.equal({
            lineNumber: 1,
            lineCodeUnit: 6,
            columnNumber: 4,
            codeUnit: 11,
        });
    });

    it("uses requested locale templates for every retained diagnostic", () => {
        const position: StringUtils.GraphemePosition = {
            lineNumber: 0,
            lineCodeUnit: 0,
            columnNumber: 0,
            codeUnit: 0,
        };

        for (const locale of ["en-US", "fr-FR", "de-DE", "ja-JP", "unknown-locale"]) {
            const cases: ReadonlyArray<[string, Lexer.LexError.TInnerLexError]> = [
                ["0x", new Lexer.LexError.ExpectedError(position, Lexer.LexError.ExpectedKind.HexLiteral, locale)],
                [
                    "^",
                    new Lexer.LexError.ExpectedError(position, Lexer.LexError.ExpectedKind.KeywordOrIdentifier, locale),
                ],
                [".", new Lexer.LexError.UnexpectedEofError(position, locale)],
                ["#", new Lexer.LexError.UnexpectedReadError(position, locale)],
                [
                    '"',
                    new Lexer.LexError.UnterminatedMultilineTokenError(
                        locale,
                        position,
                        Lexer.LexError.UnterminatedMultilineTokenKind.Text,
                    ),
                ],
            ];

            for (const [text, expected] of cases) {
                expect(assertGetLexError(text, locale).message).to.equal(expected.message);
            }
        }
    });
});
