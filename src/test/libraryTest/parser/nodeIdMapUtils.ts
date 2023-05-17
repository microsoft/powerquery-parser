// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, Language, MapUtils, Parser } from "../../../powerquery-parser";
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
import { Ast } from "../../../powerquery-parser/language";
import { TestAssertUtils } from "../../testUtils";

describe("nodeIdMapIterator", () => {
    it(`iterFieldSpecficationList`, async () => {
        const text: string = `type [foo = number, optional bar = logical]`;
        const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

        const fieldSpecificationListIds: Set<number> = MapUtils.assertGet(
            parseOk.nodeIdMapCollection.idsByNodeKind,
            Ast.NodeKind.FieldSpecificationList,
        );

        expect(fieldSpecificationListIds.size).to.equal(1);

        const fieldSpecificationListId: number = Assert.asDefined([...fieldSpecificationListIds.values()][0]);

        const fieldSpecificationList: TXorNode = NodeIdMapUtils.assertXor(
            parseOk.nodeIdMapCollection,
            fieldSpecificationListId,
        );

        const fieldSpecificationKeyValuePairs: ReadonlyArray<FieldSpecificationKeyValuePair> =
            NodeIdMapIterator.iterFieldSpecificationList(parseOk.nodeIdMapCollection, fieldSpecificationList);

        expect(fieldSpecificationKeyValuePairs.length).to.equal(2);

        const firstKeyValuePair: FieldSpecificationKeyValuePair = fieldSpecificationKeyValuePairs[0];
        expect(firstKeyValuePair.optional).to.equal(undefined);
        expect(firstKeyValuePair.normalizedKeyLiteral).to.equal("foo");

        const secondKeyValuePair: FieldSpecificationKeyValuePair = fieldSpecificationKeyValuePairs[1];
        expect(Boolean(secondKeyValuePair.optional)).to.equal(true);
        expect(secondKeyValuePair.normalizedKeyLiteral).to.equal("bar");
    });

    describe(`iterFunctionExpressionParameters`, () => {
        it(`ast`, async () => {
            const text: string = `(x, y as number) => x + y`;
            const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);

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
                XorNodeUtils.assertAst(parameters[0]),
                Ast.NodeKind.Parameter,
            );

            const secondParameter: Ast.TParameter = Language.AstUtils.assertAsNodeKind<Ast.TParameter>(
                XorNodeUtils.assertAst(parameters[1]),
                Ast.NodeKind.Parameter,
            );

            expect(firstParameter.name.literal).to.equal("x");
            expect(secondParameter.name.literal).to.equal("y");
        });

        it(`context`, async () => {
            const text: string = `(x, y as number) => let`;
            const parseError: ParseError.ParseError = await TestAssertUtils.assertGetParseError(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseError.state.contextState.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);

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
                XorNodeUtils.assertAst(parameters[0]),
                Ast.NodeKind.Parameter,
            );

            const secondParameter: Ast.TParameter = Language.AstUtils.assertAsNodeKind<Ast.TParameter>(
                XorNodeUtils.assertAst(parameters[1]),
                Ast.NodeKind.Parameter,
            );

            expect(firstParameter.name.literal).to.equal("x");
            expect(secondParameter.name.literal).to.equal("y");
        });
    });

    describe(`iterFunctionExpressionParameterNameLiterals`, () => {
        it(`ast`, async () => {
            const text: string = `(x, y as number) => x + y`;
            const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);

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
            const parseError: ParseError.ParseError = await TestAssertUtils.assertGetParseError(DefaultSettings, text);

            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseError.state.contextState.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );

            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);

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
            const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

            const recordIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.RecordExpression,
            );

            expect(recordIds.size).to.equal(1);

            const recordId: number = Assert.asDefined([...recordIds.values()][0]);
            const record: TXorNode = NodeIdMapUtils.assertXor(parseOk.nodeIdMapCollection, recordId);

            const recordKeyValuePairs: ReadonlyArray<RecordKeyValuePair> = NodeIdMapIterator.iterRecord(
                parseOk.nodeIdMapCollection,
                record,
            );

            expect(recordKeyValuePairs.length).to.equal(1);

            const keyValuePair: RecordKeyValuePair = recordKeyValuePairs[0];
            expect(keyValuePair.normalizedKeyLiteral).to.equal("foo");
        });
    });

    it(`iterRecordType`, async () => {
        const text: string = `type [foo = number, optional bar = logical]`;
        const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

        const recordTypeIds: Set<number> = MapUtils.assertGet(
            parseOk.nodeIdMapCollection.idsByNodeKind,
            Ast.NodeKind.RecordType,
        );

        expect(recordTypeIds.size).to.equal(1);

        const recordTypeId: number = Assert.asDefined([...recordTypeIds.values()][0]);
        const recordType: TXorNode = NodeIdMapUtils.assertXor(parseOk.nodeIdMapCollection, recordTypeId);

        const fieldSpecificationKeyValuePairs: ReadonlyArray<FieldSpecificationKeyValuePair> =
            NodeIdMapIterator.iterRecordType(parseOk.nodeIdMapCollection, recordType);

        expect(fieldSpecificationKeyValuePairs.length).to.equal(2);

        const firstKeyValuePair: FieldSpecificationKeyValuePair = fieldSpecificationKeyValuePairs[0];
        expect(firstKeyValuePair.optional).to.equal(undefined);
        expect(firstKeyValuePair.normalizedKeyLiteral).to.equal("foo");

        const secondKeyValuePair: FieldSpecificationKeyValuePair = fieldSpecificationKeyValuePairs[1];
        expect(Boolean(secondKeyValuePair.optional)).to.equal(true);
        expect(secondKeyValuePair.normalizedKeyLiteral).to.equal("bar");
    });
});

