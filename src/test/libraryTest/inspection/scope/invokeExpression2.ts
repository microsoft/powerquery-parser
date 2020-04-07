// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { ResultUtils } from "../../../../common";
import { InspectedInvokeExpression2, Position } from "../../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../../inspection/activeNode";
import { Ast, IParserState, NodeIdMap, ParseError, ParseOk } from "../../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { expectParseErr, expectParseErrInspectionOk, expectParseOk, expectTextWithPosition } from "../../../common";

function expectInvokeExpression2Ok(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): undefined | InspectedInvokeExpression2 {
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (!(maybeActiveNode !== undefined)) {
        throw new Error(`AssertedFailed: maybeActiveNode !== undefined`);
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const triedInspect: Inspection.TriedInspectInvokeExpression2 = Inspection.tryInspectInvokeExpression2(
        settings,
        nodeIdMapCollection,
        activeNode,
    );
    if (!ResultUtils.isOk(triedInspect)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedInspect): ${triedInspect.error.message}`);
    }
    return triedInspect.value;
}

export function expectParseOkInvokeExpression2Ok<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position,
): undefined | InspectedInvokeExpression2 {
    const parseOk: ParseOk<S> = expectParseOk(settings, text);
    return expectInvokeExpression2Ok(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position);
}

export function expectParseErrInvokeExpression2Ok<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position,
): undefined | InspectedInvokeExpression2 {
    const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
    return expectInvokeExpression2Ok(
        settings,
        parseError.state.contextState.nodeIdMapCollection,
        parseError.state.contextState.leafNodeIds,
        position,
    );
}

describe(`subset Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(|)");
        const inspected: undefined | InspectedInvokeExpression2 = expectParseOkInvokeExpression2Ok(
            DefaultSettings,
            text,
            position,
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("multiple invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Bar(Foo(|))");
        const inspected: undefined | InspectedInvokeExpression2 = expectParseOkInvokeExpression2Ok(
            DefaultSettings,
            text,
            position,
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("single invoke expression - Foo(a|)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|)");
        const inspected: undefined | InspectedInvokeExpression2 = expectParseOkInvokeExpression2Ok(
            DefaultSettings,
            text,
            position,
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(1);
        expect(inspected.maybeArguments?.positionArgumentIndex).equal(0);
    });

    it("single invoke expression - Foo(a|,)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|,)");
        const inspected: undefined | InspectedInvokeExpression2 = expectParseErrInvokeExpression2Ok(
            DefaultSettings,
            text,
            position,
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(2);
        expect(inspected.maybeArguments?.positionArgumentIndex).equal(0);
    });

    it("single invoke expression - Foo(a,|)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a,|)");
        const inspected: undefined | InspectedInvokeExpression2 = expectParseErrInvokeExpression2Ok(
            DefaultSettings,
            text,
            position,
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(2);
        expect(inspected.maybeArguments?.positionArgumentIndex).equal(1);
    });
});
