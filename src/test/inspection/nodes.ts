// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { Option, ResultKind } from "../../common";
import { Lexer, LexerSnapshot, TokenPosition, TriedLexerSnapshot } from "../../lexer";
import { Ast, Parser, ParserError } from "../../parser";

type AbridgedNode = ReadonlyArray<[Inspection.NodeKind, Option<TokenPosition>]>;

type AbridgedScope = ReadonlyArray<string>;

interface AbridgedInspection {
    readonly abridgedNode: AbridgedNode;
    readonly scope: AbridgedScope;
}

function abridgedNodeFrom(inspection: Inspection.Inspected): AbridgedNode {
    return inspection.nodes.map(node => [node.kind, node.maybePositionStart]);
}

function abridgedScopeFrom(inspection: Inspection.Inspected): AbridgedScope {
    return [...inspection.scope.keys()];
}

function abridgedInspectionFrom(inspection: Inspection.Inspected): AbridgedInspection {
    return {
        abridgedNode: abridgedNodeFrom(inspection),
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

function expectParseOkAbridgedNodesEqual(text: string, position: Inspection.Position, expected: AbridgedNode): void {
    const parseOk: Parser.ParseOk = expectParseOk(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parseOk.nodeIdMapCollection,
        parseOk.leafNodeIds,
    );
    expectAbridgedNodesEqual(triedInspect, expected);
}

function expectParseErrAbridgedNodesEqual(text: string, position: Inspection.Position, expected: AbridgedNode): void {
    const parserError: ParserError.ParserError = expectParseErr(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parserError.context.nodeIdMapCollection,
        parserError.context.leafNodeIds,
    );
    expectAbridgedNodesEqual(triedInspect, expected);
}

function expectAbridgedNodesEqual(triedInspect: Inspection.TriedInspect, expected: AbridgedNode): void {
    if (!(triedInspect.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspect.kind === ResultKind.Ok: ${triedInspect.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspect.value;
    const actual: AbridgedNode = inspection.nodes.map(node => [node.kind, node.maybePositionStart]);

    expect(actual).deep.equal(expected);
}

function expectParserOkScopeEqual(text: string, position: Inspection.Position, expected: AbridgedScope): void {
    const parseOk: Parser.ParseOk = expectParseOk(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parseOk.nodeIdMapCollection,
        parseOk.leafNodeIds,
    );
    expectScopeEqual(triedInspect, expected);
}

function expectParserErrScopeEqual(text: string, position: Inspection.Position, expected: AbridgedScope): void {
    const parserError: ParserError.ParserError = expectParseErr(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parserError.context.nodeIdMapCollection,
        parserError.context.leafNodeIds,
    );
    expectScopeEqual(triedInspect, expected);
}

function expectScopeEqual(triedInspect: Inspection.TriedInspect, expected: AbridgedScope): void {
    if (!(triedInspect.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspect.kind === ResultKind.Ok: ${triedInspect.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspect.value;
    const actual: ReadonlyArray<string> = abridgedScopeFrom(inspection);

    expect(actual).deep.equal(expected);
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
    describe(`Nodes`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast & ParserContext)`, () => {
            it(`|each 1`, () => {
                const text: string = `each 1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: AbridgedInspection = {
                    abridgedNode: [],
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
                    abridgedNode: [
                        [
                            Inspection.NodeKind.EachExpression,
                            {
                                lineCodeUnit: 0,
                                lineNumber: 0,
                                codeUnit: 0,
                            },
                        ],
                    ],
                    scope: [`_`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`|each`, () => {
                const text: string = `each`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: AbridgedInspection = {
                    abridgedNode: [],
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
                    abridgedNode: [
                        [
                            Inspection.NodeKind.EachExpression,
                            {
                                lineCodeUnit: 0,
                                lineNumber: 0,
                                codeUnit: 0,
                            },
                        ],
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
                    abridgedNode: [
                        [
                            Inspection.NodeKind.EachExpression,
                            {
                                lineCodeUnit: 5,
                                lineNumber: 0,
                                codeUnit: 5,
                            },
                        ],
                        [
                            Inspection.NodeKind.EachExpression,
                            {
                                lineCodeUnit: 0,
                                lineNumber: 0,
                                codeUnit: 0,
                            },
                        ],
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
                    abridgedNode: [
                        [
                            Inspection.NodeKind.EachExpression,
                            {
                                lineCodeUnit: 5,
                                lineNumber: 0,
                                codeUnit: 5,
                            },
                        ],
                        [
                            Inspection.NodeKind.EachExpression,
                            {
                                lineCodeUnit: 0,
                                lineNumber: 0,
                                codeUnit: 0,
                            },
                        ],
                    ],
                    scope: [`_`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression} (Ast & ParserContext)`, () => {
            it(`|{1}`, () => {
                const text: string = `{1}`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: AbridgedNode = [];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`{|1}`, () => {
                const text: string = `{1}`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`{1|}`, () => {
                const text: string = `{1}`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`{1}|`, () => {
                const text: string = `{1}`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 3,
                };
                const expected: AbridgedNode = [];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`|{1`, () => {
                const text: string = `{1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: AbridgedNode = [];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`{|1`, () => {
                const text: string = `{1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`{|1`, () => {
                const text: string = `{1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`{1|`, () => {
                const text: string = `{1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`{{|1}}`, () => {
                const text: string = `{{1}}`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 1,
                            lineNumber: 0,
                            codeUnit: 1,
                        },
                    ],
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`{{|1`, () => {
                const text: string = `{{1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 1,
                            lineNumber: 0,
                            codeUnit: 1,
                        },
                    ],
                    [
                        Inspection.NodeKind.List,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast & ParserContext)`, () => {
            it(`|[a=1]`, () => {
                const text: string = `[a=1]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: AbridgedNode = [];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`[|a=1]`, () => {
                const text: string = `[a=1]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`[a=1|]`, () => {
                const text: string = `[a=1]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`[a=1]|`, () => {
                const text: string = `[a=1]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 5,
                };
                const expected: AbridgedNode = [];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`|[a=1`, () => {
                const text: string = `[a=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: AbridgedNode = [];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`[|a=1`, () => {
                const text: string = `[a=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`[a=|1`, () => {
                const text: string = `[a=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 3,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`[a=1|`, () => {
                const text: string = `[a=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });

            it(`[a=[|b=1]]`, () => {
                const text: string = `[a=[|b=1]]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 3,
                            lineNumber: 0,
                            codeUnit: 3,
                        },
                    ],
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseOkAbridgedNodesEqual(text, position, expected);
            });

            it(`[a=[|b=1`, () => {
                const text: string = `[a=[b=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: AbridgedNode = [
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 3,
                            lineNumber: 0,
                            codeUnit: 3,
                        },
                    ],
                    [
                        Inspection.NodeKind.Record,
                        {
                            lineCodeUnit: 0,
                            lineNumber: 0,
                            codeUnit: 0,
                        },
                    ],
                ];
                expectParseErrAbridgedNodesEqual(text, position, expected);
            });
        });
    });

    describe(`Scope`, () => {
        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`|@foo`, () => {
                const text: string = `@foo`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`@foo|`, () => {
                const text: string = `@foo`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: ReadonlyArray<string> = [`@foo`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`@|foo`, () => {
                const text: string = `@foo`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: ReadonlyArray<string> = [`@foo`];
                expectParserOkScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, () => {
                const text: string = `(x) => z`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`(x|, y) => z`, () => {
                const text: string = `(x, y) => z`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`(x, y)| => z`, () => {
                const text: string = `(x, y) => z`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 6,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`(x, y) => z|`, () => {
                const text: string = `(x, y) => z`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 11,
                };
                const expected: ReadonlyArray<string> = [`z`, `x`, `y`];
                expectParserOkScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, () => {
                const text: string = `(x) =>`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`(x|, y) =>`, () => {
                const text: string = `(x, y) =>`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`(x, y)| =>`, () => {
                const text: string = `(x, y) =>`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 6,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`(x, y) =>|`, () => {
                const text: string = `(x, y) =>`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 9,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserErrScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression} (Ast)`, () => {
            it(`|foo(x)`, () => {
                const text: string = `foo(x)`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`foo(x, y|)`, () => {
                const text: string = `foo(x, y)`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 8,
                };
                const expected: ReadonlyArray<string> = [`y`, `x`, `foo`];
                expectParserOkScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.InvokeExpression} (ParserContext)`, () => {
            it(`|foo(x`, () => {
                const text: string = `foo(x`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`foo(x, y|`, () => {
                const text: string = `foo(x, y`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 8,
                };
                const expected: ReadonlyArray<string> = [`y`, `x`, `foo`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`foo(x, y|,`, () => {
                const text: string = `foo(x, y,`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 8,
                };
                const expected: ReadonlyArray<string> = [`y`, `x`, `foo`];
                expectParserErrScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}/${Ast.NodeKind.RecordLiteral} (Ast)`, () => {
            it(`|[x=1] section;`, () => {
                const text: string = `[x=1] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=1] section;|`, () => {
                const text: string = `[x=1] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 14,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=1]| section;`, () => {
                const text: string = `[x=1] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 5,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=1|] section;`, () => {
                const text: string = `[x=1] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x|=1] section;`, () => {
                const text: string = `[x=1] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=1|, y=2] section;`, () => {
                const text: string = `[x=1, y=2] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=1, y=2|] section;`, () => {
                const text: string = `[x=1, y=2] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 9,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=1, y=2|, z=3] section;`, () => {
                const text: string = `[x=1, y=2, z=3] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 9,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`[x=[y=1|]] section;`, () => {
                const text: string = `[x=[y=1|]] section;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 7,
                };
                const expected: ReadonlyArray<string> = [`y`, `x`];
                expectParserOkScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}/${Ast.NodeKind.RecordLiteral} (ParserContext)`, () => {
            it(`[x=1|`, () => {
                const text: string = `[x=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`[x=1|, y=1`, () => {
                const text: string = `[x=1, y=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`[x=1, y=1|`, () => {
                const text: string = `[x=1, y=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 9,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`[x=[y=1|`, () => {
                const text: string = `[x=[y=1`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 7,
                };
                const expected: ReadonlyArray<string> = [`y`, `x`];
                expectParserErrScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, () => {
                const text: string = `section foo; x = 1; y = 2;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`section foo; x = 1|; y = 2;`, () => {
                const text: string = `section foo; x = 1; y = 2;`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 18,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserOkScopeEqual(text, position, expected);
            });

            it(`section foo; x = 1; y = 2;|`, () => {
                const text: string = `section foo; x = 1; y = 2;|`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 26,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserOkScopeEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            it(`s|ection foo; x = 1; y = 2`, () => {
                const text: string = `section foo; x = 1; y = 2`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: ReadonlyArray<string> = [];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`section foo; x = 1|; y = 2`, () => {
                const text: string = `section foo; x = 1; y = 2`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 18,
                };
                const expected: ReadonlyArray<string> = [`x`];
                expectParserErrScopeEqual(text, position, expected);
            });

            it(`section foo; x = 1; y = 2|`, () => {
                const text: string = `section foo; x = 1; y = 2|`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 25,
                };
                const expected: ReadonlyArray<string> = [`x`, `y`];
                expectParserErrScopeEqual(text, position, expected);
            });
        });
    });
});
