// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "..";
import { Option, ResultKind } from "../common";
import { NodeKind, TNode } from "../inspection";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../lexer";
import { Ast, Parser, ParserError } from "../parser";

type AbridgedScope = ReadonlyArray<string>;

interface AbridgedInspection {
    readonly nodes: ReadonlyArray<TNode>;
    readonly scope: AbridgedScope;
}

function abridgedScopeFrom(inspection: Inspection.Inspected): AbridgedScope {
    return [...inspection.scope.keys()];
}

function abridgedInspectionFrom(inspection: Inspection.Inspected): AbridgedInspection {
    return {
        nodes: inspection.nodes,
        scope: abridgedScopeFrom(inspection),
    };
}

function expectTriedParse(text: string): Parser.TriedParse {
    const state: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (!(maybeErrorLineMap === undefined)) {
        throw new Error(`AssertFailed: maybeErrorLineMap === undefined`);
    }

    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    if (!(triedSnapshot.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedSnapshot.kind === ResultKind.Ok: ${triedSnapshot.error.message}`);
    }
    const snapshot: LexerSnapshot = triedSnapshot.value;

    return Parser.tryParse(snapshot);
}

function expectParseErr(text: string): ParserError.ParserError {
    const triedParse: Parser.TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Err`);
    }

    if (!(triedParse.error instanceof ParserError.ParserError)) {
        throw new Error(`AssertFailed: triedParse.error instanceof ParserError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

function expectParseOk(text: string): Parser.ParseOk {
    const triedParse: Parser.TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Ok: ${triedParse.error.message}`);
    }
    return triedParse.value;
}

function expectParseOkAbridgedInspectionEqual(
    text: string,
    position: Inspection.Position,
    expected: AbridgedInspection,
): void {
    const parseOk: Parser.ParseOk = expectParseOk(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parseOk.nodeIdMapCollection,
        parseOk.leafNodeIds,
    );
    expectAbridgedInspectionEqual(triedInspect, expected);
}

function expectParseErrAbridgedInspectionEqual(
    text: string,
    position: Inspection.Position,
    expected: AbridgedInspection,
): void {
    const parserError: ParserError.ParserError = expectParseErr(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parserError.context.nodeIdMapCollection,
        parserError.context.leafNodeIds,
    );
    expectAbridgedInspectionEqual(triedInspect, expected);
}

