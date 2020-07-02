// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Language } from "../../..";
import { Assert } from "../../../common";
import { Position, StartOfDoctumentKeywords, TriedAutocomplete } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap, ParseContext, ParseError } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

function expectAutocompleteOk<S extends IParserState>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
    maybeParseError: ParseError.ParseError<S> | undefined,
): ReadonlyArray<Language.KeywordKind> {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return StartOfDoctumentKeywords;
    }

    const triedInspect: TriedAutocomplete = Inspection.tryAutocomplete(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        maybeParseError,
    );
    Assert.isOk(triedInspect);
    return triedInspect.value;
}

function expectParseOkAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): ReadonlyArray<Language.KeywordKind> {
    const contextState: ParseContext.State = expectParseOk(settings, text).state.contextState;
    return expectAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        undefined,
    );
}

function expectParseErrAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): ReadonlyArray<Language.KeywordKind> {
    const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
    const contextState: ParseContext.State = expectParseErr(settings, text).state.contextState;
    return expectAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        parseError,
    );
}

describe(`Inspection - Autocomplete`, () => {
    it("|", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|`);
        const expected: ReadonlyArray<Language.KeywordKind> = [
            ...Language.ExpressionKeywords,
            Language.KeywordKind.Section,
        ];
        expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
    });

    describe("partial keyword", () => {
        it("a|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`a|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("x a|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`x a|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.And, Language.KeywordKind.As];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("e|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`e|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.Each,
                Language.KeywordKind.Error,
            ];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("if x then x e|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if x then x e|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Else];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("i|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`i|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.If];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("l|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`l|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Let];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("m|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`m|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("x m|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`x m|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Meta];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("n|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`n|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Not];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("true o|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`true o|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Or];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("try true o|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true o|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.Or,
                Language.KeywordKind.Otherwise,
            ];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("try true o |", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true o |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("try true ot|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true ot|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("try true oth|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("s|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Section];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("[] s|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[] s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Section];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("section; s|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Shared];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("section; shared x|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; shared x|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("section; [] s|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Shared];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("if true t|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if true t|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it("t|", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`t|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.True,
                Language.KeywordKind.Try,
                Language.KeywordKind.Type,
            ];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`try true|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.True];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`try true |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |error`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if error|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if error|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`error |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if |if`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |if`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if i|f`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if i|f`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.If];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 t|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 t|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 then |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 then 1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 then 1 e|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 e|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Else];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 then 1 else|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 else|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 th|en 1 else`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 th|en 1 else`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if 1 then 1 else |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 else |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`foo(a|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`foo(a|,`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a|,`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`foo(a,|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a,|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`{1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`{1|,`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|,`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`{1,|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`{1,|2`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|2`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`{1,|2,`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|2,`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`{1..|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1..|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true otherwise| false`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`try true otherwise |false`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true otherwise |false`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`try true oth|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a|=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a|=1`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1|]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|]`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=| 1]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=| 1]`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1|,`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1,|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1|,b`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|,b`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1|,b=`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|,b=`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=|1,b=`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=|1,b=`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1,b=2|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,b=2|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+[a=1,b=2 |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,b=2 |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    // Map the ordering of tests to autocomplete.ts::AutocompleteExpressionKeys
    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`error |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`let x = |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`let x = |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if true then |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if true then |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`if true then true else |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if true then true else |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`let x = 1 in |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = 1 in |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+{|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+{|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`section; [] x |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] x |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`section; x = |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; x = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; x = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
        });
    });
});
