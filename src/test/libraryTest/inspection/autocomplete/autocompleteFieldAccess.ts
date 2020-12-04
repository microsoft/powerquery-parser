// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../powerquery-parser/common";
import { AutocompleteItem } from "../../../../inspection";
import { IParseState } from "../../../../parser";
import { DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { TestAssertUtils } from "../../../testUtils";

type AbridgedAutocompleteFieldAccess = ReadonlyArray<string>;

function abridgedFieldAccess(
    maybeAutocompleteFieldAccess: Inspection.AutocompleteFieldAccess | undefined,
): AbridgedAutocompleteFieldAccess {
    if (maybeAutocompleteFieldAccess === undefined) {
        return [];
    }

    return maybeAutocompleteFieldAccess.autocompleteItems.map((item: AutocompleteItem) => item.key);
}

function assertGetParseOkAutocompleteOkFieldAccess<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestAssertUtils.assertGetParseOkAutocompleteOk(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

function assertGetParseErrAutocompleteOkFieldAccess<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
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
        });

        describe(`ParseErr`, () => {
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
                const expected: AbridgedAutocompleteFieldAccess = [];
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
        it(`[#"foo" = 1][|`, () => {
            const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
                `[#"foo" = 1][|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [`#"foo"`];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });
});
