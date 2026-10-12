// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import {
    CommonError,
    CounterCancellationToken,
    DefaultSettings,
    Language,
    Lexer,
    ResultUtils,
    StringUtils,
    Task,
    TaskUtils,
} from "../../..";

// Error stacks identify the caller rather than the diagnostic contract. Preserve all
// other own properties, including non-enumerable messages and source positions.
function diagnosticDetails(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(diagnosticDetails);
    } else if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.getOwnPropertyNames(value)
                .filter((key: string) => key !== "stack")
                .map((key: string) => [key, diagnosticDetails((value as Record<string, unknown>)[key])]),
        );
    }

    return value;
}

function assertLexContract(text: string, settings: Lexer.LexSettings = DefaultSettings, expectedIsOk?: boolean): void {
    const actual: Lexer.TriedLex = Lexer.tryLex(settings, text);
    const task: Task.TriedLexTask = TaskUtils.tryLex(settings, text);

    expect(task.stage).to.equal(Task.TaskStage.Lex);
    expect(task.resultKind).to.equal(actual.kind);

    if (expectedIsOk !== undefined) {
        expect(ResultUtils.isOk(actual), JSON.stringify(text)).to.equal(expectedIsOk);
    }

    if (ResultUtils.isOk(actual)) {
        TaskUtils.assertIsLexStageOk(task);
        expect(Object.keys(task).sort()).to.deep.equal(["lexerSnapshot", "resultKind", "stage"]);
        expect(task.lexerSnapshot).to.deep.equal(actual.value);
        expect(actual.value).to.be.instanceOf(Lexer.LexerSnapshot);
        expect(actual.value.text).to.equal(text);

        expect(actual.value.lineTerminators.map((terminator: Lexer.LineTerminator) => terminator.text)).to.deep.equal([
            ...(text.match(/\r\n|\n|\u2028|\u2029/g) ?? []),
            "",
        ]);

        for (const token of actual.value.tokens) {
            const cached: StringUtils.GraphemePosition = actual.value.graphemePositionStartFrom(token);

            expect(cached).to.deep.equal(
                Lexer.LexerSnapshot.graphemePositionStartFrom(text, actual.value.lineTerminators, token),
            );

            expect(actual.value.columnNumberStartFrom(token)).to.equal(cached.columnNumber);
        }

        for (const item of [...actual.value.tokens, ...actual.value.comments]) {
            expect(item.data).to.equal(text.slice(item.positionStart.codeUnit, item.positionEnd.codeUnit));

            for (const position of [item.positionStart, item.positionEnd]) {
                const lines: ReadonlyArray<string> = text.slice(0, position.codeUnit).split(/\r\n|\n|\u2028|\u2029/);
                expect(position.lineNumber).to.equal(lines.length - 1);
                expect(position.lineCodeUnit).to.equal(lines[lines.length - 1]!.length);
            }
        }

        for (const comment of actual.value.comments) {
            if (comment.kind === Language.Comment.CommentKind.Line && comment.directive !== undefined) {
                expect(comment.directive.comment).to.equal(comment);
            }
        }
    } else {
        TaskUtils.assertIsLexStageError(task);
        expect(Object.keys(task).sort()).to.deep.equal(["error", "resultKind", "stage"]);
        expect(Lexer.LexError.isTLexError(actual.error)).to.equal(true);
        expect(diagnosticDetails(task.error)).to.deep.equal(diagnosticDetails(actual.error));

        if (settings.cancellationToken === undefined) {
            expect(actual.error, JSON.stringify(text)).to.be.instanceOf(Lexer.LexError.LexError);
            expect(Lexer.LexError.isTInnerLexError(actual.error.innerError)).to.equal(true);
        }
    }
}

