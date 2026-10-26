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

    describe("Checkpoint delta rollback", () => {
        function assertAllocationBound(state: Parser.ParseState): void {
            const { idCounter, nodeIdMapCollection }: Parser.ParseContext.State = state.contextState;
            expect(Number.isSafeInteger(idCounter)).to.equal(true);
            expect(idCounter).to.be.at.least(0);

            for (const nodes of [nodeIdMapCollection.astNodeById, nodeIdMapCollection.contextNodeById]) {
                for (const [nodeId] of nodes) {
                    expect(nodeId).to.be.at.most(idCounter);
                }
            }
        }

        class NoScanMap<K, V> extends Map<K, V> {
            public override keys(): MapIterator<K> {
                throw new Error("Rollback must not scan accumulated nodes");
            }
        }

        function newState(): Parser.ParseState {
            const lex: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, "number text logical");
            TaskUtils.assertIsLexStageOk(lex);
            const contextState: Parser.ParseContext.State = Parser.ParseContextUtils.newState();

            return Parser.ParseStateUtils.newState(lex.lexerSnapshot, {
                contextState: {
                    ...contextState,
                    nodeIdMapCollection: {
                        ...contextState.nodeIdMapCollection,
                        astNodeById: new NoScanMap(),
                        contextNodeById: new NoScanMap(),
                    },
                },
            });
        }

        for (const parser of [Parser.CombinatorialParserV2, Parser.RecursiveDescentParser]) {
            describe(parser === Parser.CombinatorialParserV2 ? "Combinatorial" : "Recursive descent", () => {
                it("bounds IDs after allocation, completion, inserted parents, and deletion", async () => {
                    const state: Parser.ParseState = newState();
                    assertAllocationBound(state);
                    Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);
                    assertAllocationBound(state);
                    const leaf: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
                    assertAllocationBound(state);

                    const wrapper: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContextAsParent(
                        state,
                        Ast.NodeKind.NullablePrimitiveType,
                        leaf.id,
                        undefined,
                    );

                    expect(wrapper.id).to.equal(leaf.id + 1);
                    assertAllocationBound(state);
                    Parser.ParseContextUtils.deleteContext(state.contextState, wrapper.id);
                    expect(state.contextState.idCounter).to.equal(wrapper.id);
                    assertAllocationBound(state);

                    const next: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
                        state,
                        Ast.NodeKind.ListType,
                    );

                    expect(next.id).to.equal(wrapper.id + 1);
                    assertAllocationBound(state);
                });

                it("copies and applies the allocation bound with its node maps", async () => {
                    const state: Parser.ParseState = newState();
                    Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);
                    await parser.readPrimitiveType(state, parser, undefined);
                    assertAllocationBound(state);
                    const originalCounter: number = state.contextState.idCounter;
                    const copied: Parser.ParseState = await parser.copyState(state);
                    expect(copied.contextState.idCounter).to.equal(originalCounter);
                    assertAllocationBound(copied);
                    const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(copied);
                    await parser.readPrimitiveType(copied, parser, undefined);
                    Parser.ParseStateUtils.startContext(copied, Ast.NodeKind.ListType);
                    assertAllocationBound(copied);
                    expect(state.contextState.idCounter).to.equal(originalCounter);
                    assertAllocationBound(state);

                    await parser.applyState(state, copied);
                    expect(state.contextState.idCounter).to.equal(copied.contextState.idCounter);
                    expect(state.contextState.idCounter).to.be.greaterThan(originalCounter);
                    assertAllocationBound(state);

                    await parser.restoreCheckpoint(state, checkpoint);
                    expect(state.contextState.idCounter).to.equal(originalCounter);
                    assertAllocationBound(state);
                    const reused: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
                    expect(reused.id).to.equal(originalCounter + 1);
                    assertAllocationBound(state);
                });
            });
        }

        it("rewinds the cursor and context even when no IDs were allocated", async () => {
            const state: Parser.ParseState = newState();

            const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);

            const checkpoint: Parser.ParseStateCheckpoint = await Parser.ParserUtils.checkpoint(state);
            state.tokenIndex = 2;
            state.currentToken = state.lexerSnapshot.tokens[2];
            state.currentTokenKind = state.currentToken?.kind;
            state.currentContextNode = undefined;
            await Parser.ParserUtils.restoreCheckpoint(state, checkpoint);
            expect(state.tokenIndex).to.equal(0);
            expect(state.currentToken?.data).to.equal("number");
            expect(state.currentContextNode).to.equal(parent);
            expect(state.contextState.idCounter).to.equal(parent.id);
        });

        it("deletes completed AST nodes before unfinished contexts, each in descending order", async () => {
            const state: Parser.ParseState = newState();
            const parser: Parser.Parser = DefaultSettings.parser;
            Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);
            const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
            const first: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);

            const inner: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);

            const second: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);

            const last: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);

            const maps: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
            const deleted: string[] = [];
            const deleteAst: (id: number) => boolean = maps.astNodeById.delete.bind(maps.astNodeById);
            const deleteContext: (id: number) => boolean = maps.contextNodeById.delete.bind(maps.contextNodeById);

            maps.astNodeById.delete = (id: number): boolean => {
                deleted.push(`ast:${id}`);

                return deleteAst(id);
            };

            maps.contextNodeById.delete = (id: number): boolean => {
                deleted.push(`context:${id}`);

                return deleteContext(id);
            };

            await parser.restoreCheckpoint(state, checkpoint);

            expect(deleted).to.deep.equal([
                `ast:${second.id}`,
                `ast:${first.id}`,
                `context:${last.id}`,
                `context:${inner.id}`,
            ]);

            expect(maps.astNodeById.size).to.equal(0);
            expect(maps.contextNodeById.size).to.equal(1);
            expect(maps.childIdsById.size).to.equal(0);
        });

        it("restores a no-op checkpoint without scanning maps", async () => {
            const state: Parser.ParseState = newState();
            const checkpoint: Parser.ParseStateCheckpoint = await Parser.ParserUtils.checkpoint(state);
            await Parser.ParserUtils.restoreCheckpoint(state, checkpoint);
            expect(state.tokenIndex).to.equal(0);
            expect(state.contextState.idCounter).to.equal(0);
            expect(state.currentContextNode).to.equal(undefined);
        });

        it("removes speculative nodes despite gaps in allocated IDs", async () => {
            const state: Parser.ParseState = newState();
            const parser: Parser.Parser = DefaultSettings.parser;

            const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);

            const retained: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
            const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
            const speculative: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
            Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);
            Parser.ParseStateUtils.deleteContext(state);
            Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);
            await parser.restoreCheckpoint(state, checkpoint);

            const maps: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
            expect(maps.astNodeById.size).to.equal(1);
            expect(maps.astNodeById.get(retained.id)).to.equal(retained);
            expect(maps.astNodeById.has(speculative.id)).to.equal(false);
            expect(maps.contextNodeById.size).to.equal(1);
            expect(maps.childIdsById.get(parent.id)).to.deep.equal([retained.id]);
            expect([...maps.leafIds]).to.deep.equal([retained.id]);
            expect(parent.attributeCounter).to.equal(1);
            expect(state.currentContextNode).to.equal(parent);
            expect(state.contextState.idCounter).to.equal(checkpoint.contextStateIdCounter);
            expect(state.tokenIndex).to.equal(checkpoint.tokenIndex);
            expect(state.currentToken?.data).to.equal("text");
        });

        it("supports nested checkpoints and reusing rolled-back IDs", async () => {
            const state: Parser.ParseState = newState();
            const parser: Parser.Parser = DefaultSettings.parser;
            Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);
            const outer: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
            const first: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
            assertAllocationBound(state);
            const inner: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
            const second: Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
            assertAllocationBound(state);
            await parser.restoreCheckpoint(state, inner);
            assertAllocationBound(state);
            expect(await parser.readPrimitiveType(state, parser, undefined)).to.deep.equal(second);
            assertAllocationBound(state);
            await parser.restoreCheckpoint(state, outer);
            assertAllocationBound(state);
            expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(0);
            expect(await parser.readPrimitiveType(state, parser, undefined)).to.deep.equal(first);
            assertAllocationBound(state);
        });
    });
});
