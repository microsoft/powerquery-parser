// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, CommonError, DefaultSettings, ICancellationToken, Language, Parser, Task, TaskUtils } from "../../..";

class CountingContexts extends Map<number, Parser.ParseContext.TNode> {
    public leafContexts: number = 0;

    public override set(id: number, node: Parser.ParseContext.TNode): this {
        if (
            node.kind === Language.Ast.NodeKind.Identifier ||
            node.kind === Language.Ast.NodeKind.LiteralExpression ||
            node.kind === Language.Ast.NodeKind.Constant
        ) {
            this.leafContexts += 1;
        }

        return super.set(id, node);
    }
}

class CancelOnCheck implements ICancellationToken {
    private checks: number = 0;
    private cancelled: boolean = false;
    private readonly limit: number;

    constructor(limit: number) {
        this.limit = limit;
    }

    public isCancelled(): boolean {
        return this.cancelled;
    }

    public cancel(_reason: string): void {
        this.cancelled = true;
    }

    public throwIfCancelled(): void {
        this.checks += 1;

        if (this.checks >= this.limit) {
            this.cancel("test");
        }

        if (this.cancelled) {
            throw new CommonError.CancellationError(this, "test");
        }
    }
}

function newState(
    text: string,
    cancellationToken?: ICancellationToken,
): { state: Parser.ParseState; contexts: CountingContexts } {
    const lex: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, text);
    TaskUtils.assertIsLexStageOk(lex);
    const contextState: Parser.ParseContext.State = Parser.ParseContextUtils.newState();
    const contexts: CountingContexts = new CountingContexts();

    return {
        contexts,
        state: Parser.ParseStateUtils.newState(lex.lexerSnapshot, {
            cancellationToken,
            contextState: {
                ...contextState,
                nodeIdMapCollection: { ...contextState.nodeIdMapCollection, contextNodeById: contexts },
            },
        }),
    };
}

interface LeafCase {
    readonly text: string;
    readonly kind: Language.Ast.NodeKind;
    readonly cancelOnCheck: number;
    readonly read: (state: Parser.ParseState) => Language.Ast.TNode;
}

const Cases: ReadonlyArray<LeafCase> = [
    {
        text: "identifier",
        kind: Language.Ast.NodeKind.Identifier,
        cancelOnCheck: 1,
        read: (state: Parser.ParseState) =>
            DefaultSettings.parser.readIdentifier(
                state,
                DefaultSettings.parser,
                Language.Ast.IdentifierContextKind.Value,
                undefined,
            ),
    },
    {
        text: '"\u006e\u0303\ntext"',
        kind: Language.Ast.NodeKind.LiteralExpression,
        cancelOnCheck: 2,
        read: (state: Parser.ParseState) =>
            DefaultSettings.parser.readLiteralExpression(state, DefaultSettings.parser, undefined),
    },
    {
        text: ";",
        kind: Language.Ast.NodeKind.Constant,
        cancelOnCheck: 2,
        read: (state: Parser.ParseState) =>
            Parser.NaiveParseSteps.readTokenKindAsConstant(
                state,
                Language.Token.TokenKind.Semicolon,
                Language.Constant.MiscConstant.Semicolon,
                undefined,
            ),
    },
    {
        text: ")",
        kind: Language.Ast.NodeKind.Constant,
        cancelOnCheck: 2,
        read: (state: Parser.ParseState) =>
            Parser.NaiveParseSteps.readClosingTokenKindAsConstant(
                state,
                Language.Token.TokenKind.RightParenthesis,
                Language.Constant.WrapperConstant.RightParenthesis,
                undefined,
            ),
    },
    {
        text: ";",
        kind: Language.Ast.NodeKind.Constant,
        cancelOnCheck: 2,
        read: (state: Parser.ParseState) =>
            Assert.asDefined(
                Parser.NaiveParseSteps.readTokenKindAsConstantOrUndefined(
                    state,
                    Language.Token.TokenKind.Semicolon,
                    Language.Constant.MiscConstant.Semicolon,
                ),
            ),
    },
];

