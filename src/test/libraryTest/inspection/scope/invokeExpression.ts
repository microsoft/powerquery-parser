// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../../../..";
import { Ast, TXorNode } from "../../../../parser";
import { DefaultSettings } from "../../../../settings";
import { expectParseErrInspectionOk, expectParseOkInspectionOk, expectTextWithPosition } from "../../../common";

function expectNumOfNodeKind(inspected: Inspection.Inspected, expectedKind: Ast.NodeKind, expectedNum: number): void {
    let actualNum: number;

    if (inspected.maybeActiveNode === undefined) {
        actualNum = -1;
    } else {
        const nodesOfKind: ReadonlyArray<TXorNode> = inspected.maybeActiveNode.ancestry.filter(
            (xorNode: TXorNode) => xorNode.node.kind === expectedKind,
        );
        actualNum = nodesOfKind.length;
    }

    expect(actualNum).to.equal(
        expectedNum,
        `expected to find ${expectedNum} of ${expectedKind}, but found ${actualNum} instead.`,
    );
}

function expectNthOfNodeKind<X>(inspected: Inspection.Inspected, nodeKind: Ast.NodeKind, nth: number): X & TXorNode {
    if (nth <= 0) {
        throw new Error("nth must be > 0");
    } else if (inspected.maybeActiveNode === undefined) {
        throw new Error("expected to have an active node");
    }

    let nthFound: number = 0;
    for (const xorNode of inspected.maybeActiveNode.ancestry) {
        if (xorNode.node.kind === nodeKind) {
            nthFound += 1;
            if (nth === nthFound) {
                return (xorNode as unknown) as X & TXorNode;
            }
        }
    }

    throw new Error(`only found ${nthFound} out of ${nth} ${nodeKind} nodes.`);
}

describe(`Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(|)");
        const inspected: Inspection.Inspected = expectParseOkInspectionOk(DefaultSettings, text, position);
        expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

        expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
        const inspectedInvokeExpr: Inspection.InvokeExpression = inspected.maybeInvokeExpression!;

        const firstInvokeExprNode: TXorNode = expectNthOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);
        expect(inspectedInvokeExpr.xorNode.node.id).to.equal(firstInvokeExprNode.node.id);

        expect(inspectedInvokeExpr.maybeName).to.equal("Foo");
    });

    it("multiple invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Bar(Foo(|))");
        const inspected: Inspection.Inspected = expectParseOkInspectionOk(DefaultSettings, text, position);
        expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 2);

        expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
        const inspectedInvokeExpr: Inspection.InvokeExpression = inspected.maybeInvokeExpression!;

        const firstInvokeExprNode: TXorNode = expectNthOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);
        expect(inspectedInvokeExpr.xorNode.node.id).to.equal(firstInvokeExprNode.node.id);

        expect(inspectedInvokeExpr.maybeName).to.equal("Foo");
    });

    it("single invoke expression - Foo(a|)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|)");
        const inspected: Inspection.Inspected = expectParseOkInspectionOk(DefaultSettings, text, position);
        expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

        expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
        const inspectedInvokeExpr: Inspection.InvokeExpression = inspected.maybeInvokeExpression!;

        const firstInvokeExprNode: TXorNode = expectNthOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);
        expect(inspectedInvokeExpr.xorNode.node.id).to.equal(firstInvokeExprNode.node.id);

        expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
        const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
        expect(args.numArguments).to.equal(1);
        expect(args.positionArgumentIndex).to.equal(0);
    });

    it("single invoke expression - Foo(a|,)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|,)");
        const inspected: Inspection.Inspected = expectParseErrInspectionOk(DefaultSettings, text, position);
        expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

        expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
        const inspectedInvokeExpr: Inspection.InvokeExpression = inspected.maybeInvokeExpression!;

        const firstInvokeExprNode: TXorNode = expectNthOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);
        expect(inspectedInvokeExpr.xorNode.node.id).to.equal(firstInvokeExprNode.node.id);

        expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
        const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
        expect(args.numArguments).to.equal(2);
        expect(args.positionArgumentIndex).to.equal(0);
    });

    it("single invoke expression - Foo(a,|)", () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a,|)");
        const inspected: Inspection.Inspected = expectParseErrInspectionOk(DefaultSettings, text, position);
        expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

        expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
        const inspectedInvokeExpr: Inspection.InvokeExpression = inspected.maybeInvokeExpression!;

        const firstInvokeExprNode: TXorNode = expectNthOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);
        expect(inspectedInvokeExpr.xorNode.node.id).to.equal(firstInvokeExprNode.node.id);

        expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
        const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
        expect(args.numArguments).to.equal(2);
        expect(args.positionArgumentIndex).to.equal(1);
    });
});
