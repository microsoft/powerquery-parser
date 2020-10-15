// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../..";
import { Assert } from "../../../common";
import { InvokeExpression, Position } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { IParserState, NodeIdMap, ParseContext, ParseError, ParseOk } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { TestAssertUtils } from "../../testUtils";

function assertInvokeExpressionOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): InvokeExpression | undefined {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isDefined(maybeActiveNode);
    const activeNode: ActiveNode = maybeActiveNode;

    const triedInspect: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        activeNode,
    );
    Assert.isOk(triedInspect);
    return triedInspect.value;
}

function assertParseOkInvokeExpressionOk(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): InvokeExpression | undefined {
    const parseOk: ParseOk = TestAssertUtils.assertGetParseOk(settings, text);
    const contextState: ParseContext.State = parseOk.state.contextState;
    return assertInvokeExpressionOk(settings, contextState.nodeIdMapCollection, contextState.leafNodeIds, position);
}

function assertParseErrInvokeExpressionOk(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): InvokeExpression | undefined {
    const parseError: ParseError.ParseError = TestAssertUtils.assertGetParseErr(settings, text);
    const contextState: ParseContext.State = parseError.state.contextState;
    return assertInvokeExpressionOk(settings, contextState.nodeIdMapCollection, contextState.leafNodeIds, position);
}

describe(`subset Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition("Foo(|)");
        const inspected: InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
            DefaultSettings,
            text,
            position,
        );
        Assert.isDefined(inspected);
        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("multiple invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
            "Bar(Foo(|))",
        );
        const inspected: InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
            DefaultSettings,
            text,
            position,
        );
        Assert.isDefined(inspected);
        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("single invoke expression - Foo(a|)", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition("Foo(a|)");
        const inspected: InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
            DefaultSettings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(1);
        expect(inspected.maybeArguments?.argumentOrdinal).equal(0);
    });

    it("single invoke expression - Foo(a|,)", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition("Foo(a|,)");
        const inspected: InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
            DefaultSettings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(2);
        expect(inspected.maybeArguments?.argumentOrdinal).equal(0);
    });

    it("single invoke expression - Foo(a,|)", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition("Foo(a,|)");
        const inspected: InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
            DefaultSettings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(2);
        expect(inspected.maybeArguments?.argumentOrdinal).equal(1);
    });
});
