// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Parser, Task, TaskUtils } from "../../..";

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

describe("Checkpoint delta rollback", () => {
    it("rewinds the cursor and context even when no IDs were allocated", async () => {
        const state: Parser.ParseState = newState();

        const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
            state,
            Language.Ast.NodeKind.ListType,
        );

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
        Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ListType);
        const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        const first: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);

        const inner: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
            state,
            Language.Ast.NodeKind.ListType,
        );

        const second: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);

        const last: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
            state,
            Language.Ast.NodeKind.ListType,
        );

        const maps: Parser.NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
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

        const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
            state,
            Language.Ast.NodeKind.ListType,
        );

        const retained: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        const speculative: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ListType);
        Parser.ParseStateUtils.deleteContext(state);
        Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ListType);
        await parser.restoreCheckpoint(state, checkpoint);

        const maps: Parser.NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
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
        Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ListType);
        const outer: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        const first: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        const inner: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        const second: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        await parser.restoreCheckpoint(state, inner);
        expect(await parser.readPrimitiveType(state, parser, undefined)).to.deep.equal(second);
        await parser.restoreCheckpoint(state, outer);
        expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(0);
        expect(await parser.readPrimitiveType(state, parser, undefined)).to.deep.equal(first);
    });
});
