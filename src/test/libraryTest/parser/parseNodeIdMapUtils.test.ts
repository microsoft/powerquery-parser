// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { ArrayUtils, Assert, Language, MapUtils, Parser, TaskUtils } from "../../../powerquery-parser";
import { DefaultSettings, Task } from "../../..";
import {
    FieldSpecificationKeyValuePair,
    RecordKeyValuePair,
} from "../../../powerquery-parser/parser/nodeIdMap/nodeIdMapIterator";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    ParseError,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "../../../powerquery-parser/parser";
import { AssertTestUtils } from "../../testUtils";
import { Ast } from "../../../powerquery-parser/language";

describe("nodeIdMapIterator", () => {
    it(`iterFieldSpecficationList`, async () => {
        const text: string = `type [foo = number, optional bar = logical]`;
        const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

        const fieldSpecificationListIds: Set<number> = MapUtils.assertGet(
            parseOk.nodeIdMapCollection.idsByNodeKind,
            Ast.NodeKind.FieldSpecificationList,
        );

        expect(fieldSpecificationListIds.size).to.equal(1);

        const fieldSpecificationListId: number = ArrayUtils.assertGet([...fieldSpecificationListIds.values()], 0);

        const fieldSpecificationList: TXorNode = NodeIdMapUtils.assertXor(
            parseOk.nodeIdMapCollection,
            fieldSpecificationListId,
        );

        const fieldSpecificationKeyValuePairs: ReadonlyArray<FieldSpecificationKeyValuePair> =
            NodeIdMapIterator.iterFieldSpecificationList(parseOk.nodeIdMapCollection, fieldSpecificationList);

        expect(fieldSpecificationKeyValuePairs.length).to.equal(2);

        const firstKeyValuePair: FieldSpecificationKeyValuePair = ArrayUtils.assertGet(
            fieldSpecificationKeyValuePairs,
            0,
        );

        expect(firstKeyValuePair.optional).to.equal(undefined);
        expect(firstKeyValuePair.normalizedKeyLiteral).to.equal("foo");

        const secondKeyValuePair: FieldSpecificationKeyValuePair = ArrayUtils.assertGet(
            fieldSpecificationKeyValuePairs,
            1,
        );

        expect(Boolean(secondKeyValuePair.optional)).to.equal(true);
        expect(secondKeyValuePair.normalizedKeyLiteral).to.equal("bar");
    });

    describe(`iterFunctionExpressionParameters`, () => {
        it(`ast`, async () => {
            const text: string = `(x, y as number) => x + y`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = ArrayUtils.assertGet([...functionExpressionIds.values()], 0);

            const functionExpression: TXorNode = NodeIdMapUtils.assertXor(
                parseOk.nodeIdMapCollection,
                functionExpressionId,
            );

            const parameters: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterFunctionExpressionParameters(
                parseOk.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameters.length).to.equal(2);

            const firstParameter: Ast.TParameter = Language.AstUtils.assertAsNodeKind<Ast.TParameter>(
                XorNodeUtils.assertAst(ArrayUtils.assertGet(parameters, 0)),
                Ast.NodeKind.Parameter,
            );

            const secondParameter: Ast.TParameter = Language.AstUtils.assertAsNodeKind<Ast.TParameter>(
                XorNodeUtils.assertAst(ArrayUtils.assertGet(parameters, 1)),
                Ast.NodeKind.Parameter,
            );

            expect(firstParameter.name.literal).to.equal("x");
            expect(secondParameter.name.literal).to.equal("y");
        });

        it(`context`, async () => {
            const text: string = `(x, y as number) => let`;
            const parseError: ParseError.ParseError = await AssertTestUtils.assertGetParseError(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseError.state.contextState.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = ArrayUtils.assertGet([...functionExpressionIds.values()], 0);

            const functionExpression: TXorNode = NodeIdMapUtils.assertXor(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpressionId,
            );

            const parameters: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterFunctionExpressionParameters(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameters.length).to.equal(2);

            const firstParameter: Ast.TParameter = Language.AstUtils.assertAsNodeKind<Ast.TParameter>(
                XorNodeUtils.assertAst(ArrayUtils.assertGet(parameters, 0)),
                Ast.NodeKind.Parameter,
            );

            const secondParameter: Ast.TParameter = Language.AstUtils.assertAsNodeKind<Ast.TParameter>(
                XorNodeUtils.assertAst(ArrayUtils.assertGet(parameters, 1)),
                Ast.NodeKind.Parameter,
            );

            expect(firstParameter.name.literal).to.equal("x");
            expect(secondParameter.name.literal).to.equal("y");
        });
    });

    describe(`iterFunctionExpressionParameterNameLiterals`, () => {
        it(`ast`, async () => {
            const text: string = `(x, y as number) => x + y`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = ArrayUtils.assertGet([...functionExpressionIds.values()], 0);

            const functionExpression: TXorNode = NodeIdMapUtils.assertXor(
                parseOk.nodeIdMapCollection,
                functionExpressionId,
            );

            const parameterNames: ReadonlyArray<string> = NodeIdMapIterator.iterFunctionExpressionParameterNameLiterals(
                parseOk.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameterNames).to.deep.equal(["x", "y"]);
        });

        it(`context`, async () => {
            const text: string = `(x, y as number) => let`;
            const parseError: ParseError.ParseError = await AssertTestUtils.assertGetParseError(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseError.state.contextState.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = ArrayUtils.assertGet([...functionExpressionIds.values()], 0);

            const functionExpression: TXorNode = NodeIdMapUtils.assertXor(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpressionId,
            );

            const parameterNames: ReadonlyArray<string> = NodeIdMapIterator.iterFunctionExpressionParameterNameLiterals(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameterNames).to.deep.equal(["x", "y"]);
        });
    });

    describe(`iterRecord`, () => {
        it(`normalize record key`, async () => {
            const text: string = `let key = [#"foo" = bar] in key`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

            const recordIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.RecordExpression,
            );

            expect(recordIds.size).to.equal(1);

            const recordId: number = ArrayUtils.assertGet([...recordIds.values()], 0);
            const record: TXorNode = NodeIdMapUtils.assertXor(parseOk.nodeIdMapCollection, recordId);

            const recordKeyValuePairs: ReadonlyArray<RecordKeyValuePair> = NodeIdMapIterator.iterRecord(
                parseOk.nodeIdMapCollection,
                record,
            );

            expect(recordKeyValuePairs.length).to.equal(1);

            const keyValuePair: RecordKeyValuePair = ArrayUtils.assertGet(recordKeyValuePairs, 0);
            expect(keyValuePair.normalizedKeyLiteral).to.equal("foo");
        });
    });

    it(`iterRecordType`, async () => {
        const text: string = `type [foo = number, optional bar = logical]`;
        const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

        const recordTypeIds: Set<number> = MapUtils.assertGet(
            parseOk.nodeIdMapCollection.idsByNodeKind,
            Ast.NodeKind.RecordType,
        );

        expect(recordTypeIds.size).to.equal(1);

        const recordTypeId: number = ArrayUtils.assertGet([...recordTypeIds.values()], 0);
        const recordType: TXorNode = NodeIdMapUtils.assertXor(parseOk.nodeIdMapCollection, recordTypeId);

        const fieldSpecificationKeyValuePairs: ReadonlyArray<FieldSpecificationKeyValuePair> =
            NodeIdMapIterator.iterRecordType(parseOk.nodeIdMapCollection, recordType);

        expect(fieldSpecificationKeyValuePairs.length).to.equal(2);

        const firstKeyValuePair: FieldSpecificationKeyValuePair = ArrayUtils.assertGet(
            fieldSpecificationKeyValuePairs,
            0,
        );

        expect(firstKeyValuePair.optional).to.equal(undefined);
        expect(firstKeyValuePair.normalizedKeyLiteral).to.equal("foo");

        const secondKeyValuePair: FieldSpecificationKeyValuePair = ArrayUtils.assertGet(
            fieldSpecificationKeyValuePairs,
            1,
        );

        expect(Boolean(secondKeyValuePair.optional)).to.equal(true);
        expect(secondKeyValuePair.normalizedKeyLiteral).to.equal("bar");
    });
});

describe(`nodeIdMapUtils`, () => {
    describe(`invokeExpressionIdentifier`, () => {
        it(`Ast`, async () => {
            const text: string = `Foo(1)`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);
            const nodeIdMapCollection: NodeIdMap.Collection = parseOk.nodeIdMapCollection;

            const invokeExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.InvokeExpression),
            );

            expect(invokeExpressionNodeIds.size).to.equal(1);
            const invokeExpressionNodeId: number = Assert.asDefined(invokeExpressionNodeIds.values().next().value);

            const invokeExpressionIdentifier: XorNode<Ast.IdentifierExpression> = Assert.asDefined(
                NodeIdMapUtils.invokeExpressionIdentifier(nodeIdMapCollection, invokeExpressionNodeId),
            );

            XorNodeUtils.assertIsAst(invokeExpressionIdentifier);
            expect(invokeExpressionIdentifier.node.identifier.literal).to.equal("Foo");
        });

        it(`Context`, async () => {
            const text: string = `Foo(1, `;

            const parseError: Task.ParseTaskParseError = await AssertTestUtils.assertGetLexParseError(
                DefaultSettings,
                text,
            );

            const nodeIdMapCollection: NodeIdMap.Collection = parseError.error.state.contextState.nodeIdMapCollection;

            const invokeExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.InvokeExpression),
            );

            expect(invokeExpressionNodeIds.size).to.equal(1);
            const invokeExpressionNodeId: number = Assert.asDefined(invokeExpressionNodeIds.values().next().value);

            const invokeExpressionIdentifier: XorNode<Ast.IdentifierExpression> = Assert.asDefined(
                NodeIdMapUtils.invokeExpressionIdentifier(nodeIdMapCollection, invokeExpressionNodeId),
            );

            XorNodeUtils.assertIsAst(invokeExpressionIdentifier);
            expect(invokeExpressionIdentifier.node.identifier.literal).to.equal("Foo");
        });
    });

    describe("wrappedContentXor", () => {
        it("Ast", async () => {
            const text: string = `[a = 1]`;
            const parseOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);
            const nodeIdMapCollection: NodeIdMap.Collection = parseOk.nodeIdMapCollection;

            const recordExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression),
            );

            expect(recordExpressionNodeIds.size).to.equal(1);
            const recordExpressionNodeId: number = Assert.asDefined(recordExpressionNodeIds.values().next().value);

            XorNodeUtils.assertAstChecked(
                Assert.asDefined(NodeIdMapUtils.wrappedContentXor(nodeIdMapCollection, recordExpressionNodeId)),
                Ast.NodeKind.ArrayWrapper,
            );
        });

        it("Context", async () => {
            const text: string = `[a = 1][`;

            const parseError: Parser.ParseError.ParseError = await AssertTestUtils.assertGetParseError(
                DefaultSettings,
                text,
            );

            const nodeIdMapCollection: NodeIdMap.Collection = parseError.state.contextState.nodeIdMapCollection;

            const recordExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression),
            );

            expect(recordExpressionNodeIds.size).to.equal(1);
            const recordExpressionNodeId: number = Assert.asDefined(recordExpressionNodeIds.values().next().value);

            XorNodeUtils.assertAstChecked(
                Assert.asDefined(NodeIdMapUtils.wrappedContentXor(nodeIdMapCollection, recordExpressionNodeId)),
                Ast.NodeKind.ArrayWrapper,
            );
        });
    });

    describe("copyState - currentContextNode isolation", () => {
        it("mutating currentContextNode on copy should not affect original", async () => {
            const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, `let x =`);

            TaskUtils.assertIsParseStageParseError(triedLexParseTask);
            const originalState: Parser.ParseState = triedLexParseTask.parseState;

            expect(originalState.currentContextNode).to.not.be.undefined;
            const originalAttributeCounter: number = originalState.currentContextNode!.attributeCounter;

            const copiedState: Parser.ParseState = await Parser.ParseStateUtils.copyState(originalState);

            expect(copiedState.currentContextNode).to.not.be.undefined;
            copiedState.currentContextNode!.attributeCounter += 1;

            expect(originalState.currentContextNode!.attributeCounter).to.equal(
                originalAttributeCounter,
                "Mutating currentContextNode on copied state should not affect the original state",
            );
        });

        it("copied currentContextNode should have same values but different reference", async () => {
            const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, `let x =`);

            TaskUtils.assertIsParseStageParseError(triedLexParseTask);
            const originalState: Parser.ParseState = triedLexParseTask.parseState;
            expect(originalState.currentContextNode).to.not.be.undefined;

            const copiedState: Parser.ParseState = await Parser.ParseStateUtils.copyState(originalState);
            expect(copiedState.currentContextNode).to.not.be.undefined;

            expect(copiedState.currentContextNode!.id).to.equal(originalState.currentContextNode!.id);
            expect(copiedState.currentContextNode!.kind).to.equal(originalState.currentContextNode!.kind);

            expect(copiedState.currentContextNode!.attributeCounter).to.equal(
                originalState.currentContextNode!.attributeCounter,
            );

            expect(copiedState.currentContextNode!.isClosed).to.equal(originalState.currentContextNode!.isClosed);

            expect(copiedState.currentContextNode).to.not.equal(originalState.currentContextNode);
        });
    });
});