describe("Direct leaf construction", () => {
    for (const [index, leafCase] of Cases.entries()) {
        it(`registers leaf ${index} without a temporary context`, () => {
            const { state, contexts }: ReturnType<typeof newState> = newState(leafCase.text);
            const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
                state,
                Language.Ast.NodeKind.ArrayWrapper,
            );

            const leaf: Language.Ast.TNode = leafCase.read(state);
            const maps: Parser.NodeIdMap.Collection = state.contextState.nodeIdMapCollection;

            expect(contexts.leafContexts).to.equal(0);
            expect(leaf.id).to.equal(2);
            expect(leaf.attributeIndex).to.equal(0);
            expect(leaf.tokenRange.positionStart).to.deep.equal(state.lexerSnapshot.tokens[0].positionStart);
            expect(leaf.tokenRange.positionEnd).to.deep.equal(state.lexerSnapshot.tokens[0].positionEnd);
            expect(maps.astNodeById.get(2)).to.equal(leaf);
            expect(maps.parentIdById.get(2)).to.equal(parent.id);
            expect(maps.childIdsById.get(parent.id)).to.deep.equal([2]);
            expect([...maps.leafIds]).to.deep.equal([2]);
            expect([...Assert.asDefined(maps.idsByNodeKind.get(leaf.kind))]).to.deep.equal([2]);
            expect(maps.rightMostLeaf).to.equal(leaf);
            expect(parent.attributeCounter).to.equal(1);
            expect(state.currentContextNode).to.equal(parent);
        });

        it(`retains the root context for leaf ${index}`, () => {
            const { state, contexts }: ReturnType<typeof newState> = newState(leafCase.text);
            const leaf: Language.Ast.TNode = leafCase.read(state);
            expect(contexts.leafContexts).to.equal(1);
            expect(state.contextState.root?.id).to.equal(leaf.id);
            expect(state.contextState.root?.isClosed).to.equal(true);
            expect(state.currentContextNode).to.equal(undefined);
        });

        it(`retains a pending context when leaf ${index} is cancelled at token consumption`, () => {
            const { state, contexts }: ReturnType<typeof newState> = newState(
                leafCase.text,
                new CancelOnCheck(leafCase.cancelOnCheck),
            );

            Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ArrayWrapper);
            expect(() => leafCase.read(state)).to.throw(CommonError.CancellationError);
            expect(contexts.leafContexts).to.equal(1);
            expect(state.currentContextNode?.kind).to.equal(leafCase.kind);
            expect(state.currentContextNode?.id).to.equal(2);
            expect(state.tokenIndex).to.equal(0);
            expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(0);
        });
    }

    it("retains diagnostic contexts for required identifier and literal mismatches", () => {
        for (const [index, text] of ["42", "identifier"].entries()) {
            const { state, contexts }: ReturnType<typeof newState> = newState(text);
            Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ArrayWrapper);
            expect(() => Cases[index].read(state)).to.throw();
            expect(contexts.leafContexts).to.equal(1);
            expect(state.currentContextNode?.kind).to.equal(Cases[index].kind);
            expect(state.tokenIndex).to.equal(0);
        }
    });

    it("increments the attribute counter without allocating an absent optional constant", () => {
        const { state, contexts }: ReturnType<typeof newState> = newState("identifier");
        const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
            state,
            Language.Ast.NodeKind.ArrayWrapper,
        );

        const result: Language.Ast.TNode | undefined = Parser.NaiveParseSteps.readTokenKindAsConstantOrUndefined(
            state,
            Language.Token.TokenKind.Semicolon,
            Language.Constant.MiscConstant.Semicolon,
        );

        expect(result).to.equal(undefined);
        expect(parent.attributeCounter).to.equal(1);
        expect(state.contextState.idCounter).to.equal(1);
        expect(contexts.leafContexts).to.equal(0);
    });

    it("retains a pending constant context for a missing required or closing token", () => {
        for (const leafCase of Cases.slice(2, 4)) {
            const { state, contexts }: ReturnType<typeof newState> = newState("identifier");
            Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ArrayWrapper);
            expect(() => leafCase.read(state)).to.throw();
            expect(contexts.leafContexts).to.equal(1);
            expect(state.currentContextNode?.kind).to.equal(Language.Ast.NodeKind.Constant);
            expect(state.tokenIndex).to.equal(0);
        }
    });

    it("retains the context and consumed token on a constant-text invariant failure", () => {
        const { state, contexts }: ReturnType<typeof newState> = newState(";");
        Parser.ParseStateUtils.startContext(state, Language.Ast.NodeKind.ArrayWrapper);

        expect(() =>
            Parser.NaiveParseSteps.readTokenKindAsConstant(
                state,
                Language.Token.TokenKind.Semicolon,
                Language.Constant.MiscConstant.Comma,
                undefined,
            ),
        ).to.throw(CommonError.InvariantError);

        expect(contexts.leafContexts).to.equal(1);
        expect(state.currentContextNode?.kind).to.equal(Language.Ast.NodeKind.Constant);
        expect(state.tokenIndex).to.equal(1);
    });
});
