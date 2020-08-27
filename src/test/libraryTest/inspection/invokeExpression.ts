// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../..";
import { Assert } from "../../../common";
import { InvokeExpression, Position } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { IParserState, NodeIdMap, ParseContext } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { assertParseErr, assertParseOk, assertTextWithPosition } from "../../testUtils/assertUtils";

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

function assertParseOkInvokeExpressionOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): InvokeExpression | undefined {
    const contextState: ParseContext.State = assertParseOk(settings, text).state.contextState;
    return assertInvokeExpressionOk(settings, contextState.nodeIdMapCollection, contextState.leafNodeIds, position);
}

function assertParseErrInvokeExpressionOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): InvokeExpression | undefined {
    const contextState: ParseContext.State = assertParseErr(settings, text).state.contextState;
    return assertInvokeExpressionOk(settings, contextState.nodeIdMapCollection, contextState.leafNodeIds, position);
}

describe(`subset Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = assertTextWithPosition("Foo(|)");
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
        const [text, position]: [string, Inspection.Position] = assertTextWithPosition("Bar(Foo(|))");
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
        const [text, position]: [string, Inspection.Position] = assertTextWithPosition("Foo(a|)");
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
        const [text, position]: [string, Inspection.Position] = assertTextWithPosition("Foo(a|,)");
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
        const [text, position]: [string, Inspection.Position] = assertTextWithPosition("Foo(a,|)");
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