function expectAbridgedInspectionEqual(triedInspect: Inspection.TriedInspect, expected: AbridgedInspection): void {
    if (!(triedInspect.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspect.kind === ResultKind.Ok: ${triedInspect.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspect.value;
    const actual: AbridgedInspection = abridgedInspectionFrom(inspection);

    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
        it(`|each 1`, () => {
            const text: string = `each 1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`|each 1`, () => {
            const text: string = `each 1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.EachExpression,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 6,
                            lineCodeUnit: 6,
                            lineNumber: 0,
                        },
                    },
                ],
                scope: [`_`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`each each|`, () => {
            const text: string = `each each`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 9,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.EachExpression,
                        maybePositionStart: {
                            codeUnit: 5,
                            lineCodeUnit: 5,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                    {
                        kind: NodeKind.EachExpression,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [`_`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
        it(`|each`, () => {
            const text: string = `each`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`each|`, () => {
            const text: string = `each`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.EachExpression,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [`_`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`each each 1|`, () => {
            const text: string = `each each 1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 11,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.EachExpression,
                        maybePositionStart: {
                            codeUnit: 5,
                            lineCodeUnit: 5,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 11,
                            lineCodeUnit: 11,
                            lineNumber: 0,
                        },
                    },
                    {
                        kind: NodeKind.EachExpression,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 11,
                            lineCodeUnit: 11,
                            lineNumber: 0,
                        },
                    },
                ],
                scope: [`_`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
        it(`|(x) => z`, () => {
            const text: string = `(x) => z`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`(x|, y) => z`, () => {
            const text: string = `(x, y) => z`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 2,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`(x, y)| => z`, () => {
            const text: string = `(x, y) => z`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 6,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`, `y`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`(x, y) => z|`, () => {
            const text: string = `(x, y) => z`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 11,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`z`, `x`, `y`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
        it(`|(x) =>`, () => {
            const text: string = `(x) =>`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`(x|, y) =>`, () => {
            const text: string = `(x, y) =>`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 2,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`(x, y)| =>`, () => {
            const text: string = `(x, y) =>`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 6,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`, `y`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`(x, y) =>|`, () => {
            const text: string = `(x, y) =>`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 9,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`, `y`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
        it(`|foo`, () => {
            const text: string = `foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`f|oo`, () => {
            const text: string = `foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`foo|`, () => {
            const text: string = `foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 3,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`|@foo`, () => {
            const text: string = `@foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`@|foo`, () => {
            const text: string = `@foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`@foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`@f|oo`, () => {
            const text: string = `@foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 2,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`@foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`@foo|`, () => {
            const text: string = `@foo`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`@foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression} (Ast)`, () => {
        it(`|foo(x)`, () => {
            const text: string = `foo(x)`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`foo(x, y|)`, () => {
            const text: string = `foo(x, y)`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 8,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.InvokeExpression,
                        maybePositionStart: {
                            codeUnit: 3,
                            lineCodeUnit: 3,
                            lineNumber: 0,
                        },
                        maybeName: "foo",
                        maybePositionEnd: {
                            codeUnit: 9,
                            lineCodeUnit: 9,
                            lineNumber: 0,
                        },
                    },
                ],
                scope: [`x`, `y`, `foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`foo(x, y)|`, () => {
            const text: string = `foo(x, y)`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 9,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`foo`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`[x](y|)`, () => {
            const text: string = `[x](y)`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 5,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.InvokeExpression,

                        maybePositionStart: {
                            codeUnit: 3,
                            lineCodeUnit: 3,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 6,
                            lineCodeUnit: 6,
                            lineNumber: 0,
                        },
                        maybeName: undefined,
                    },
                ],
                scope: [`y`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression} (ParserContext)`, () => {
        it(`|foo(x`, () => {
            const text: string = `foo(x`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`foo(x, y|`, () => {
            const text: string = `foo(x, y`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 8,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.InvokeExpression,
                        maybePositionStart: {
                            codeUnit: 3,
                            lineCodeUnit: 3,
                            lineNumber: 0,
                        },
                        maybeName: "foo",
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [`y`, `x`, `foo`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`[x](y|`, () => {
            const text: string = `[x](y`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 5,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.InvokeExpression,

                        maybePositionStart: {
                            codeUnit: 3,
                            lineCodeUnit: 3,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                        maybeName: undefined,
                    },
                ],
                scope: [`y`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.ListExpression} (ParserContext)`, () => {
        it(`|{1`, () => {
            const text: string = `{1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`{|1`, () => {
            const text: string = `{1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.List,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`{|1`, () => {
            const text: string = `{1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.List,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`{1|`, () => {
            const text: string = `{1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 2,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.List,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`{{|1`, () => {
            const text: string = `{{1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 2,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.List,
                        maybePositionStart: {
                            codeUnit: 1,
                            lineCodeUnit: 1,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                    {
                        kind: NodeKind.List,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
        it(`|[a=1]`, () => {
            const text: string = `[a=1]`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`[|a=1]`, () => {
            const text: string = `[a=1]`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 5,
                            lineCodeUnit: 5,
                            lineNumber: 0,
                        },
                    },
                ],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`[a=1|]`, () => {
            const text: string = `[a=1]`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 5,
                            lineCodeUnit: 5,
                            lineNumber: 0,
                        },
                    },
                ],
                scope: [`a`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`[a=1]|`, () => {
            const text: string = `[a=1]`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 5,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`[a=[|b=1]]`, () => {
            const text: string = `[a=[|b=1]]`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 3,
                            lineCodeUnit: 3,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 9,
                            lineCodeUnit: 9,
                            lineNumber: 0,
                        },
                    },
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: {
                            codeUnit: 10,
                            lineCodeUnit: 10,
                            lineNumber: 0,
                        },
                    },
                ],
                scope: [`a`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
        it(`|[a=1`, () => {
            const text: string = `[a=1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 0,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`[|a=1`, () => {
            const text: string = `[a=1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`[a=|1`, () => {
            const text: string = `[a=1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 3,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [`a`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`[a=1|`, () => {
            const text: string = `[a=1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [`a`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`[a=[|b=1`, () => {
            const text: string = `[a=[b=1`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 4,
            };
            const expected: AbridgedInspection = {
                nodes: [
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 3,
                            lineCodeUnit: 3,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                    {
                        kind: NodeKind.Record,
                        maybePositionStart: {
                            codeUnit: 0,
                            lineCodeUnit: 0,
                            lineNumber: 0,
                        },
                        maybePositionEnd: undefined,
                    },
                ],
                scope: [`a`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.SectionMember} (Ast)`, () => {
        it(`s|ection foo; x = 1; y = 2;`, () => {
            const text: string = `section foo; x = 1; y = 2;`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`section foo; x = 1|; y = 2;`, () => {
            const text: string = `section foo; x = 1; y = 2;`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 18,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`],
            };

            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });

        it(`section foo; x = 1; y = 2;|`, () => {
            const text: string = `section foo; x = 1; y = 2;|`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 26,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`, `y`],
            };
            expectParseOkAbridgedInspectionEqual(text, position, expected);
        });
    });

    describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
        it(`s|ection foo; x = 1; y = 2`, () => {
            const text: string = `section foo; x = 1; y = 2`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 1,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`section foo; x = 1|; y = 2`, () => {
            const text: string = `section foo; x = 1; y = 2`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 18,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });

        it(`section foo; x = 1; y = 2|`, () => {
            const text: string = `section foo; x = 1; y = 2|`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 25,
            };
            const expected: AbridgedInspection = {
                nodes: [],
                scope: [`x`, `y`],
            };
            expectParseErrAbridgedInspectionEqual(text, position, expected);
        });
    });
});
