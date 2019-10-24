// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { ResultKind } from "../../common";
import { NodeKind, TNode } from "../../inspection";
import { Ast, ParseOk, ParseError } from "../../parser";
import { expectParseErr, expectParseOk } from "./common";

type AbridgedScope = ReadonlyArray<string>;

interface AbridgedInspection {
    readonly nodes: ReadonlyArray<TNode>;
    readonly scope: AbridgedScope;
}

function abridgedInspectionFrom(inspection: Inspection.Inspected): AbridgedInspection {
    return {
        nodes: inspection.nodes,
        scope: [...inspection.scope.keys()],
    };
}

function expectParseOkAbridgedInspectionEqual(
    text: string,
    position: Inspection.Position,
    expected: AbridgedInspection,
): void {
    const parseOk: ParseOk = expectParseOk(text);
    const triedInspection: Inspection.TriedInspection = Inspection.tryFrom(
        position,
        parseOk.nodeIdMapCollection,
        parseOk.leafNodeIds,
    );
    expectAbridgedInspectionEqual(triedInspection, expected);
}

function expectParseErrAbridgedInspectionEqual(
    text: string,
    position: Inspection.Position,
    expected: AbridgedInspection,
): void {
    const parserError: ParseError.ParseError = expectParseErr(text);
    const triedInspection: Inspection.TriedInspection = Inspection.tryFrom(
        position,
        parserError.context.nodeIdMapCollection,
        parserError.context.leafNodeIds,
    );
    expectAbridgedInspectionEqual(triedInspection, expected);
}

function expectAbridgedInspectionEqual(
    triedInspection: Inspection.TriedInspection,
    expected: AbridgedInspection,
): void {
    if (!(triedInspection.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspection.kind === ResultKind.Ok: ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: AbridgedInspection = abridgedInspectionFrom(inspection);

    expect(actual).deep.equal(expected);
}

// Only works with single line expressions
function textWithPosition(text: string): [string, Inspection.Position] {
    expect(text.indexOf("|")).to.be.greaterThan(-1, "text must have | marker");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "text must only have one |");

    const index: number = text.indexOf("|");
    if (index > -1) {
        const position: Inspection.Position = {
            lineNumber: 0,
            lineCodeUnit: index,
        };

        return [text.replace("|", ""), position];
    }

    throw new Error("bad marker text");
}

describe(`Inspection`, () => {
    describe(`AbridgedInspected`, () => {
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
                            maybeArguments: {
                                numArguments: 2,
                                positionArgumentIndex: 1,
                            },
                        },
                    ],
                    scope: [`y`, `x`, `foo`],
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
                            maybeArguments: {
                                numArguments: 1,
                                positionArgumentIndex: 0,
                            },
                        },
                    ],
                    scope: [`y`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`foo(|)`, () => {
                const text: string = `foo()`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
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
                                codeUnit: 5,
                                lineCodeUnit: 5,
                                lineNumber: 0,
                            },
                            maybeName: `foo`,
                            maybeArguments: {
                                numArguments: 0,
                                positionArgumentIndex: 0,
                            },
                        },
                    ],
                    scope: [`foo`],
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
                            maybeArguments: {
                                numArguments: 2,
                                positionArgumentIndex: 1,
                            },
                        },
                    ],
                    scope: [`y`, `x`, `foo`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });

            it(`foo(|`, () => {
                const text: string = `foo(`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 4,
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
                            maybeArguments: {
                                numArguments: 1,
                                positionArgumentIndex: 0,
                            },
                        },
                    ],
                    scope: [`foo`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });

            it(`foo(x,|`, () => {
                const [text, position] = textWithPosition(`foo(x,|`);
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
                            maybeArguments: {
                                numArguments: 2,
                                positionArgumentIndex: 1,
                            },
                        },
                    ],
                    scope: [`x`, `foo`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });

            it(`foo(x, |`, () => {
                const [text, position] = textWithPosition(`foo(x, |`);
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
                            maybeArguments: {
                                numArguments: 2,
                                positionArgumentIndex: 1,
                            },
                        },
                    ],
                    scope: [`x`, `foo`],
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
                            maybeArguments: {
                                numArguments: 1,
                                positionArgumentIndex: 0,
                            },
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
            // TODO (issue #61): should we be providing scope members if cursor is on section declaration?
            it(`s|ection foo; x = 1; y = 2;`, () => {
                const [text, position] = textWithPosition(`s|ection foo; x = 1; y = 2;`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`x`, `y`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`section foo; x = 1|; y = 2;`, () => {
                const [text, position] = textWithPosition(`section foo; x = 1|; y = 2;`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`y`],
                };

                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`section foo; x = 1; y = 2;|`, () => {
                const [text, position] = textWithPosition(`section foo; x = 1; y = 2;|`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`x`, `y`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`section foo; x = 1; y = 2; z = let a = 1 in |a;`, () => {
                const [text, position] = textWithPosition(`section foo; x = 1; y = 2; z = let a = 1 in |a;`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a`, `x`, `y`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            // TODO (issue #61): should we be providing scope members if cursor is on section declaration?
            it(`s|ection foo; x = 1; y = 2`, () => {
                const [text, position] = textWithPosition(`s|ection foo; x = 1; y = 2`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`x`, `y`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });

            it(`section foo; x = 1|; y = 2`, () => {
                const [text, position] = textWithPosition(`section foo; x = 1|; y = 2`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`y`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });

            it(`section foo; x = 1; y = 2|`, () => {
                const [text, position] = textWithPosition(`section foo; x = 1; y = 2|`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`x`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1, b = 2, c = |3 in c`, () => {
                const [text, position] = textWithPosition(`let a = 1, b = 2, c = |3 in c`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a`, `b`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`(p1, p2) => let a = 1, b = 2, c = |3 in c`, () => {
                const [text, position] = textWithPosition(`(p1, p2) => let a = 1, b = 2, c = |3 in c`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a`, `b`, `p1`, `p2`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`let a = let a1 = 1 in a1, b = 2, c = |3 in c`, () => {
                const [text, position] = textWithPosition(`let a = let a1 = 1 in a1, b = 2, c = |3 in c`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a`, `b`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });

            it(`let a = let a1 = 1 in |a1, b = 2, c = 3 in c`, () => {
                const [text, position] = textWithPosition(`let a = let a1 = 1 in |a1, b = 2, c = 3 in c`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a1`, `b`, `c`],
                };
                expectParseOkAbridgedInspectionEqual(text, position, expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1, b = 2, c = 3 in |`, () => {
                const [text, position] = textWithPosition(`let a = 1, b = 2, c = 3 in |`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a`, `b`, `c`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });

            it(`let a = let a = 1 in | in a`, () => {
                const [text, position] = textWithPosition(`let a = let a = 1 in | in a`);
                const expected: AbridgedInspection = {
                    nodes: [],
                    scope: [`a`],
                };
                expectParseErrAbridgedInspectionEqual(text, position, expected);
            });
        });
    });
});
