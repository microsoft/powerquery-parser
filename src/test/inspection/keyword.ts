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

type AbridgedInspection = [Inspected["allowedKeywords"], Inspected["maybeRequiredKeyword"]];

function expectNodesEqual(triedInspection: Inspection.TriedInspection, expected: AbridgedInspection): void {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: AbridgedInspection = [inspection.allowedKeywords, inspection.maybeRequiredKeyword];

    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`abc123 Keyword`, () => {
        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`try true |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true |`);
                const expected: AbridgedInspection = [[KeywordKind.Otherwise], undefined];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`error |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
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

            it(`if 1 true |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 true |`);
                const expected: AbridgedInspection = [[], KeywordKind.Then];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|,`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`{1,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|`);
                const expected: AbridgedInspection = [TExpressionKeywords, undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
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
            it(`[|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|,]`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[a=1,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1,|`);
                const expected: AbridgedInspection = [[], undefined];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember}`, () => {
            it(`section; [] |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] |`);
                const expected: AbridgedInspection = [[KeywordKind.Shared], undefined];
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