describe(`nodeIdMapUtils`, () => {
    describe(`invokeExpressionIdentifier`, () => {
        it(`Ast`, async () => {
            const text: string = `Foo(1)`;
            const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
            const nodeIdMapCollection: NodeIdMap.Collection = parseOk.nodeIdMapCollection;

            const invokeExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.InvokeExpression),
            );

            expect(invokeExpressionNodeIds.size).to.equal(1);
            const invokeExpressionNodeId: number = invokeExpressionNodeIds.values().next().value;

            const invokeExpressionIdentifier: XorNode<Ast.IdentifierExpression> = Assert.asDefined(
                NodeIdMapUtils.invokeExpressionIdentifier(nodeIdMapCollection, invokeExpressionNodeId),
            );

            XorNodeUtils.assertIsAst(invokeExpressionIdentifier);
            expect(invokeExpressionIdentifier.node.identifier.literal).to.equal("Foo");
        });

        it(`Context`, async () => {
            const text: string = `Foo(1, `;

            const parseError: Task.ParseTaskParseError = await TestAssertUtils.assertGetLexParseError(
                DefaultSettings,
                text,
            );

            const nodeIdMapCollection: NodeIdMap.Collection = parseError.error.state.contextState.nodeIdMapCollection;

            const invokeExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.InvokeExpression),
            );

            expect(invokeExpressionNodeIds.size).to.equal(1);
            const invokeExpressionNodeId: number = invokeExpressionNodeIds.values().next().value;

            const invokeExpressionIdentifier: XorNode<Ast.IdentifierExpression> = Assert.asDefined(
                NodeIdMapUtils.invokeExpressionIdentifier(nodeIdMapCollection, invokeExpressionNodeId),
            );

            XorNodeUtils.assertIsAst(invokeExpressionIdentifier);
            expect(invokeExpressionIdentifier.node.identifier.literal).to.equal("Foo");
        });
    });

    describe("unboxWrappedContent", () => {
        it("Ast", async () => {
            const text: string = `[a = 1]`;
            const parseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
            const nodeIdMapCollection: NodeIdMap.Collection = parseOk.nodeIdMapCollection;

            const recordExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression),
            );

            expect(recordExpressionNodeIds.size).to.equal(1);
            const recordExpressionNodeId: number = recordExpressionNodeIds.values().next().value;

            XorNodeUtils.assertAstChecked(
                Assert.asDefined(NodeIdMapUtils.unboxWrappedContent(nodeIdMapCollection, recordExpressionNodeId)),
                Ast.NodeKind.ArrayWrapper,
            );
        });

        it("WIP Context", async () => {
            const text: string = `[a = 1][`;

            const parseError: Parser.ParseError.ParseError = await TestAssertUtils.assertGetParseError(
                DefaultSettings,
                text,
            );

            const nodeIdMapCollection: NodeIdMap.Collection = parseError.state.contextState.nodeIdMapCollection;

            const recordExpressionNodeIds: Set<number> = Assert.asDefined(
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression),
            );

            expect(recordExpressionNodeIds.size).to.equal(1);
            const recordExpressionNodeId: number = recordExpressionNodeIds.values().next().value;

            XorNodeUtils.assertAstChecked(
                Assert.asDefined(NodeIdMapUtils.unboxWrappedContent(nodeIdMapCollection, recordExpressionNodeId)),
                Ast.NodeKind.ArrayWrapper,
            );
        });
    });
});
