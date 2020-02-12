// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../..";
import { ResultUtils } from "../../../common";
import { ScopeItemKind } from "../../../inspection";
import { Ast } from "../../../parser";
import {
    expectDeepEqual,
    expectParseErrInspection,
    expectParseOkInspection,
    expectTextWithPosition,
} from "../../common";

type AbridgedScope = ReadonlyArray<AbridgedScopeItem>;

interface AbridgedScopeItem {
    readonly key: string;
    readonly kind: ScopeItemKind;
}

function actualFactoryFn(triedInspection: Inspection.TriedInspection): AbridgedScope {
    if (!ResultUtils.isOk(triedInspection)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedInspection): ${triedInspection.error.message}`);
    }
    const inspected: Inspection.Inspected = triedInspection.value;

    const abridgedScopeItems: AbridgedScopeItem[] = [];
    for (const [key, scopeItem] of inspected.scope.entries()) {
        abridgedScopeItems.push({
            key,
            kind: scopeItem.kind,
        });
    }

    return abridgedScopeItems;
}

describe(`Inspection - Scope - Identifier`, () => {
    describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
        it(`|each 1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|each 1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`each| 1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each| 1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`each |1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |1`);
            const expected: AbridgedScope = [
                {
                    kind: ScopeItemKind.Each,
                    key: "_",
                },
            ];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`each 1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each 1|`);
            const expected: AbridgedScope = [
                {
                    kind: ScopeItemKind.Each,
                    key: "_",
                },
            ];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`each each 1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each each 1|`);
            const expected: AbridgedScope = [
                {
                    kind: ScopeItemKind.Each,
                    key: "_",
                },
            ];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
        it(`each|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`each |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |`);
            const expected: AbridgedScope = [
                {
                    kind: ScopeItemKind.Each,
                    key: "_",
                },
            ];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
        it(`|(x) => z`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) => z`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`(x|, y) => z`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) => z`);
            const expected: AbridgedScope = [
                {
                    kind: ScopeItemKind.Parameter,
                    key: "x",
                },
            ];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`(x, y)| => z`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| => z`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`(x, y) => z|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) => z|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
        it(`|(x) =>`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) =>`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`(x|, y) =>`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) =>`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`(x, y)| =>`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| =>`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`(x, y) =>|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) =>|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
        it(`|foo`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`f|oo`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`f|oo`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`|@foo`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|@foo`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`@|foo`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@|foo`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`@f|oo`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@f|oo`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`@foo|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@foo|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression} (Ast)`, () => {
        it(`|foo(x)`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo(x)`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(x, y|)`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y|)`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(x, y)|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y)|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[x](y|)`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[x](y|)`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(|)`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|)`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression} (ParserContext)`, () => {
        it(`|foo(x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo(x`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(x, y|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(x,|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x,|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`foo(x, |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, |`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[x](y|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[x](y|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.ListExpression} (ParserContext)`, () => {
        it(`|{1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|{1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`{|1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`{1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`{{|1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{{|1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
        it(`|[a=1]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1]`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[|a=1]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1]`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1|]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|]`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1, b=2|]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|]`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1, b=2|, c=3]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3]`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1]|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1]|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=[|b=1]]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1]]`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
        it(`|[a=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[|a=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=|1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=|1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1, b=|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=1, b=2|, c=3`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=[|b=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`[a=[b=|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[b=|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.SectionMember} (Ast)`, () => {
        it(`s|ection foo; x = 1; y = 2;`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `s|ection foo; x = 1; y = 2;`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1|; y = 2;`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1|; y = 2;`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1; y = 2|;`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1; y = 2|;`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1; y = 2;|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1; y = 2;|`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1; y = 2; z = let a = 1 in |b;`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
        it(`s|ection foo; x = 1; y = 2`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `s|ection foo; x = 1; y = 2`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1|; y = 2`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1|; y = 2`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1; y = 2|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1; y = 2|`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1; y = () => 10|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1; y = () => 10|`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
        it(`let a = 1 in |x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |x`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = 1 in x|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in x|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = |1 in x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = |1 in x`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = 1, b = 2 in x|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in x|`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = 1|, b = 2 in x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in x`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `(p1, p2) => let a = 1, b = 2, c = 3| in c`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });

        it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
        it(`let a = 1 in |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = 1, b = 2 in |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in |`);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = 1|, b = 2 in`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in `);
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`let a = 1, b = 2, c = 3 in |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let a = 1, b = 2, c = 3 in |`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`let x = (let y = 1 in z|) in`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let x = (let y = 1 in z|) in`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });

        it(`let x = (let y = 1 in z) in |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let x = (let y = 1 in z) in |`,
            );
            const expected: AbridgedScope = [];
            expectDeepEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });
});
