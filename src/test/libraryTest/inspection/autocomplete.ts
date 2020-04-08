// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../..";
import { ResultUtils } from "../../../common";
import { Position, TriedAutocomplete } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { KeywordKind, TExpressionKeywords } from "../../../lexer";
import { Ast, IParserState, NodeIdMap, ParseError, ParseOk } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

function expectAutocompleteOk<S>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
    maybeParseError: ParseError.ParseError<S> | undefined
): ReadonlyArray<KeywordKind> {
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds
    );
    const triedInspect: TriedAutocomplete = Inspection.tryAutocomplete(
        settings,
        maybeActiveNode,
        nodeIdMapCollection,
        maybeParseError
    );
    if (!ResultUtils.isOk(triedInspect)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedInspect): ${triedInspect.error.message}`);
    }
    return triedInspect.value;
}

function expectParseOkAutocompleteOk<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position
): ReadonlyArray<KeywordKind> {
    const parseOk: ParseOk<S> = expectParseOk(settings, text);
    return expectAutocompleteOk(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position, undefined);
}

function expectParseErrAutocompleteOk<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position
): ReadonlyArray<KeywordKind> {
    const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
    return expectAutocompleteOk(
        settings,
        parseError.state.contextState.nodeIdMapCollection,
        parseError.state.contextState.leafNodeIds,
        position,
        parseError
    );
}

describe(`Inspection`, () => {
    describe(`Autocomplete`, () => {
        describe("partial keyword", () => {
            it("a|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`a|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("x a|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`x a|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.And, KeywordKind.As];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("e|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`e|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Each, KeywordKind.Error];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("if x then x e|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if x then x e|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Else];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("i|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`i|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.If];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("l|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`l|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Let];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("m|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`m|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("x m|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`x m|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Meta];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("n|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`n|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Not];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("true o|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`true o|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Or];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("try true o|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true o|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Or, KeywordKind.Otherwise];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("try true o |", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true o |`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("try true ot|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true ot|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Otherwise];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("try true oth|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true oth|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Otherwise];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("s|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`s|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Section];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("[] s|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[] s|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Section];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("section; s|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; s|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Shared];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("section; shared x|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; shared x|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("section; [] s|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] s|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Shared];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("if true t|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if true t|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Then];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it("t|", () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`t|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.True, KeywordKind.Try, KeywordKind.Type];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`try true|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.True];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`try true |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true |`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Otherwise];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`if |error`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |error`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if error|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if error|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`error |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`error |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if |if`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if |if`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if i|f`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if i|f`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.If];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 |`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Then];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 t|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 t|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Then];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 then |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 then 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 then 1 e|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 e|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Else];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 then 1 else|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 else|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 th|en 1 else`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 th|en 1 else`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Then];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`if 1 then 1 else |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`if 1 then 1 else |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression}`, () => {
            it(`foo(|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`foo(a|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`foo(a|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a|,`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`foo(a,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(a,|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`{1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`{1|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|,`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`{1,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`{1,|2`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|2`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`{1,|2,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1,|2,`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`{1..|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1..|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
            it(`try true otherwise| false`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `try true otherwise| false`
                );
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`try true otherwise |false`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `try true otherwise |false`
                );
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`try true oth|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true oth|`);
                const expected: ReadonlyArray<KeywordKind> = [KeywordKind.Otherwise];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`try true otherwise |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`try true otherwise |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
            it(`+(|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+(|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`+[|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=|`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a|=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a|=1`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|]`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=| 1]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=| 1]`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseOkAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1|,`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1,|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1|,b`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|,b`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1|,b=`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1|,b=`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=|1,b=`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=|1,b=`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1,b=2|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,b=2|`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`+[a=1,b=2 |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`+[a=1,b=2 |`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember}`, () => {
            it(`section; [] |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] |`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`section; [] x |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; [] x |`);
                const expected: ReadonlyArray<KeywordKind> = [];
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });

            it(`section; x = |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`section; x = |`);
                const expected: ReadonlyArray<KeywordKind> = TExpressionKeywords;
                expect(expectParseErrAutocompleteOk(DefaultSettings, text, position)).deep.equal(expected);
            });
        });
    });
});
