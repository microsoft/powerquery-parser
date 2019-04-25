import "mocha";
import { CommentKind, TokenKind } from "../../lexer";
import { AbridgedComments, expectSnapshotAbridgedComments, AbridgedSnapshot, expectSnapshotAbridgedSnapshot, expectSnapshotAbridgedTokens, AbridgedTokens } from "./common";

const LINE_TERMINATOR = "\n"

describe(`Lexer`, () => {

    describe(`MultilineTokens Abridged LexerSnapshot`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const document = `/**/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/**/`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`/* */`, () => {
                const document = `/* */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* */`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`/* X */`, () => {
                const document = `/* X */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* X */`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const document = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const document = `abc /*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedSnapshot =
                {
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                    tokens: [[TokenKind.Identifier, `abc`]],
                };
                expectSnapshotAbridgedSnapshot(document, LINE_TERMINATOR, expected);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const document = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/ abc`;
                const expected: AbridgedSnapshot = {
                    tokens: [[TokenKind.Identifier, `abc`]],
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]]
                };
                expectSnapshotAbridgedSnapshot(document, LINE_TERMINATOR, expected);
            });
        });

        describe(`StringLiteral`, () => {
            it(`"X"`, () => {
                const document = `"X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X"`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected);
            });

            it(`"X\\nX\\nX"`, () => {
                const document = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const document = `abc "X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const document = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X" abc`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected);
            });
        });
    })
});
