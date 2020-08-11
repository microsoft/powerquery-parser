// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert } from "../../../common";
import { Position } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast } from "../../../language";
import { NodeIdMap, ParseError, ParseOk } from "../../../parser";
import { DefaultSettings } from "../../../settings";
import { ExpectedType, Type, TypeUtils } from "../../../type";
import { expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

function expectParseOkExpectedTypeOk(textWithPipe: string): Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Position] = expectTextWithPosition(textWithPipe);
    const parseOk: ParseOk = expectParseOk(DefaultSettings, textWithoutPipe);

    const nodeIdMapCollection: NodeIdMap.Collection = parseOk.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseOk.state.contextState.leafNodeIds;
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isDefined(maybeActiveNode);

    return expectExpectedTypeOk(nodeIdMapCollection, leafNodeIds, position);
}

function expectParseErrExpectedTypeOk(textWithPipe: string): Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Position] = expectTextWithPosition(textWithPipe);
    const parseErr: ParseError.ParseError = expectParseErr(DefaultSettings, textWithoutPipe);

    const nodeIdMapCollection: NodeIdMap.Collection = parseErr.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseErr.state.contextState.leafNodeIds;
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isDefined(maybeActiveNode);

    return expectExpectedTypeOk(nodeIdMapCollection, leafNodeIds, position);
}

function expectExpectedTypeOk(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): Type.TType | undefined {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isDefined(maybeActiveNode);

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
            const actual: Type.TType | undefined = expectParseOkExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });
    });

    describe(`${Ast.NodeKind.IfExpression} - Parse Err`, () => {
        it(`if |`, () => {
            const textWithPipe: string = "if |";
            const expected: Type.TType = Type.LogicalInstance;
            const actual: Type.TType | undefined = expectParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });

        it(`if 1 then |`, () => {
            const textWithPipe: string = "if 1 then |";
            const expected: Type.TType = Type.ExpressionInstance;
            const actual: Type.TType | undefined = expectParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });

        it(`if 1 then 1 else |`, () => {
            const textWithPipe: string = "if 1 then 1 else |";
            const expected: Type.TType = Type.ExpressionInstance;
            const actual: Type.TType | undefined = expectParseErrExpectedTypeOk(textWithPipe);

            Assert.isDefined(actual);
            expect(TypeUtils.isEqualType(actual, expected));
        });
    });
});