describe("Whole-document lexer", () => {
    const validDocuments: ReadonlyArray<string> = [
        "",
        " \t\v\f\u00a0\u1680\u2000\u200a\u202f\u205f\u3000",
        "\r\n\n\u2028\u2029",
        "let a = 1, b = 2 in a + b",
        "! & ( ) * + , - ; ? ?? @ [ ] { } > >= < <= <> = => / .. ...",
        "and as each else error false if in is let meta not or otherwise section shared then true try type null",
        "#binary #date #datetime #datetimezone #duration #infinity #nan #sections #shared #table #time",
        "0 0xA 0XfF 1.25 1e+9 1E-2 .1 1..2 1...2",
        "foo foo. foo.bar foo..bar _a A\u0301 \u2160 \u{10400} \u4e2d\u6587 a\u200db",
        '"" "a""b" #"a""b" "#(cr,lf)"',
        '"a\r\nb\n\nc\u2028d\u2029e" #"a\r\nb"',
        "/*a\r\nb\n\nc\u2028d\u2029e*/ 1 /*single*/ //last",
        '/* outer /* inner */ 1 */ "a"\n// line\n2',
        "/// @type Foo\r\n///\t@type\tBar \t\r\nvalue",
        "/// @type Foo\n// ordinary\n/// @type Bar\nvalue",
        "/// @type Foo\n\nvalue\n/// @type Bar",
        "///@type Foo\n/// @type\n/// @typeX Foo\n/// @type \t\nvalue",
        "/// @type\u00a0Foo\n/// @type Foo\u00a0\n/// @type Foo // suffix\nvalue",
        "1 // trailing\n/*block*/ /// @type Foo\nvalue",
        '"a"\n"b"\n#"c"\n/*d*/',
        '"a""\n""b"',
        "/*a*\n/b*/",
    ];

    const invalidDocuments: ReadonlyArray<string> = [
        ".",
        ".0",
        ".\r\n1",
        "0x\n0X\n#unknown\n$",
        ',0xffA\u0301$A\u0301= \u2028?\u00a0null""',
        "good 0x\nother #unknown\nthird `",
        '0x\n"unterminated',
        "/* unclosed\n\n",
        '"unclosed\r\n\n',
        '#"unclosed\u2028',
        '"closed"\r\nA\u0301 #"unclosed',
        "\r",
        "a\rb",
        "a\r\r\nb",
        "\ufeffa",
        "\u0085",
        "\ud800",
        "\udc00",
        "a. \n#\n#date.\n#unknown",
    ];

    for (const isTypeDirectiveAllowed of [false, true]) {
        describe(`task and position contracts (directives ${isTypeDirectiveAllowed})`, () => {
            for (const text of [...validDocuments, ...invalidDocuments]) {
                it(JSON.stringify(text), () => {
                    assertLexContract(
                        text,
                        { ...DefaultSettings, isTypeDirectiveAllowed },
                        validDocuments.includes(text),
                    );
                });
            }
        });
    }

    it("returns direct diagnostics through both APIs for custom locales", () => {
        for (const locale of ["en-US", "fr-FR", "ja-JP", "de-DE", "unknown-locale"]) {
            for (const text of ["a\nA\u0301 0x\nb #bad\n$", 'a\r\nA\u0301 #"unclosed', "/*open", "a\n."]) {
                assertLexContract(text, { ...DefaultSettings, locale }, false);
            }
        }
    });

    it("maintains result and position invariants for 800 deterministic document mixtures", () => {
        const fragments: ReadonlyArray<string> = [
            "let",
            "foo.",
            "#date",
            "null",
            "0x",
            "0xff",
            ".0",
            "1e+",
            "1.5",
            ".",
            "...",
            "?",
            "??",
            '"',
            '""',
            '"a""b"',
            '#"',
            "/*",
            "*/",
            "//x",
            "/// @type Foo",
            " ",
            "\t",
            "\r",
            "\n",
            "\r\n",
            "\u2028",
            "\u2029",
            "\u00a0",
            "A\u0301",
            "\u{10400}",
            "\ud800",
            "$",
            "=",
            ",",
        ];

        let seed: number = 0x12345678;

        for (let document: number = 0; document < 800; document += 1) {
            let text: string = "";

            for (let fragment: number = 0; fragment < 12; fragment += 1) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                text += fragments[seed % fragments.length];
            }

            assertLexContract(text, { ...DefaultSettings, isTypeDirectiveAllowed: document % 2 === 0 });
        }
    });

    it("accepts immutable custom settings", () => {
        const task: Task.TriedLexTask = TaskUtils.tryLex(
            Object.freeze({ ...DefaultSettings, isTypeDirectiveAllowed: true }),
            '/// @type Foo\r\nlet x = "a\r\nb", y = #"c\nd" in /* e\nf */ x',
        );

        TaskUtils.assertIsLexStageOk(task);
        expect(task.lexerSnapshot.comments.length).to.equal(2);
    });

    it("retains explicitly supplied directive maps in the public snapshot constructor", () => {
        const directives: Map<number, ReadonlyArray<Language.Comment.TDirective>> = new Map([[7, []]]);
        const snapshot: Lexer.LexerSnapshot = new Lexer.LexerSnapshot("", [], [], [], directives);

        expect(snapshot.getPrecedingDirectives(7)).to.equal(directives.get(7));
        expect(snapshot.getPrecedingDirectives(0)).to.equal(undefined);
    });

    describe("Line-comment scanning", () => {
        for (const newline of ["\n", "\r\n", "\u2028", "\u2029"]) {
            it(`stops before ${JSON.stringify(newline)} and preserves following token positions`, () => {
                const commentText: string = "// A\u0301 \u{1f600}\rbare carriage";
                const text: string = `${commentText}${newline}value`;
                const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
                ResultUtils.assertIsOk(triedLex);

                const comment: Language.Comment.TComment | undefined = triedLex.value.comments[0];
                expect(comment?.data).to.equal(commentText);
                expect(comment?.positionEnd.codeUnit).to.equal(commentText.length);
                expect(comment?.positionEnd.lineNumber).to.equal(0);

                expect(triedLex.value.tokens[0]?.positionStart).to.deep.equal({
                    codeUnit: commentText.length + newline.length,
                    lineNumber: 1,
                    lineCodeUnit: 0,
                });

                assertLexContract(text, DefaultSettings, true);
            });
        }

        it("handles EOF and consecutive documents without sharing the search cursor", () => {
            const documents: ReadonlyArray<string> = [
                `//${"x".repeat(32768)}`,
                "//short\nvalue",
                "//",
                "value //trailing",
                "//first\r\n//second\u2028value",
                "//third\rbare carriage",
            ];

            for (const text of documents) {
                assertLexContract(text, DefaultSettings, true);
            }
        });

        it("preserves the outer scan when cancellation callbacks lex another document", () => {
            const text: string = "/// @type Foo\r\n// outer\u2028value // tail";
            const settings: Lexer.LexSettings = { ...DefaultSettings, isTypeDirectiveAllowed: true };
            const expected: Lexer.TriedLex = Lexer.tryLex(settings, text);
            let calls: number = 0;

            const actual: Lexer.TriedLex = Lexer.tryLex(
                {
                    ...settings,
                    cancellationToken: {
                        isCancelled: (): boolean => false,
                        cancel: (): void => {},
                        throwIfCancelled: (): void => {
                            calls += 1;

                            const nested: Lexer.TriedLex = Lexer.tryLex(
                                DefaultSettings,
                                calls % 2 === 0 ? "// nested\nvalue" : `//${"x".repeat(1024)}`,
                            );

                            ResultUtils.assertIsOk(nested);
                        },
                    },
                },
                text,
            );

            expect(calls).to.be.greaterThan(1);
            expect(actual).to.deep.equal(expected);
        });
    });

    describe("Whole-document replacements after editing", () => {
        it("re-lexes the connector-style document used by the former incremental tokenizer", () => {
            const original: string = `shared Query1 =
let
   source = Csv.Document(binaryContent),
   count = Table.RowCount(source),
   string = "text",
   numbers = 123 + 456
in
   count + 3;`;

            const documents: ReadonlyArray<string> = [
                original,
                `    ${original}`,
                original.replace("Query1", "Query2"),
                original.replace("numbers", "numbers123"),
                original.replace("source", "source123"),
                "shared Query1 =\n 3;",
            ];

            for (const text of documents) {
                assertLexContract(text, DefaultSettings, true);
            }

            assertLexContract(original.replace('"text",', '"text'), DefaultSettings, false);
            assertLexContract(original.replace("rce),", "rce), /* my open comment"), DefaultSettings, false);
            assertLexContract(original, DefaultSettings, true);
        });

        const replacements: ReadonlyArray<[string, string]> = [
            ["foobar", "Xfoobar"],
            ["foobar", "fooXbar"],
            ["foobar", "Xoobar"],
            ["foobar", "X"],
            ["foo\nbar", "X"],
            ["foo\nbar", "fXr"],
            ["foo\nbar\nbaz", "foo\nX\nbaz"],
            ["foo\nbar\nbaz", "foo\nbXr\nbaz"],
            ["foo\nbar\nbaz\nboo", "fOO\nBaz\nboo"],
            ["foo\nbar\nbaz\nboo", "faz\nboo"],
            ["/*\n*/\nbeta\ncharlie", "alpha\n*/\nbeta\ncharlie"],
            ['"\nbravo\ncharlie', '"hello"\nbravo\ncharlie'],
        ];

        for (const [before, after] of replacements) {
            it(`${JSON.stringify(before)} -> ${JSON.stringify(after)}`, () => {
                const original: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, before);
                const changed: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, after);
                ResultUtils.assertIsOk(changed);
                expect(changed.value.text).to.equal(after);
                assertLexContract(after, DefaultSettings, true);

                if (ResultUtils.isOk(original)) {
                    expect(original.value.text).to.equal(before);
                    expect(changed.value).not.to.equal(original.value);
                }
            });
        }

        for (const replacement of ["foobar", '"', "/*", '#"']) {
            for (let line: number = 0; line < 3; line += 1) {
                it(`replacing line ${line} with ${JSON.stringify(replacement)} starts a fresh scan`, () => {
                    const lines: string[] = ["alpha", "bravo", "charlie"];
                    lines[line] = replacement;
                    assertLexContract(lines.join("\n"), DefaultSettings, replacement === "foobar");

                    const repaired: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, "alpha\nbravo\ncharlie");
                    ResultUtils.assertIsOk(repaired);

                    expect(
                        repaired.value.tokens.map((token: Language.Token.Token) => token.positionStart.lineNumber),
                    ).to.deep.equal([0, 1, 2]);
                });
            }
        }
    });

    describe("Complete token counts from former line-tokenizer examples", () => {
        const cases: ReadonlyArray<[string, number, number]> = [
            ["1 = 1", 3, 0],
            ["let\na = 1\nin a", 6, 0],
            ["/* block */ let\na = 1 // line comment\nin a", 6, 2],
            ["1 + /* comment\nend*/ 2", 3, 1],
            ['"hello\nthere\n\n" & "append"', 3, 0],
            ['#"hello\nthere\n\n" & #"append"', 3, 0],
        ];

        for (const [text, tokens, comments] of cases) {
            it(JSON.stringify(text), () => {
                const tried: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
                ResultUtils.assertIsOk(tried);
                expect(tried.value.tokens.length).to.equal(tokens);
                expect(tried.value.comments.length).to.equal(comments);
                assertLexContract(text, DefaultSettings, true);
            });
        }
    });

    it("does not expose the retired incremental or separate-scanner APIs", () => {
        for (const name of [
            "tryAppendLine",
            "tryUpdateLine",
            "tryUpdateRange",
            "tryDeleteLine",
            "trySnapshot",
            "tryLexSnapshot",
            "equalStates",
            "equalLines",
            "equalTokens",
            "isErrorState",
            "isErrorLine",
            "errorLineMap",
            "LineKind",
            "LineMode",
        ]) {
            expect(Lexer).not.to.have.property(name);
        }

        for (const name of ["LineTokenKind", "LineTokenKindAdditions"]) {
            expect(Language.Token).not.to.have.property(name);
        }
    });

    for (const text of ["", " ", "\n", "1", '"a\nb"', "/*a\nb*/", "$"]) {
        it(`honors pre-cancellation for ${JSON.stringify(text)}`, () => {
            const cancellationToken: CounterCancellationToken = new CounterCancellationToken(1);

            cancellationToken.cancel("stop lexing");
            const settings: Lexer.LexSettings = { ...DefaultSettings, cancellationToken, locale: "fr-FR" };
            assertLexContract(text, settings, false);
            const task: Task.TriedLexTask = TaskUtils.tryLex(settings, text);
            TaskUtils.assertIsLexStageError(task);
            expect(task.error.innerError).to.be.instanceOf(CommonError.CancellationError);

            expect((task.error.innerError as CommonError.CancellationError).cancellationToken).to.equal(
                cancellationToken,
            );
        });
    }

    for (const prefix of ['"', '#"']) {
        it(`does not add cancellation polls while finding the end of ${prefix}`, () => {
            const text: string = `${prefix}${'a""'.repeat(64)}z"`;
            const cancellationToken: CounterCancellationToken = new CounterCancellationToken(3);
            const tried: Lexer.TriedLex = Lexer.tryLex({ ...DefaultSettings, cancellationToken }, text);

            ResultUtils.assertIsOk(tried);
            expect(tried.value.tokens.length).to.equal(1);
            expect(tried.value.tokens[0]?.data).to.equal(text);
        });
    }

    for (const text of ['"a\nb\nc\nd"', '#"a\nb\nc\nd"', "/*a\nb\nc\nd*/", "a b c d e f", "\n\n\n\n\n"]) {
        it(`checks cancellation during ${JSON.stringify(text)}`, () => {
            const cancellationToken: CounterCancellationToken = new CounterCancellationToken(4);
            const task: Task.TriedLexTask = TaskUtils.tryLex({ ...DefaultSettings, cancellationToken }, text);

            TaskUtils.assertIsLexStageError(task);
            expect(task.error.innerError).to.be.instanceOf(CommonError.CancellationError);
        });
    }

    it("preserves custom cancellation failures as localized common errors", () => {
        const settings: Lexer.LexSettings = {
            ...DefaultSettings,
            locale: "fr-FR",
            cancellationToken: {
                isCancelled: (): boolean => false,
                cancel: (): void => {},
                throwIfCancelled: (): never => {
                    throw new Error("custom cancellation failure");
                },
            },
        };

        assertLexContract("value", settings, false);
    });
});
