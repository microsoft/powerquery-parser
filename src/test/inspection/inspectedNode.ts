// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { ResultKind } from "../../common";
import { IInspectedNode } from "../../inspection";
import { Ast } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection, expectTextWithPosition } from "./common";

function expectNodesEqual(triedInspection: Inspection.TriedInspection, expected: ReadonlyArray<IInspectedNode>): void {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: ReadonlyArray<IInspectedNode> = inspection.nodes;

    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`AbridgedInspected`, () => {
        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[foo = bar]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[foo = bar]`);
                const expected: ReadonlyArray<IInspectedNode> = [];
                expectNodesEqual(expectParseOkInspection(text, position), expected);
            });

            it(`[foo| = bar]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo| = bar]`);
                const expected: ReadonlyArray<IInspectedNode> = [
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
                const expected: ReadonlyArray<IInspectedNode> = [
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
                const expected: ReadonlyArray<IInspectedNode> = [];
                expectNodesEqual(expectParseErrInspection(text, position), expected);
            });

            it(`[foo| = bar`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[foo| = bar`);
                const expected: ReadonlyArray<IInspectedNode> = [
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
                const expected: ReadonlyArray<IInspectedNode> = [
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
});
