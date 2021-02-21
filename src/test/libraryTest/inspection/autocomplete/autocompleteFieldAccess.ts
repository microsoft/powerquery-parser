// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import {
    Assert,
    DefaultSettings,
    Inspection,
    InspectionSettings,
    LexSettings,
    Parser,
    ParseSettings,
} from "../../../..";
import { TestAssertUtils } from "../../../testUtils";

type AbridgedAutocompleteFieldAccess = ReadonlyArray<string>;

function abridgedFieldAccess(
    maybeAutocompleteFieldAccess: Inspection.AutocompleteFieldAccess | undefined,
): AbridgedAutocompleteFieldAccess {
    if (maybeAutocompleteFieldAccess === undefined) {
        return [];
    }

    return maybeAutocompleteFieldAccess.autocompleteItems.map((item: Inspection.AutocompleteItem) => item.key);
}

function assertGetParseOkAutocompleteOkFieldAccess<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseOkAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

function assertGetParseErrAutocompleteOkFieldAccess<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseErrAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][| c]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][| c]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c |]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["foo", "foobar"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2]|[`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2]|[`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][x|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c |`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["foo", "bar", "foobar"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });
    });

    describe("Projection", () => {
        describe("ParseOk", () => {
            it(`[cat = 1, car = 2][ [x|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [c |] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c |] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [x], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x], [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [car], [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ |`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ c|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ c|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat |`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ] |`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ] |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], |`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|<>`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [| <>`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, () => {
                const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [<>|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let fn = () => [cat = 1, car = 2] in fn()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [`regularIdentifier`, `#"generalized identifier"`];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });
});
