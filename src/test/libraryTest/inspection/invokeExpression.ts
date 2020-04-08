// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../..";
import { ResultUtils } from "../../../common";
import { InspectedInvokeExpression, Position } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { IParserState, NodeIdMap, ParseError, ParseOk } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

function expectInvokeExpressionOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position
): undefined | InspectedInvokeExpression {
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds
    );
    if (!(maybeActiveNode !== undefined)) {
        throw new Error(`AssertedFailed: maybeActiveNode !== undefined`);
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const triedInspect: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        activeNode
    );
    if (!ResultUtils.isOk(triedInspect)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedInspect): ${triedInspect.error.message}`);
    }
    return triedInspect.value;
}

function expectParseOkInvokeExpressionOk<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position
): undefined | InspectedInvokeExpression {
    const parseOk: ParseOk<S> = expectParseOk(settings, text);
    return expectInvokeExpressionOk(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position);
}

function expectParseErrInvokeExpressionOk<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position
): undefined | InspectedInvokeExpression {
    const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
    return expectInvokeExpressionOk(
        settings,
        parseError.state.contextState.nodeIdMapCollection,
        parseError.state.contextState.leafNodeIds,
        position
    );
}

describe(`subset Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(|)");
        const inspected: undefined | InspectedInvokeExpression = expectParseOkInvokeExpressionOk(
            DefaultSettings,
            text,
            position
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("multiple invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Bar(Foo(|))");
        const inspected: undefined | InspectedInvokeExpression = expectParseOkInvokeExpressionOk(
            DefaultSettings,
            text,
            position
        );
        if (!(inspected !== undefined)) {
            throw new Error(`AssertFailed: inspected !== undefined`);
        }

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("single invoke expression - Foo(a|)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|)");
        const inspected: undefined | InspectedInvokeExpression = expectParseOkInvokeExpressionOk(
            DefaultSettings,
            text,
            position
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
        const inspected: undefined | InspectedInvokeExpression = expectParseErrInvokeExpressionOk(
            DefaultSettings,
            text,
            position
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
        const inspected: undefined | InspectedInvokeExpression = expectParseErrInvokeExpressionOk(
            DefaultSettings,
            text,
            position
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
