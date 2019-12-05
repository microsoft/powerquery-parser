// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { ResultKind } from "../../common";
import { Ast } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection, expectTextWithPosition } from "./common";

function expectInspected(triedInspection: Inspection.TriedInspection): Inspection.Inspected {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    return triedInspection.value;
}

function expectNodesEqual(
    triedInspection: Inspection.TriedInspection,
    expected: ReadonlyArray<Inspection.IInspectedNode>,
): void {
    const inspected: Inspection.Inspected = expectInspected(triedInspection);
    const actual: ReadonlyArray<Inspection.IInspectedNode> = inspected.identifierVisitedNodes;

    expect(actual).deep.equal(expected);
}

function expectNumOfNodeKind(inspected: Inspection.Inspected, expectedKind: Ast.NodeKind, expectedNum: number): void {
    const actualNum: number = inspected.identifierVisitedNodes.filter(x => x.kind === expectedKind).length;
    expect(actualNum).to.equal(
        expectedNum,
        `expected to find ${expectedNum} of ${expectedKind}, but found ${actualNum} instead.`,
    );
}

function expectNthOfNodeKind<T>(
    inspected: Inspection.Inspected,
    nodeKind: Ast.NodeKind,
    nth: number,
): T & Inspection.IInspectedNode {
    if (nth <= 0) {
        throw new Error("nth must be > 0");
    }

    let nthFound: number = 0;
    for (const node of inspected.identifierVisitedNodes) {
        if (node.kind === nodeKind) {
            nthFound += 1;
            if (nth === nthFound) {
                return (node as unknown) as T & Inspection.IInspectedNode;
            }
        }
    }

    throw new Error(`only found ${nthFound} out of ${nth} ${nodeKind} nodes.`);
}

describe(`Inspection`, () => {
    describe(`InspectedNode`, () => {
        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[foo = bar]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[foo = bar]`);
                const expected: ReadonlyArray<Inspection.IInspectedNode> = [];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[foo| = bar]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo| = bar]`);
                const expected: ReadonlyArray<Inspection.IInspectedNode> = [
                    {
                        id: 7,
                        kind: Ast.NodeKind.GeneralizedIdentifier,
                        maybePositionEnd: {
                            codeUnit: 4,
                            lineCodeUnit: 4,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionEnd: {
                            codeUnit: 11,
                            lineCodeUnit: 11,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                    },
                ];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[foo = bar|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo = bar|]`);
                const expected: ReadonlyArray<Inspection.IInspectedNode> = [
                    {
                        id: 11,
                        kind: Ast.NodeKind.Identifier,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 7,
                            lineCodeUnit: 7,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 10,
                        kind: Ast.NodeKind.IdentifierExpression,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 7,
                            lineCodeUnit: 7,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionEnd: {
                            codeUnit: 11,
                            lineCodeUnit: 11,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                    },
                ];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[foo = bar`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[foo = bar`);
                const expected: ReadonlyArray<Inspection.IInspectedNode> = [];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[foo| = bar`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo| = bar`);
                const expected: ReadonlyArray<Inspection.IInspectedNode> = [
                    {
                        id: 7,
                        kind: Ast.NodeKind.GeneralizedIdentifier,
                        maybePositionEnd: {
                            codeUnit: 4,
                            lineCodeUnit: 4,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionEnd: undefined,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 1,
                        kind: Ast.NodeKind.LogicalExpression,
                        maybePositionEnd: undefined,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                    },
                ];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[foo = bar|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo = bar|`);
                const expected: ReadonlyArray<Inspection.IInspectedNode> = [
                    {
                        id: 11,
                        kind: Ast.NodeKind.Identifier,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 7,
                            lineCodeUnit: 7,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 10,
                        kind: Ast.NodeKind.IdentifierExpression,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 7,
                            lineCodeUnit: 7,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionEnd: undefined,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                    },
                    {
                        id: 1,
                        kind: Ast.NodeKind.LogicalExpression,
                        maybePositionEnd: undefined,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                    },
                ];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });
        });
    });

    describe(`InvokeExpression`, () => {
        it("single invoke expression, no parameters", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(|)");
            const inspected: Inspection.Inspected = expectInspected(expectParseOkInspection(text, position));
            expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

            expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
            const firstInvokeExpr: Inspection.InspectedInvokeExpression = expectNthOfNodeKind(
                inspected,
                Ast.NodeKind.InvokeExpression,
                1,
            );
            expect(inspected.maybeInvokeExpression!.id).to.equal(firstInvokeExpr.id);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeName).to.equal("Foo");
        });

        it("multiple invoke expression, no parameters", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Bar(Foo(|))");
            const inspected: Inspection.Inspected = expectInspected(expectParseOkInspection(text, position));
            expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 2);

            expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
            const firstInvokeExpr: Inspection.InspectedInvokeExpression = expectNthOfNodeKind(
                inspected,
                Ast.NodeKind.InvokeExpression,
                1,
            );
            expect(inspected.maybeInvokeExpression!.id).to.equal(firstInvokeExpr.id);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeName).to.equal("Foo");
            expect(inspectedInvokeExpr.maybePositionStart).deep.equal({
                codeUnit: 7,
                lineCodeUnit: 7,
                lineNumber: 0,
            });
            expect(inspectedInvokeExpr.maybePositionEnd).deep.equal({
                codeUnit: 9,
                lineCodeUnit: 9,
                lineNumber: 0,
            });
        });

        it("single invoke expression - Foo(a|)", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|)");
            const inspected: Inspection.Inspected = expectInspected(expectParseOkInspection(text, position));
            expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

            expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
            const firstInvokeExpr: Inspection.InspectedInvokeExpression = expectNthOfNodeKind(
                inspected,
                Ast.NodeKind.InvokeExpression,
                1,
            );
            expect(inspected.maybeInvokeExpression!.id).to.equal(firstInvokeExpr.id);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
            const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
            expect(args.numArguments).to.equal(1);
            expect(args.positionArgumentIndex).to.equal(0);
        });

        it("single invoke expression - Foo(a|,)", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a|,)");
            const inspected: Inspection.Inspected = expectInspected(expectParseErrInspection(text, position));
            expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

            expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
            const firstInvokeExpr: Inspection.InspectedInvokeExpression = expectNthOfNodeKind(
                inspected,
                Ast.NodeKind.InvokeExpression,
                1,
            );
            expect(inspected.maybeInvokeExpression!.id).to.equal(firstInvokeExpr.id);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
            const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
            expect(args.numArguments).to.equal(2);
            expect(args.positionArgumentIndex).to.equal(0);
        });

        it("single invoke expression - Foo(a,|)", () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition("Foo(a,|)");
            const inspected: Inspection.Inspected = expectInspected(expectParseErrInspection(text, position));
            expectNumOfNodeKind(inspected, Ast.NodeKind.InvokeExpression, 1);

            expect(inspected.maybeInvokeExpression).not.equal(undefined, "at least one InvokeExpression was found");
            const firstInvokeExpr: Inspection.InspectedInvokeExpression = expectNthOfNodeKind(
                inspected,
                Ast.NodeKind.InvokeExpression,
                1,
            );
            expect(inspected.maybeInvokeExpression!.id).to.equal(firstInvokeExpr.id);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
            const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
            expect(args.numArguments).to.equal(2);
            expect(args.positionArgumentIndex).to.equal(1);
        });
    });
});
