// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { ResultKind } from "../../common";
import { Ast } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection, expectTextWithPosition } from "./common";

type AbridgedScope = ReadonlyArray<string>;

function expectAbridgedInspectionEqual(triedInspection: Inspection.TriedInspection, expected: AbridgedScope): void {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: AbridgedScope = [...inspection.scope.keys()];

    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`qweasdzxc Identifier`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
            it(`|each 1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|each 1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`each| 1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each| 1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`each |1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |1`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`each 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each 1|`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`each each 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each each 1|`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
            it(`each|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`each |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) => z`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(x|, y) => z`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) => z`);
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(x, y)| => z`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| => z`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(x, y) => z|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) => z|`);
                const expected: AbridgedScope = ["z", "x", "y"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) =>`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`(x|, y) =>`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) =>`);
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`(x, y)| =>`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| =>`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`(x, y) =>|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) =>|`);
                const expected: AbridgedScope = ["x", "y"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`|foo`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`f|oo`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`f|oo`);
                const expected: AbridgedScope = ["foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo|`);
                const expected: AbridgedScope = ["foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`|@foo`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|@foo`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`@|foo`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@|foo`);
                const expected: AbridgedScope = ["@foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`@f|oo`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@f|oo`);
                const expected: AbridgedScope = ["@foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`@foo|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@foo|`);
                const expected: AbridgedScope = ["@foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression} (Ast)`, () => {
            it(`|foo(x)`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo(x)`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo(x, y|)`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y|)`);
                const expected: AbridgedScope = ["y"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo(x, y)|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y)|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[x](y|)`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[x](y|)`);
                const expected: AbridgedScope = ["y"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo(|)`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|)`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression} (ParserContext)`, () => {
            it(`|foo(x`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo(x`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(x, y|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y|`);
                const expected: AbridgedScope = ["y"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(x,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x,|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(x, |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, |`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[x](y|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[x](y|`);
                const expected: AbridgedScope = ["y"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression} (ParserContext)`, () => {
            it(`|{1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|{1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{|1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{{|1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{{|1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[a=1]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[|a=1]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1, b=2|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|]`);
                const expected: AbridgedScope = ["a"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1, b=2|, c=3]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3]`);
                const expected: AbridgedScope = ["a", "c"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1]|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1]|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=[|b=1]]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1]]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[a=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[|a=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=|1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=|1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1, b=|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=|`);
                const expected: AbridgedScope = ["a"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1, b=2|, c=3`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3`);
                const expected: AbridgedScope = ["a", "c"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=[|b=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=[b=|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[b=|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `s|ection foo; x = 1; y = 2;`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`abc123 section foo; x = 1|; y = 2;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1|; y = 2;`,
                );
                const expected: AbridgedScope = ["y"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`abc123 section foo; x = 1; y = 2|;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2|;`,
                );
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`section foo; x = 1; y = 2;|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2;|`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`abc123 section foo; x = 1; y = 2; z = let a = 1 in |b;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2; z = let a = 1 in |b;`,
                );
                const expected: AbridgedScope = ["a", "x", "y"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            it(`s|ection foo; x = 1; y = 2`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `s|ection foo; x = 1; y = 2`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`section foo; x = 1|; y = 2`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1|; y = 2`,
                );
                const expected: AbridgedScope = ["y"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`section foo; x = 1; y = 2|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2|`,
                );
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1 in x|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in x|`);
                const expected: AbridgedScope = ["x", "a"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let a = |1 in x`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = |1 in x`);
                const expected: AbridgedScope = ["a"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let a = 1, b = 2 in x|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let a = 1, b = 2 in x|`,
                );
                const expected: AbridgedScope = ["x", "a", "b"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let a = 1|, b = 2 in x`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let a = 1|, b = 2 in x`,
                );
                const expected: AbridgedScope = ["b"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `(p1, p2) => let a = 1, b = 2, c = 3| in c`,
                );
                const expected: AbridgedScope = ["a", "b", "p1", "p2"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
                );
                const expected: AbridgedScope = ["eggs", "foo", "bar"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
                );
                const expected: AbridgedScope = ["ham", "foo", "bar"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1 in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |`);
                const expected: AbridgedScope = ["a"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let a = 1, b = 2 in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in |`);
                const expected: AbridgedScope = ["a", "b"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let a = 1|, b = 2 in`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in `);
                const expected: AbridgedScope = ["b"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let a = 1, b = 2, c = 3 in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let a = 1, b = 2, c = 3 in |`,
                );
                const expected: AbridgedScope = ["a", "b", "c"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let x = (let y = 1 in z|) in`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = (let y = 1 in z|) in`,
                );
                const expected: AbridgedScope = ["z", "y"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let x = (let y = 1 in z) in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = (let y = 1 in z) in |`,
                );
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });
    });
});
