// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Assert } from "../../../../common";
import { AutocompleteOption, Position, TriedAutocomplete } from "../../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../../inspection/activeNode";
import { Constant, Keyword } from "../../../../language";
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

function assertGetParseOkAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): ReadonlyArray<AutocompleteOption> {
    const parseOk: ParseOk<S> = TestAssertUtils.assertGetParseOk(
        settings,
        text,
        IParserStateUtils.stateFactory,
    ) as ParseOk<S>;
    return assertGetAutocompleteOk(
        settings,
        parseOk.state.contextState.nodeIdMapCollection,
        parseOk.state.contextState.leafNodeIds,
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

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it("type|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type|`);
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type |", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type |`);
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = type|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = type|`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = type |", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `let x = type |`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type | number", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `type | number`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type n|", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`type n|`);
        const expected: ReadonlyArray<AutocompleteOption> = [
            Constant.PrimitiveTypeConstantKind.None,
            Constant.PrimitiveTypeConstantKind.Null,
            Constant.PrimitiveTypeConstantKind.Number,
        ];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseErrAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x|) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(`(x|) => 1`);
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as| number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as | number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as | number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as| nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as| nullable number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as | nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as | nullable number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as nullable| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as nullable| number) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = [];
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as nullable num|ber) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            `(x as nullable num|ber) => 1`,
        );
        const expected: ReadonlyArray<AutocompleteOption> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<AutocompleteOption> = assertGetParseOkAutocompleteOk(
            DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
