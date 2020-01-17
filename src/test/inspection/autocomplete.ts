// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { ResultKind } from "../../common";
import { Inspected } from "../../inspection";
import { KeywordKind, TExpressionKeywords } from "../../lexer";
import { Ast } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection, expectTextWithPosition } from "./common";

type AbridgedInspection = [Inspected["allowedAutocompleteKeywords"], Inspected["maybeRequiredAutocomplete"]];

function expectNodesEqual(triedInspection: Inspection.TriedInspection, expected: AbridgedInspection): void {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: AbridgedInspection = [inspection.allowedAutocompleteKeywords, inspection.maybeRequiredAutocomplete];

    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`qweasdzxc Autocomplete`, () => {
        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`try true|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`try true |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true |`);
                const expected: AbridgedInspection = [[], Ast.ConstantKind.Otherwise];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`if |error`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |error`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if error|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if error|`);
                const expected: AbridgedInspection = [[], KeywordKind.Error];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`error |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`error |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if|`);
                const expected: AbridgedInspection = [[], Ast.ConstantKind.If];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if |if`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |if`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if i|f`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if i|f`);
                const expected: AbridgedInspection = [[], Ast.ConstantKind.If];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 |`);
                const expected: AbridgedInspection = [[], KeywordKind.Then];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 t|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 t|`);
                const expected: AbridgedInspection = [[], KeywordKind.Then];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 then |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 then 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 then 1 e|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 e|`);
                const expected: AbridgedInspection = [[], KeywordKind.Else];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 then 1 else|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 else|`);
                const expected: AbridgedInspection = [[], Ast.ConstantKind.Else];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 th|en 1 else`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 th|en 1 else`);
                const expected: AbridgedInspection = [[], Ast.ConstantKind.Then];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`if 1 then 1 else |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 else |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression}`, () => {
            it(`foo(|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(a|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(a|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a|,`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`foo(a,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a,|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|,`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1,|2`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|2`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1,|2,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|2,`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1..|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1..|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
            it(`try true otherwise| false`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `try true otherwise| false`,
                );
                const expected: AbridgedInspection = [[], KeywordKind.Otherwise];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`abc123 try true otherwise |false`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `try true otherwise| false`,
                );
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`try true oth|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true oth|`);
                const expected: AbridgedInspection = [[], KeywordKind.Otherwise];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`try true otherwise |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true otherwise |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
            it(`+(|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+(|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`+[|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[|`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`+[a=1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`+[a=1|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`+[a=1,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,|`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`+[a=1|,b`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|,b`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`+[a=1|,b=`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|b=`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`+[a=1,b=2|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,b=2|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember}`, () => {
            it(`section; [] |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] |`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`section; [] x |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] x |`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`section; x = |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; x = |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });
    });
});
