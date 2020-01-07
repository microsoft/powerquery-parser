// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { isNever, Option, ResultKind } from "../../common";
import { Token } from "../../lexer";
import { Ast, NodeIdMap } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection, expectTextWithPosition } from "./common";

interface AbridgedTravelPathNode {
    readonly id: number;
    readonly kind: Ast.NodeKind;
    readonly maybePositionStartCodeUnit: Option<number>;
}

function abrigedTravelPathFrom(inspected: Inspection.Inspected): ReadonlyArray<AbridgedTravelPathNode> {
    if (inspected.maybeActiveNode === undefined) {
        return [];
    }

    return inspected.maybeActiveNode.ancestory.map((xorNode: NodeIdMap.TXorNode) => {
        let maybePositionStartCodeUnit: Option<number>;

        switch (xorNode.kind) {
            case NodeIdMap.XorNodeKind.Ast:
                maybePositionStartCodeUnit = xorNode.node.tokenRange.positionStart.codeUnit;
                break;

            case NodeIdMap.XorNodeKind.Context:
                const maybeTokenStart: Option<Token> = xorNode.node.maybeTokenStart;
                maybePositionStartCodeUnit =
                    maybeTokenStart !== undefined ? maybeTokenStart.positionStart.codeUnit : undefined;
                break;

            default:
                throw isNever(xorNode);
        }

        return {
            id: xorNode.node.id,
            kind: xorNode.node.kind,
            maybePositionStartCodeUnit,
        };
    });
}

function expectInspected(triedInspection: Inspection.TriedInspection): Inspection.Inspected {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    return triedInspection.value;
}

function expectNodesEqual(
    triedInspection: Inspection.TriedInspection,
    expected: ReadonlyArray<AbridgedTravelPathNode>,
): void {
    const inspected: Inspection.Inspected = expectInspected(triedInspection);
    const actual: ReadonlyArray<AbridgedTravelPathNode> = abrigedTravelPathFrom(inspected);

    expect(actual).deep.equal(expected);
}

function expectNumOfNodeKind(inspected: Inspection.Inspected, expectedKind: Ast.NodeKind, expectedNum: number): void {
    const actualNum: number =
        inspected.maybeActiveNode !== undefined
            ? inspected.maybeActiveNode.ancestory.filter(xorNode => xorNode.node.kind === expectedKind).length
            : -1;
    expect(actualNum).to.equal(
        expectedNum,
        `expected to find ${expectedNum} of ${expectedKind}, but found ${actualNum} instead.`,
    );
}

function expectNthOfNodeKind<T>(
    inspected: Inspection.Inspected,
    nodeKind: Ast.NodeKind,
    nth: number,
): T & NodeIdMap.TXorNode {
    if (nth <= 0) {
        throw new Error("nth must be > 0");
    } else if (inspected.maybeActiveNode === undefined) {
        throw new Error("expected to have an active node");
    }

    let nthFound: number = 0;
    for (const xorNode of inspected.maybeActiveNode.ancestory) {
        if (xorNode.node.kind === nodeKind) {
            nthFound += 1;
            if (nth === nthFound) {
                return (xorNode as unknown) as T & NodeIdMap.TXorNode;
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
                const expected: ReadonlyArray<AbridgedTravelPathNode> = [];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[foo| = bar]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo| = bar]`);
                const expected: ReadonlyArray<AbridgedTravelPathNode> = [
                    {
                        id: 7,
                        kind: Ast.NodeKind.GeneralizedIdentifier,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionStartCodeUnit: 0,
                    },
                ];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[foo = bar|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo = bar|]`);
                const expected: ReadonlyArray<AbridgedTravelPathNode> = [
                    {
                        id: 11,
                        kind: Ast.NodeKind.Identifier,
                        maybePositionStartCodeUnit: 7,
                    },
                    {
                        id: 10,
                        kind: Ast.NodeKind.IdentifierExpression,
                        maybePositionStartCodeUnit: 7,
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionStartCodeUnit: 0,
                    },
                ];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[foo = bar`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[foo = bar`);
                const expected: ReadonlyArray<AbridgedTravelPathNode> = [];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[foo| = bar`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo| = bar`);
                const expected: ReadonlyArray<AbridgedTravelPathNode> = [
                    {
                        id: 7,
                        kind: Ast.NodeKind.GeneralizedIdentifier,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionStartCodeUnit: 0,
                    },
                    {
                        id: 1,
                        kind: Ast.NodeKind.LogicalExpression,
                        maybePositionStartCodeUnit: 0,
                    },
                ];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[foo = bar|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo = bar|`);
                const expected: ReadonlyArray<AbridgedTravelPathNode> = [
                    {
                        id: 11,
                        kind: Ast.NodeKind.Identifier,
                        maybePositionStartCodeUnit: 7,
                    },
                    {
                        id: 10,
                        kind: Ast.NodeKind.IdentifierExpression,
                        maybePositionStartCodeUnit: 7,
                    },
                    {
                        id: 6,
                        kind: Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 5,
                        kind: Ast.NodeKind.Csv,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 4,
                        kind: Ast.NodeKind.ArrayWrapper,
                        maybePositionStartCodeUnit: 1,
                    },
                    {
                        id: 2,
                        kind: Ast.NodeKind.RecordExpression,
                        maybePositionStartCodeUnit: 0,
                    },
                    {
                        id: 1,
                        kind: Ast.NodeKind.LogicalExpression,
                        maybePositionStartCodeUnit: 0,
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
            expect(inspected.maybeInvokeExpression!.xorNode).to.equal(firstInvokeExpr.xorNode);
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
            expect(inspected.maybeInvokeExpression!.xorNode).to.equal(firstInvokeExpr.xorNode);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeName).to.equal("Foo");
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
            expect(inspected.maybeInvokeExpression!.xorNode).to.equal(firstInvokeExpr.xorNode);
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
            expect(inspected.maybeInvokeExpression!.xorNode).to.equal(firstInvokeExpr.xorNode);
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
            expect(inspected.maybeInvokeExpression!.xorNode).to.equal(firstInvokeExpr.xorNode);
            const inspectedInvokeExpr: Inspection.InspectedInvokeExpression = inspected.maybeInvokeExpression!;

            expect(inspectedInvokeExpr.maybeArguments).not.equal(undefined, "should be truthy");
            const args: Inspection.InvokeExpressionArgs = inspectedInvokeExpr.maybeArguments!;
            expect(args.numArguments).to.equal(2);
            expect(args.positionArgumentIndex).to.equal(1);
        });
    });
});
