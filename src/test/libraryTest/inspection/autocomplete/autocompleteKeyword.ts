// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, DefaultSettings, Inspection, Language } from "../../../..";
import { TestAssertUtils } from "../../../testUtils";

function assertGetParseOkAutocompleteOkKeyword(
    text: string,
    position: Inspection.Position,
): Inspection.AutocompleteKeyword {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseOkAutocompleteOk(
        DefaultSettings,
        text,
        position,
    );
    Assert.isOk(actual.triedKeyword);
    return actual.triedKeyword.value;
}

function assertGetParseErrAutocompleteOkKeyword(
    text: string,
    position: Inspection.Position,
): Inspection.AutocompleteKeyword {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseErrAutocompleteOk(
        DefaultSettings,
        text,
        position,
    );
    Assert.isOk(actual.triedKeyword);
    return actual.triedKeyword.value;
}

describe(`Inspection - Autocomplete - Keyword`, () => {
    it("|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`|`);
        const expected: Inspection.AutocompleteKeyword = [
            ...Language.Keyword.ExpressionKeywordKinds,
            Language.Keyword.KeywordKind.Section,
        ];
        const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
        expect(actual).to.have.members(expected);
    });

    describe("partial keyword", () => {
        it("a|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`a|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("x a|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`x a|`);
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.And,
                Language.Keyword.KeywordKind.As,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("e|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`e|`);
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.Each,
                Language.Keyword.KeywordKind.Error,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("if x then x e|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if x then x e|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Else];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("i|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`i|`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.If];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("l|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`l|`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Let];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("m|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`m|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("x m|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`x m|`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Meta];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("n|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`n|`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Not];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("true o|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `true o|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Or];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("try true o|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true o|`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.Or,
                Language.Keyword.KeywordKind.Otherwise,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("try true o |", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true o |`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("try true ot|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true ot|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Otherwise];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("try true oth|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true oth|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Otherwise];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`s|`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Section];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("[] |", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`[] |`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Section];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("[] |s", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`[] |s`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("[] s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`[] s|`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Section];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("[] s |", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`[] s |`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("section; s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; s|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Shared];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("section; shared x|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; shared x|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("section; [] s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; [] s|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Shared];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("if true t|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if true t|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Then];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it("t|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`t|`);
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.True,
                Language.Keyword.KeywordKind.Try,
                Language.Keyword.KeywordKind.Type,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`try |`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`try true|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.True];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`try true |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true |`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.And,
                Language.Keyword.KeywordKind.As,
                Language.Keyword.KeywordKind.Is,
                Language.Keyword.KeywordKind.Meta,
                Language.Keyword.KeywordKind.Or,
                Language.Keyword.KeywordKind.Otherwise,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if |error`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if error|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if error|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `error |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = (_ |) => a in x`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.As];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let x = (_ a|) => a in`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = (_ a|) => a in`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.As];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(` if |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if |`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if 1|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if |if`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if |if`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if i|f`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if i|f`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.If];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if if | `, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if if |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if 1 |`);
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Then];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 t|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 t|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Then];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1 e|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1 e|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Else];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1 else|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1 else|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 th|en 1 else`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 th|en 1 else`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Then];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1 else |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1 else |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`foo(|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`foo(a|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`foo(a|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`foo(a|,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `foo(a|,`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`foo(a,|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `foo(a,|`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`{1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`{1|,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1|,`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`{1,|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1,|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`{1,|2`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1,|2`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`{1,|2,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1,|2,`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`{1..|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1..|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise| false`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`try true otherwise |false`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise |false`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`try true oth|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true oth|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Otherwise];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+(|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a=|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a|=1`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a|=1`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|]`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1|]`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=|1]`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=| 1]`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseOkAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1,|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1,|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|,b`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1|,b`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|,b=`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1|,b=`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=|1,b=`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=|1,b=`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1,b=2|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1,b=2|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1,b=2 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1,b=2 |`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `error |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let x = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`() => |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `() => |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if |`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if true then |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if true then |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`if true then true else |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if true then true else |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`foo(|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let x = 1 in |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = 1 in |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+{|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+{|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+(|`);
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; [] |`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Shared];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`section; [] x |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; [] x |`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`section; x = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; x = |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`section; x = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; x = 1 |`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.And,
                Language.Keyword.KeywordKind.As,
                Language.Keyword.KeywordKind.Is,
                Language.Keyword.KeywordKind.Meta,
                Language.Keyword.KeywordKind.Or,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`section; x = 1 i|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; x = 1 i|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Is];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Language.Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1|`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 |`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.And,
                Language.Keyword.KeywordKind.As,
                Language.Keyword.KeywordKind.In,
                Language.Keyword.KeywordKind.Is,
                Language.Keyword.KeywordKind.Meta,
                Language.Keyword.KeywordKind.Or,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 | foobar`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 | foobar`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.And,
                Language.Keyword.KeywordKind.As,
                Language.Keyword.KeywordKind.In,
                Language.Keyword.KeywordKind.Is,
                Language.Keyword.KeywordKind.Meta,
                Language.Keyword.KeywordKind.Or,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 i|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 i|`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.In,
                Language.Keyword.KeywordKind.Is,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 o|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 o|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Or];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 m|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 m|`,
            );
            const expected: Inspection.AutocompleteKeyword = [Language.Keyword.KeywordKind.Meta];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1, |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1, |`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = let b = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = let b = |`,
            );
            const expected: Inspection.AutocompleteKeyword = Language.Keyword.ExpressionKeywordKinds;
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = let b = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = let b = 1 |`,
            );
            const expected: Inspection.AutocompleteKeyword = [
                Language.Keyword.KeywordKind.And,
                Language.Keyword.KeywordKind.As,
                Language.Keyword.KeywordKind.In,
                Language.Keyword.KeywordKind.Is,
                Language.Keyword.KeywordKind.Meta,
                Language.Keyword.KeywordKind.Or,
            ];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });

        it(`let a = let b = 1, |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = let b = 1, |`,
            );
            const expected: Inspection.AutocompleteKeyword = [];
            const actual: Inspection.AutocompleteKeyword = assertGetParseErrAutocompleteOkKeyword(text, position);
            expect(actual).to.have.members(expected);
        });
    });
});
