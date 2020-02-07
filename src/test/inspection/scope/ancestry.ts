// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../..";
import { isNever } from "../../../common";
import { Token } from "../../../lexer";
import { Ast, TXorNode, XorNodeKind } from "../../../parser";
import {
    expectInspectionEqual,
    expectParseErrInspection,
    expectParseOkInspection,
    expectTextWithPosition,
} from "../../common";

interface AbridgedTravelPathNode {
    readonly id: number;
    readonly kind: Ast.NodeKind;
    readonly maybePositionStartCodeUnit: number | undefined;
}

function actualFactoryFn(inspected: Inspection.Inspected): ReadonlyArray<AbridgedTravelPathNode> {
    if (inspected.maybeActiveNode === undefined) {
        return [];
    }

    return inspected.maybeActiveNode.ancestry.map((xorNode: TXorNode) => {
        let maybePositionStartCodeUnit: number | undefined;

        switch (xorNode.kind) {
            case XorNodeKind.Ast:
                maybePositionStartCodeUnit = xorNode.node.tokenRange.positionStart.codeUnit;
                break;

            case XorNodeKind.Context:
                const maybeTokenStart: Token | undefined = xorNode.node.maybeTokenStart;
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

describe(`Inspection - Scope - Ancestry`, () => {
    describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
        it(`|[foo = bar]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[foo = bar]`);
            const expected: ReadonlyArray<AbridgedTravelPathNode> = [];
            expectInspectionEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
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
            expectInspectionEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
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
            expectInspectionEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
        it(`|[foo = bar`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[foo = bar`);
            const expected: ReadonlyArray<AbridgedTravelPathNode> = [];
            expectInspectionEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
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
            expectInspectionEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
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
            expectInspectionEqual(expectParseErrInspection(text, position), expected, actualFactoryFn);
        });
    });
});
