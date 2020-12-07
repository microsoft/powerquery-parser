// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import {
    Assert,
    CommonSettings,
    DefaultSettings,
    Inspection,
    LexSettings,
    Parser,
    ParseSettings,
} from "../../../powerquery-parser";
import { TestAssertUtils } from "../../testUtils";

function assertInvokeExpressionOk(
    settings: CommonSettings,
    nodeIdMapCollection: Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Inspection.Position,
): Inspection.InvokeExpression | undefined {
    const activeNode: Inspection.ActiveNode = Inspection.ActiveNodeUtils.assertActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    const triedInspect: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        activeNode,
    );
    Assert.isOk(triedInspect);
    return triedInspect.value;
}

function assertParseOkInvokeExpressionOk(
    settings: LexSettings & ParseSettings<Parser.IParseState>,
    text: string,
    position: Inspection.Position,
): Inspection.InvokeExpression | undefined {
    const parseOk: Parser.ParseOk = TestAssertUtils.assertGetParseOk(settings, text);
    const contextState: Parser.ParseContext.State = parseOk.state.contextState;
    return assertInvokeExpressionOk(settings, contextState.nodeIdMapCollection, contextState.leafNodeIds, position);
}

function assertParseErrInvokeExpressionOk(
    settings: LexSettings & ParseSettings<Parser.IParseState>,
    text: string,
    position: Inspection.Position,
): Inspection.InvokeExpression | undefined {
    const parseError: Parser.ParseError.ParseError = TestAssertUtils.assertGetParseErr(settings, text);
    const contextState: Parser.ParseContext.State = parseError.state.contextState;
    return assertInvokeExpressionOk(settings, contextState.nodeIdMapCollection, contextState.leafNodeIds, position);
}

describe(`subset Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition("Foo(|)");
        const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
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
        const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
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
        const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
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
        const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
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
        const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
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
