// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { ResultKind } from "../../common";
import { Ast } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection } from "./common";

type AbridgedScope = ReadonlyArray<string>;

function expectAbridgedInspectionEqual(triedInspection: Inspection.TriedInspection, expected: AbridgedScope): void {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: AbridgedScope = [...inspection.scope.keys()];

    expect(actual).deep.equal(expected);
}

// Only works with single line expressions
function textWithPosition(text: string): [string, Inspection.Position] {
    const indexOfBar: number = text.indexOf("|");

    expect(indexOfBar).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfBar).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Inspection.Position = {
        lineNumber: 0,
        lineCodeUnit: indexOfBar,
    };

    return [text.replace("|", ""), position];
}

describe(`Inspection`, () => {
    describe(`Scope`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
            it(`|each 1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|each 1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`each 1|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`each 1|`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`each each 1|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`each each 1|`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
            it(`|each`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|each`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`each|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`each|`);
                const expected: AbridgedScope = ["_"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|(x) => z`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(x|, y) => z`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`(x|, y) => z`);
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(x, y)| => z`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`(x, y)| => z`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(x, y) => z|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`(x, y) => z|`);
                const expected: AbridgedScope = ["z", "x", "y"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|(x) =>`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`(x|, y) =>`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`(x|, y) =>`);
                const expected: AbridgedScope = ["x"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`(x, y)| =>`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`(x, y)| =>`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`(x, y) =>|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`(x, y) =>|`);
                const expected: AbridgedScope = ["x", "y"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`|foo`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|foo`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`f|oo`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`f|oo`);
                const expected: AbridgedScope = ["foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo|`);
                const expected: AbridgedScope = ["foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`|@foo`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|@foo`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`@|foo`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`@|foo`);
                const expected: AbridgedScope = ["@foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`@f|oo`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`@f|oo`);
                const expected: AbridgedScope = ["@foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`@foo|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`@foo|`);
                const expected: AbridgedScope = ["@foo"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression} (Ast)`, () => {
            it(`|foo(x)`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|foo(x)`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo(x, y|)`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(x, y|)`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo(x, y)|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(x, y)|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[x](y|)`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[x](y|)`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`foo(|)`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(|)`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression} (ParserContext)`, () => {
            it(`|foo(x`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|foo(x`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(x, y|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(x, y|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(x,|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(x,|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(x, |`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`foo(x, |`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[x](y|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[x](y|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression} (ParserContext)`, () => {
            it(`|{1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|{1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{|1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`{|1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`{1|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{{|1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`{{|1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[a=1]`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|[a=1]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[|a=1]`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[|a=1]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1|]`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1|]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1, b=2|]`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1, b=2|]`);
                const expected: AbridgedScope = ["a"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1, b=2|, c=3]`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1, b=2|, c=3]`);
                const expected: AbridgedScope = ["a", "c"];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=1]|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1]|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[a=[|b=1]]`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=[|b=1]]`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[a=1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`|[a=1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[|a=1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[|a=1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=|1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=|1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1, b=|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1, b=|`);
                const expected: AbridgedScope = ["a"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1, b=2|, c=3`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=1, b=2|, c=3`);
                const expected: AbridgedScope = ["a", "c"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=[|b=1`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=[|b=1`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=[b=|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`[a=[b=|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`s|ection foo; x = 1; y = 2;`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`section foo; x = 1|; y = 2;`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`section foo; x = 1|; y = 2;`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`section foo; x = 1; y = 2;|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`section foo; x = 1; y = 2;|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`section foo; x = 1; y = 2; z = let a = 1 in |a;`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(
                    `section foo; x = 1; y = 2; z = let a = 1 in |a;`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            // TODO (issue #61): should we be providing scope members if cursor is on section declaration?
            it(`s|ection foo; x = 1; y = 2`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`s|ection foo; x = 1; y = 2`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`section foo; x = 1|; y = 2`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`section foo; x = 1|; y = 2`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`section foo; x = 1; y = 2|`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`section foo; x = 1; y = 2|`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1, b = 2, c = |3 in c`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(
                    `let a = 1, b = 2, c = |3 in c`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`(p1, p2) => let a = 1, b = 2, c = |3 in c`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(
                    `(p1, p2) => let a = 1, b = 2, c = |3 in c`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let a = let a1 = 1 in a1, b = 2, c = |3 in c`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(
                    `let a = let a1 = 1 in a1, b = 2, c = |3 in c`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let a = let a1 = 1 in |a1, b = 2, c = 3 in c`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(
                    `let a = let a1 = 1 in |a1, b = 2, c = 3 in c`,
                );
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1, b = 2, c = 3 in |`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(
                    `let a = 1, b = 2, c = 3 in |`,
                );
                const expected: AbridgedScope = ["a", "b", "c"];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let a = let a = 1 in | in a`, () => {
                const [text, position]: [string, Inspection.Position] = textWithPosition(`let a = let a = 1 in | in a`);
                const expected: AbridgedScope = [];
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });
    });
});
