// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { CommonError, DefaultSettings, Language, Lexer, ResultUtils, Task, TaskUtils } from "../../..";
import { assertGetLexerSnapshot } from "../../testUtils/lexTestUtils";

function assertPositions(snapshot: Lexer.LexerSnapshot): void {
    for (const item of [...snapshot.tokens, ...snapshot.comments]) {
        expect(item.data).to.equal(snapshot.text.slice(item.positionStart.codeUnit, item.positionEnd.codeUnit));

        for (const position of [item.positionStart, item.positionEnd]) {
            const lines: ReadonlyArray<string> = snapshot.text
                .slice(0, position.codeUnit)
                .split(/\r\n|\n|\u2028|\u2029/);

            expect(position.lineNumber).to.equal(lines.length - 1);
            expect(position.lineCodeUnit).to.equal(lines[lines.length - 1]?.length);
        }
    }
}

describe("Lexer whole-document scanning", () => {
    for (const text of ["", " \t\v\f", "\r\n\n\u2028\u2029", " \n \t\r\n"]) {
        it(`returns an empty snapshot for ${JSON.stringify(text)}`, () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);
            expect(snapshot.text).to.equal(text);
            expect(snapshot.tokens).to.deep.equal([]);
            expect(snapshot.comments).to.deep.equal([]);
            expect(snapshot.lineTerminators.at(-1)).to.deep.equal({ codeUnit: text.length, text: "" });
        });
    }

    for (const newline of ["\r\n", "\n", "\u2028", "\u2029"]) {
        it(`emits complete multiline tokens and preserves ${JSON.stringify(newline)} positions`, () => {
            const text: string = `/*a${newline}b*/ "c${newline}d" #"e${newline}f" //tail${newline}value`;
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);

            expect(snapshot.tokens.map((token: Language.Token.Token) => [token.kind, token.data])).to.deep.equal([
                [Language.Token.TokenKind.TextLiteral, `"c${newline}d"`],
                [Language.Token.TokenKind.Identifier, `#"e${newline}f"`],
                [Language.Token.TokenKind.Identifier, "value"],
            ]);

            expect(snapshot.comments.map((comment: Language.Comment.TComment) => comment.data)).to.deep.equal([
                `/*a${newline}b*/`,
                "//tail",
            ]);

            expect(snapshot.lineTerminators.map((terminator: Lexer.LineTerminator) => terminator.text)).to.deep.equal([
                newline,
                newline,
                newline,
                newline,
                "",
            ]);

            expect(snapshot.tokens.at(-1)?.positionStart).to.deep.equal({
                codeUnit: text.length - 5,
                lineNumber: 4,
                lineCodeUnit: 0,
            });

            assertPositions(snapshot);
        });
    }

    for (const [text, tokens, comments] of [
        ["1 = 1", 3, 0],
        ["let\na = 1\nin a", 6, 0],
        ["/* block */ let\na = 1 // line comment\nin a", 6, 2],
        ["1 + /* comment\nend*/ 2", 3, 1],
        ['"hello\nthere\n\n" & "append"', 3, 0],
        ['#"hello\nthere\n\n" & #"append"', 3, 0],
        ['"a""\n""b"', 1, 0],
        ['#"a""\n""b"', 1, 0],
        ["/*a*\n/b*/", 0, 1],
        ["// end of document", 0, 1],
        ["// bare\rcarriage\nvalue", 1, 1],
    ] as const) {
        it(`preserves token and comment counts for ${JSON.stringify(text)}`, () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);
            expect(snapshot.tokens.length).to.equal(tokens);
            expect(snapshot.comments.length).to.equal(comments);
            assertPositions(snapshot);
        });
    }

    it("uses the same complete snapshot through the task API", () => {
        const text: string = 'let x = "a\nb" in x';
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);
        const task: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, text);
        TaskUtils.assertIsLexStageOk(task);
        expect(Object.keys(task).sort()).to.deep.equal(["lexerSnapshot", "resultKind", "stage"]);
        expect(task.lexerSnapshot).to.deep.equal(snapshot);

        for (const token of snapshot.tokens) {
            expect(Object.keys(token).sort()).to.deep.equal(["data", "kind", "positionEnd", "positionStart"]);
        }
    });

    it("distinguishes quoted text, quoted identifiers, hash keywords and ordinary identifiers", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot('"#text" #"a""b" "a""b" date #date null if');

        expect(snapshot.tokens.map((token: Language.Token.Token) => [token.kind, token.data])).to.deep.equal([
            [Language.Token.TokenKind.TextLiteral, '"#text"'],
            [Language.Token.TokenKind.Identifier, '#"a""b"'],
            [Language.Token.TokenKind.TextLiteral, '"a""b"'],
            [Language.Token.TokenKind.Identifier, "date"],
            [Language.Token.TokenKind.KeywordHashDate, "#date"],
            [Language.Token.TokenKind.NullLiteral, "null"],
            [Language.Token.TokenKind.KeywordIf, "if"],
        ]);

        assertPositions(snapshot);
    });

    it("starts each replacement document independently, including after an unterminated token", () => {
        const original: Lexer.LexerSnapshot = assertGetLexerSnapshot("alpha\nbravo\ncharlie");

        for (const opening of ['"', '#"', "/*"]) {
            const unfinished: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, `${opening}\nbravo\ncharlie`);
            ResultUtils.assertIsError(unfinished);
        }

        const repaired: Lexer.LexerSnapshot = assertGetLexerSnapshot('"hello"\nbravo\ncharlie');

        expect(repaired.tokens.map((token: Language.Token.Token) => token.positionStart.lineNumber)).to.deep.equal([
            0, 1, 2,
        ]);

        expect(original.text).to.equal("alpha\nbravo\ncharlie");
        expect(original.tokens[0]?.data).to.equal("alpha");
        assertPositions(repaired);
    });

    it("does not mutate settings or share scanner state with nested calls", () => {
        const text: string = '/// @type Foo\r\n/*a\nb*/ #"c\u2028d" value';
        let calls: number = 0;

        const settings: Lexer.LexSettings = Object.freeze({
            ...DefaultSettings,
            isTypeDirectiveAllowed: true,
            cancellationToken: {
                isCancelled: (): boolean => false,
                cancel: (): void => {},
                throwIfCancelled: (): void => {
                    calls += 1;
                    assertGetLexerSnapshot('/*nested*/ "x\ny"');
                },
            },
        });

        const tried: Lexer.TriedLex = Lexer.tryLex(settings, text);
        ResultUtils.assertIsOk(tried);
        const expected: Lexer.TriedLex = Lexer.tryLex({ ...DefaultSettings, isTypeDirectiveAllowed: true }, text);
        expect(tried).to.deep.equal(expected);
        expect(calls).to.be.greaterThan(1);
        assertPositions(tried.value);
    });

    it("does not expose retired line-scanning APIs", () => {
        for (const name of [
            "tryAppendLine",
            "tryUpdateLine",
            "tryUpdateRange",
            "tryDeleteLine",
            "trySnapshot",
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

        expect(Language.Token).not.to.have.property("LineTokenKind");
        expect(Language.Token).not.to.have.property("LineTokenKindAdditions");
    });

    it("preserves unexpected exceptions as common errors", () => {
        const failure: Error = new Error("custom cancellation failure");
        const locale: string = "fr-FR";

        const tried: Lexer.TriedLex = Lexer.tryLex(
            {
                ...DefaultSettings,
                locale,
                cancellationToken: {
                    isCancelled: (): boolean => false,
                    cancel: (): void => {},
                    throwIfCancelled: (): never => {
                        throw failure;
                    },
                },
            },
            "value",
        );

        ResultUtils.assertIsError(tried);
        expect(tried.error).to.be.instanceOf(CommonError.CommonError);
        expect(tried.error.innerError).to.be.instanceOf(CommonError.UnknownError);
        expect(tried.error.innerError).to.have.property("innerError", failure);
        expect(tried.error.message).to.equal(new CommonError.UnknownError(failure, locale).message);
    });
});
