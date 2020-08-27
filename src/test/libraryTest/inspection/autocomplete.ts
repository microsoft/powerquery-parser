// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Language } from "../../..";
import { Assert } from "../../../common";
import { Position, StartOfDocumentKeywords, TriedAutocomplete } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap, ParseContext, ParseError } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { assertParseErr, assertParseOk, assertTextWithPosition } from "../../testUtils/assertUtils";

function assertAutocompleteOk<S extends IParserState>(
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
        return StartOfDocumentKeywords;
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

function assertParseOkAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): ReadonlyArray<Language.KeywordKind> {
    const contextState: ParseContext.State = assertParseOk(settings, text).state.contextState;
    return assertAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        undefined,
    );
}

function assertParseErrAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): ReadonlyArray<Language.KeywordKind> {
    const parseError: ParseError.ParseError<S> = assertParseErr(settings, text);
    const contextState: ParseContext.State = assertParseErr(settings, text).state.contextState;
    return assertAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        parseError,
    );
}

describe(`Inspection - Autocomplete`, () => {
    it("|", () => {
        const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`|`);
        const expected: ReadonlyArray<Language.KeywordKind> = [
            ...Language.ExpressionKeywords,
            Language.KeywordKind.Section,
        ];
        expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
    });

    describe("partial keyword", () => {
        it("a|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`a|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("x a|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`x a|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.And, Language.KeywordKind.As];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("e|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`e|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.Each,
                Language.KeywordKind.Error,
            ];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("if x then x e|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if x then x e|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Else];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("i|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`i|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.If];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("l|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`l|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Let];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("m|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`m|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("x m|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`x m|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Meta];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("n|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`n|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Not];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("true o|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`true o|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Or];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("try true o|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true o|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.Or,
                Language.KeywordKind.Otherwise,
            ];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("try true o |", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true o |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("try true ot|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true ot|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("try true oth|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("s|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Section];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("[] s|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`[] s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Section];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("section; s|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`section; s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Shared];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("section; shared x|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`section; shared x|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("section; [] s|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`section; [] s|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Shared];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("if true t|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if true t|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it("t|", () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`t|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.True,
                Language.KeywordKind.Try,
                Language.KeywordKind.Type,
            ];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`try true|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.True];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`try true |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.And,
                Language.KeywordKind.As,
                Language.KeywordKind.Is,
                Language.KeywordKind.Meta,
                Language.KeywordKind.Or,
                Language.KeywordKind.Otherwise,
            ];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if |error`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if error|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if error|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`error |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let x = (_ |) => a in x`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.As];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let x = (_ a|) => a in`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let x = (_ a|) => a in`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.As];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(` if |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if |if`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if |if`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if i|f`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if i|f`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.If];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if if | `, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if if |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 t|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 t|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 then |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 then |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 then 1|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 then 1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 then 1 e|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 then 1 e|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Else];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 then 1 else|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 then 1 else|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 th|en 1 else`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 th|en 1 else`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Then];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if 1 then 1 else |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if 1 then 1 else |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`foo(a|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`foo(a|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`foo(a|,`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`foo(a|,`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`foo(a,|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`foo(a,|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`{1|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`{1|,`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{1|,`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`{1,|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{1,|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`{1,|2`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{1,|2`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`{1,|2,`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{1,|2,`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`{1..|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`{1..|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true otherwise| false`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`try true otherwise |false`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true otherwise |false`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`try true oth|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Otherwise];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a|=1`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a|=1`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1|]`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1|]`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=|1]`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=| 1]`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseOkAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1|,`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1,|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1,|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1|,b`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1|,b`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1|,b=`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1|,b=`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=|1,b=`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=|1,b=`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1,b=2|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1,b=2|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+[a=1,b=2 |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+[a=1,b=2 |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`error |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let x = |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let x = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`() => |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`() => |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if true then |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if true then |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`if true then true else |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`if true then true else |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`foo(|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let x = 1 in |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let x = 1 in |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+{|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+{|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`+(|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`section; [] |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Shared];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`section; [] x |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`section; [] x |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`section; x = |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`section; x = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
            );
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = 1|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = 1|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = 1 |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.And,
                Language.KeywordKind.As,
                Language.KeywordKind.In,
                Language.KeywordKind.Is,
                Language.KeywordKind.Meta,
                Language.KeywordKind.Or,
            ];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = 1 o|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = 1 o|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Or];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = 1 m|`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = 1 m|`);
            const expected: ReadonlyArray<Language.KeywordKind> = [Language.KeywordKind.Meta];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = 1, |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = 1, |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = let b = |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = let b = |`);
            const expected: ReadonlyArray<Language.KeywordKind> = Language.ExpressionKeywords;
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = let b = 1 |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = let b = 1 |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [
                Language.KeywordKind.And,
                Language.KeywordKind.As,
                Language.KeywordKind.In,
                Language.KeywordKind.Is,
                Language.KeywordKind.Meta,
                Language.KeywordKind.Or,
            ];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });

        it(`let a = let b = 1, |`, () => {
            const [text, position]: [string, Inspection.Position] = assertTextWithPosition(`let a = let b = 1, |`);
            const expected: ReadonlyArray<Language.KeywordKind> = [];
            expect(assertParseErrAutocompleteOk(DefaultSettings, text, position)).to.have.members(expected);
        });
    });
});
