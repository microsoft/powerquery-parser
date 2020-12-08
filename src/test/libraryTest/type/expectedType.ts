// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, DefaultSettings, Inspection, Language, Parser } from "../../..";
import { TestAssertUtils } from "../../testUtils";

function assertGetParseOkExpectedTypeOk(textWithPipe: string): Language.Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
        textWithPipe,
    );
    const parseOk: Parser.ParseOk = TestAssertUtils.assertGetParseOk(DefaultSettings, textWithoutPipe);

    const nodeIdMapCollection: Parser.NodeIdMap.Collection = parseOk.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseOk.state.contextState.leafNodeIds;
    const maybeActiveNode: Inspection.TMaybeActiveNode = Inspection.ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isTrue(
        maybeActiveNode.kind === Inspection.ActiveNodeKind.ActiveNode,
        "maybeActiveNode.kind === Inspection.ActiveNodeKind.ActiveNode",
    );

    return assertGetExpectedTypeOk(nodeIdMapCollection, leafNodeIds, position);
}

function assertGetParseErrExpectedTypeOk(textWithPipe: string): Language.Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
        textWithPipe,
    );
    const parseErr: Parser.ParseError.ParseError = TestAssertUtils.assertGetParseErr(DefaultSettings, textWithoutPipe);

    const nodeIdMapCollection: Parser.NodeIdMap.Collection = parseErr.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseErr.state.contextState.leafNodeIds;
    const maybeActiveNode: Inspection.TMaybeActiveNode = Inspection.ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isTrue(
        maybeActiveNode.kind === Inspection.ActiveNodeKind.ActiveNode,
        "maybeActiveNode.kind === Inspection.ActiveNodeKind.ActiveNode",
    );

    return assertGetExpectedTypeOk(nodeIdMapCollection, leafNodeIds, position);
}

function assertGetExpectedTypeOk(
    nodeIdMapCollection: Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Inspection.Position,
): Language.Type.TType | undefined {
    const maybeActiveNode: Inspection.TMaybeActiveNode = Inspection.ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isTrue(
        maybeActiveNode.kind === Inspection.ActiveNodeKind.ActiveNode,
        "maybeActiveNode.kind === Inspection.ActiveNodeKind.ActiveNode",
    );

    const triedExpectedType: Language.ExpectedType.TriedExpectedType = Language.ExpectedType.tryExpectedType(
        DefaultSettings,
        maybeActiveNode,
    );

    Assert.isOk(triedExpectedType);
    return triedExpectedType.value;
}

describe(`Inspection - Scope - ExpectedType`, () => {
    describe(`${Language.Ast.NodeKind.IfExpression} - Parse Ok`, () => {
        it(`if | true then 1 else 1`, () => {
            const textWithPipe: string = "if | true then 1 else 1";
            const expected: Language.Type.TType = Language.Type.LogicalInstance;
            const actual: Language.Type.TType | undefined = assertGetParseOkExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(Language.TypeUtils.isEqualType(actual, expected));
        });
    });

    describe(`${Language.Ast.NodeKind.IfExpression} - Parse Err`, () => {
        it(`if |`, () => {
            const textWithPipe: string = "if |";
            const expected: Language.Type.TType = Language.Type.LogicalInstance;
            const actual: Language.Type.TType | undefined = assertGetParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(Language.TypeUtils.isEqualType(actual, expected));
        });

        it(`if 1 then |`, () => {
            const textWithPipe: string = "if 1 then |";
            const expected: Language.Type.TType = Language.Type.ExpressionInstance;
            const actual: Language.Type.TType | undefined = assertGetParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(Language.TypeUtils.isEqualType(actual, expected));
        });

        it(`if 1 then 1 else |`, () => {
            const textWithPipe: string = "if 1 then 1 else |";
            const expected: Language.Type.TType = Language.Type.ExpressionInstance;
            const actual: Language.Type.TType | undefined = assertGetParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(Language.TypeUtils.isEqualType(actual, expected));
        });
    });
});
