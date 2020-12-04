// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert } from "../../../powerquery-parser/common";
import { Position } from "../../../powerquery-parser/inspection";
import { ActiveNodeKind, ActiveNodeUtils, TMaybeActiveNode } from "../../../powerquery-parser/inspection/activeNode";
import { Ast, ExpectedType, Type, TypeUtils } from "../../../powerquery-parser/language";
import { NodeIdMap, ParseError, ParseOk } from "../../../powerquery-parser/parser";
import { DefaultSettings } from "../../../powerquery-parser/settings";
import { TestAssertUtils } from "../../testUtils";

function assertGetParseOkExpectedTypeOk(textWithPipe: string): Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Position] = TestAssertUtils.assertGetTextWithPosition(textWithPipe);
    const parseOk: ParseOk = TestAssertUtils.assertGetParseOk(DefaultSettings, textWithoutPipe);

    const nodeIdMapCollection: NodeIdMap.Collection = parseOk.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseOk.state.contextState.leafNodeIds;
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isTrue(
        maybeActiveNode.kind === ActiveNodeKind.ActiveNode,
        "maybeActiveNode.kind === ActiveNodeKind.ActiveNode",
    );

    return assertGetExpectedTypeOk(nodeIdMapCollection, leafNodeIds, position);
}

function assertGetParseErrExpectedTypeOk(textWithPipe: string): Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Position] = TestAssertUtils.assertGetTextWithPosition(textWithPipe);
    const parseErr: ParseError.ParseError = TestAssertUtils.assertGetParseErr(DefaultSettings, textWithoutPipe);

    const nodeIdMapCollection: NodeIdMap.Collection = parseErr.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseErr.state.contextState.leafNodeIds;
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isTrue(
        maybeActiveNode.kind === ActiveNodeKind.ActiveNode,
        "maybeActiveNode.kind === ActiveNodeKind.ActiveNode",
    );

    return assertGetExpectedTypeOk(nodeIdMapCollection, leafNodeIds, position);
}

function assertGetExpectedTypeOk(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): Type.TType | undefined {
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isTrue(
        maybeActiveNode.kind === ActiveNodeKind.ActiveNode,
        "maybeActiveNode.kind === ActiveNodeKind.ActiveNode",
    );

    const triedExpectedType: ExpectedType.TriedExpectedType = ExpectedType.tryExpectedType(
        DefaultSettings,
        maybeActiveNode,
    );

    Assert.isOk(triedExpectedType);
    return triedExpectedType.value;
}

describe(`Inspection - Scope - ExpectedType`, () => {
    describe(`${Ast.NodeKind.IfExpression} - Parse Ok`, () => {
        it(`if | true then 1 else 1`, () => {
            const textWithPipe: string = "if | true then 1 else 1";
            const expected: Type.TType = Type.LogicalInstance;
            const actual: Type.TType | undefined = assertGetParseOkExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });
    });

    describe(`${Ast.NodeKind.IfExpression} - Parse Err`, () => {
        it(`if |`, () => {
            const textWithPipe: string = "if |";
            const expected: Type.TType = Type.LogicalInstance;
            const actual: Type.TType | undefined = assertGetParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });

        it(`if 1 then |`, () => {
            const textWithPipe: string = "if 1 then |";
            const expected: Type.TType = Type.ExpressionInstance;
            const actual: Type.TType | undefined = assertGetParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });

        it(`if 1 then 1 else |`, () => {
            const textWithPipe: string = "if 1 then 1 else |";
            const expected: Type.TType = Type.ExpressionInstance;
            const actual: Type.TType | undefined = assertGetParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });
    });
});
