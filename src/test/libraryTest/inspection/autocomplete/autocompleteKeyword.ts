// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../common";
import { AutocompleteOption, Position, TriedAutocomplete } from "../../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../../inspection/activeNode";
import { Ast, Keyword } from "../../../../language";
import { IParserState, IParserStateUtils, NodeIdMap, ParseContext, ParseError, ParseOk } from "../../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

function assertGetAutocompleteOk<S extends IParserState>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
    maybeParseError: ParseError.ParseError<S> | undefined,
): ReadonlyArray<AutocompleteOption> {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return Keyword.StartOfDocumentKeywords;
    }

    const triedInspect: TriedAutocomplete = Inspection.tryAutocomplete(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        maybeActiveNode,
        maybeParseError,
    );
    Assert.isOk(triedInspect);
    return triedInspect.value;
}

function assertGetParseOkAutocompleteOk(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): ReadonlyArray<AutocompleteOption> {
    const parseOk: ParseOk = TestAssertUtils.assertGetParseOk(settings, text, IParserStateUtils.stateFactory);
    const contextState: ParseContext.State = parseOk.state.contextState;
    return assertGetAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        undefined,
    );
}

function assertGetParseErrAutocompleteOk(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): ReadonlyArray<AutocompleteOption> {
    const parseError: ParseError.ParseError = TestAssertUtils.assertGetParseErr(
        settings,
        text,
        IParserStateUtils.stateFactory,
    );
    const contextState: ParseContext.State = parseError.state.contextState;

    return assertGetAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        parseError,
    );
}

describe(`Inspection - Autocomplete - Keyword`, () => {
    it("|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`|`);
        const expected: ReadonlyArray<AutocompleteOption> = [
            ...Keyword.ExpressionKeywordKinds,
            Keyword.KeywordKind.Section,
        ];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    describe("partial keyword", () => {
        it("a|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`a|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("x a|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`x a|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.And, Keyword.KeywordKind.As];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("e|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`e|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Each, Keyword.KeywordKind.Error];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("if x then x e|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if x then x e|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Else];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("i|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`i|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.If];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("l|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`l|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Let];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("m|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`m|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("x m|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`x m|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Meta];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("n|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`n|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Not];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("true o|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `true o|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Or];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("try true o|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true o|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Or, Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("try true o |", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true o |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("try true ot|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true ot|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("try true oth|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true oth|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`s|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Section];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("[] s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`[] s|`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Section];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("section; s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; s|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Shared];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("section; shared x|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; shared x|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("section; [] s|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; [] s|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Shared];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("if true t|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if true t|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it("t|", () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`t|`);
            const expected: ReadonlyArray<AutocompleteOption> = [
                Keyword.KeywordKind.True,
                Keyword.KeywordKind.Try,
                Keyword.KeywordKind.Type,
            ];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`try |`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`try true|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.True];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`try true |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.Otherwise,
            ];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if |error`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if error|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if error|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `error |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = (_ |) => a in x`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.As];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let x = (_ a|) => a in`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = (_ a|) => a in`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.As];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(` if |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if |`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if 1|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if |if`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if |if`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if i|f`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if i|f`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.If];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if if | `, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if if |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if 1 |`);
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 t|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 t|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1 e|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1 e|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Else];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1 else|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1 else|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 th|en 1 else`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 th|en 1 else`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if 1 then 1 else |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if 1 then 1 else |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`foo(a|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`foo(a|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`foo(a|,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `foo(a|,`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`foo(a,|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `foo(a,|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`{1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`{1|,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1|,`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`{1,|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1,|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`{1,|2`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1,|2`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`{1,|2,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1,|2,`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`{1..|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`{1..|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise| false`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`try true otherwise |false`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise |false`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`try true oth|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true oth|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+(|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a=|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a|=1`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a|=1`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|]`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1|]`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=|1]`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=| 1]`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|,`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1,|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1,|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|,b`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1|,b`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1|,b=`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1|,b=`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=|1,b=`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=|1,b=`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1,b=2|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1,b=2|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+[a=1,b=2 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `+[a=1,b=2 |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `error |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let x = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`() => |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `() => |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`if |`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if true then |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if true then |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`if true then true else |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `if true then true else |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let x = 1 in |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let x = 1 in |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+{|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+{|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `try true otherwise |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`+(|`);
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; [] |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Shared];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`section; [] x |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; [] x |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`section; x = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; x = |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`section; x = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; x = 1 |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
            ];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`section; x = 1 i|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section; x = 1 i|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Is];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.In,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
            ];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 | foobar`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 | foobar`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.In,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
            ];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 i|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 i|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.In, Keyword.KeywordKind.Is];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 o|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 o|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Or];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1 m|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1 m|`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [Keyword.KeywordKind.Meta];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = 1, |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = 1, |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = let b = |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = let b = |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = let b = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = let b = 1 |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.In,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
            ];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let a = let b = 1, |`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let a = let b = 1, |`,
            );
            const expected: ReadonlyArray<AutocompleteOption> = [];
            const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });
});
