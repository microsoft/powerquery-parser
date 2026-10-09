// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Parser, Task, TaskUtils } from "../../..";

class NoScanMap<K, V> extends Map<K, V> {
    public override keys(): MapIterator<K> {
        throw new Error("Checkpoint restoration must not scan accumulated nodes");
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

describe("Parser checkpoint restoration", () => {
    it("restores a no-op checkpoint without scanning node maps", async () => {
        const state: Parser.ParseState = newState();
        const checkpoint: Parser.ParseStateCheckpoint = await Parser.ParserUtils.checkpoint(state);
        await Parser.ParserUtils.restoreCheckpoint(state, checkpoint);
        expect(state.tokenIndex).to.equal(0);
        expect(state.contextState.idCounter).to.equal(0);
        expect(state.currentContextNode).to.equal(undefined);
    });

    it("removes speculative AST and context nodes, including gaps in allocated IDs", async () => {
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
        expect(maps.contextNodeById.get(parent.id)).to.equal(parent);
        expect(maps.childIdsById.get(parent.id)).to.deep.equal([retained.id]);
        expect([...maps.leafIds]).to.deep.equal([retained.id]);
        expect([...maps.parentIdById]).to.deep.equal([[retained.id, parent.id]]);
        expect(parent.attributeCounter).to.equal(1);
        expect(state.currentContextNode).to.equal(parent);
        expect(state.contextState.idCounter).to.equal(checkpoint.contextStateIdCounter);
        expect(state.tokenIndex).to.equal(checkpoint.tokenIndex);
        expect(state.currentToken?.data).to.equal("text");
        expect(state.currentTokenKind).to.equal(Language.Token.TokenKind.Identifier);
    });

    it("handles nested checkpoints and reuses rolled-back IDs", async () => {
        const state: Parser.ParseState = newState();
        const parser: Parser.Parser = DefaultSettings.parser;
        Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ListType);
        const outer: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        const first: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        const inner: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        const second: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        await parser.restoreCheckpoint(state, inner);
        const reread: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        expect(reread).to.deep.equal(second);
        await parser.restoreCheckpoint(state, outer);
        expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(0);
        const restarted: Language.Ast.PrimitiveType = await parser.readPrimitiveType(state, parser, undefined);
        expect(restarted).to.deep.equal(first);
    });
});
