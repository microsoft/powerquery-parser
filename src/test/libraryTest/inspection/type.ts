// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, DefaultSettings, Inspection, InspectionSettings, Parser, Settings, Task } from "../../..";
import { Ast, ExternalType, Type, TypeUtils } from "../../../powerquery-parser/language";
import { TestAssertUtils } from "../../testUtils";

const ExternalTypeResolver: ExternalType.TExternalTypeResolverFn = (request: ExternalType.TExternalTypeRequest) => {
    switch (request.kind) {
        case ExternalType.ExternalTypeRequestKind.Invocation: {
            if (request.identifierLiteral !== "foo") {
                return undefined;
            }

            return request.args.length === 0 ? Type.TextInstance : Type.NumberInstance;
        }

        case ExternalType.ExternalTypeRequestKind.Value:
            return request.identifierLiteral === "foo" ? Type.FunctionInstance : undefined;

        default:
            throw Assert.isNever(request);
    }
};

const TestSettings: Settings = {
    ...DefaultSettings,
    maybeExternalTypeResolver: ExternalTypeResolver,
};

function assertParseOkNodeTypeEqual(settings: Settings, text: string, expected: Type.TType): void {
    const lexParseOk: Task.LexParseOk = TestAssertUtils.assertGetLexParseOk(TestSettings, text);
    const actual: Type.TType = assertGetParseNodeOk(
        settings,
        lexParseOk.state.contextState.nodeIdMapCollection,
        lexParseOk.state.contextState.leafNodeIds,
        Parser.XorNodeUtils.astFactory(lexParseOk.root),
    );

    expect(actual).deep.equal(expected);
}

function assertParseErrNodeTypeEqual(text: string, expected: Type.TType): void {
    const parseErr: Parser.ParseError.ParseError<Parser.IParseState> = TestAssertUtils.assertGetParseErr(
        TestSettings,
        text,
    );
    const root: Parser.ParseContext.Node = Assert.asDefined(parseErr.state.contextState.maybeRoot);

    const actual: Type.TType = assertGetParseNodeOk(
        TestSettings,
        parseErr.state.contextState.nodeIdMapCollection,
        parseErr.state.contextState.leafNodeIds,
        Parser.XorNodeUtils.contextFactory(root),
    );

    expect(actual).deep.equal(expected);
}

function assertGetParseNodeOk(
    settings: InspectionSettings,
    nodeIdMapCollection: Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    xorNode: Parser.TXorNode,
): Type.TType {
    const triedType: Inspection.TriedType = Inspection.tryType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        xorNode.node.id,
    );
    Assert.isOk(triedType);

    return triedType.value;
}

function assertParseOkScopeTypeEqual(
    settings: Settings,
    textWithPipe: string,
    expected: Inspection.ScopeTypeByKey,
): void {
    const [textWithoutPipe, position]: [string, Inspection.Position] = TestAssertUtils.assertGetTextWithPosition(
        textWithPipe,
    );
    const lexParseOk: Task.LexParseOk = TestAssertUtils.assertGetLexParseOk(TestSettings, textWithoutPipe);
    const nodeIdMapCollection: Parser.NodeIdMap.Collection = lexParseOk.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = lexParseOk.state.contextState.leafNodeIds;

    const actual: Inspection.ScopeTypeByKey = assertGetParseOkScopeTypeOk(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    expect(actual).deep.equal(expected);
}

function assertGetParseOkScopeTypeOk(
    settings: InspectionSettings,
    nodeIdMapCollection: Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Inspection.Position,
): Inspection.ScopeTypeByKey {
    const activeNodeLeaf: Parser.TXorNode = Inspection.ActiveNodeUtils.assertGetLeaf(
        Inspection.ActiveNodeUtils.assertActiveNode(nodeIdMapCollection, leafNodeIds, position),
    );
    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNodeLeaf.node.id,
    );
    Assert.isOk(triedScopeType);

    return triedScopeType.value;
}

describe(`Inspection - Type`, () => {
    describe(`static analysis`, () => {
        describe("BinOpExpression", () => {
            it(`1 + 1`, () => {
                const expression: string = "1 + 1";
                const expected: Type.Number = Type.NumberInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`true and false`, () => {
                const expression: string = `true and false`;
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`"hello" & "world"`, () => {
                const expression: string = `"hello" & "world"`;
                const expected: Type.Text = Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`true + 1`, () => {
                const expression: string = `true + 1`;
                const expected: Type.None = Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
            it(`(foo as number, bar as nullable number) => foo + bar|`, () => {
                const expression: string = `(foo as number, bar as nullable number) => foo + bar|`;
                const expected: Inspection.ScopeTypeByKey = new Map<string, Type.TType>([
                    ["foo", Type.NumberInstance],
                    ["bar", Type.NullableNumberInstance],
                ]);
                assertParseOkScopeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.AsExpression}`, () => {
            it(`1 as number`, () => {
                const expression: string = `1 as number`;
                const expected: Type.Number = Type.NumberInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 as text`, () => {
                const expression: string = `1 as text`;
                const expected: Type.Text = Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 as any`, () => {
                const expression: string = `1 as any`;
                const expected: Type.Any = Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.EachExpression}`, () => {
            it(`each 1`, () => {
                const expression: string = `each 1`;
                const expected: Type.DefinedFunction = TypeUtils.definedFunctionFactory(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: false,
                            maybeType: Type.TypeKind.Any,
                            nameLiteral: "_",
                        },
                    ],
                    TypeUtils.numberLiteralFactory(false, "1"),
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try 1`, () => {
                const expression: string = `try 1`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record),
                ]);

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`try 1 otherwise false`, () => {
                const expression: string = `try 1 otherwise false`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error 1`, () => {
                const expression: string = `error 1`;
                const expected: Type.Any = Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FieldProjection}`, () => {
            it(`[a = 1][[a]]`, () => {
                const expression: string = `[a = 1][[a]]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["a", TypeUtils.numberLiteralFactory(false, "1")]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][[b]]`, () => {
                const expression: string = `[a = 1][[b]]`;
                const expected: Type.None = Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][[b]]?`, () => {
                const expression: string = `[a = 1][[b]]?`;
                const expected: Type.Null = Type.NullInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`(1 as record)[[a]]`, () => {
                const expression: string = `let x = (1 as record) in x[[a]]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["a", Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`(1 as record)[[a]]?`, () => {
                const expression: string = `let x = (1 as record) in x[[a]]?`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["a", Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FieldSelector}`, () => {
            it(`[a = 1][a]`, () => {
                const expression: string = `[a = 1][a]`;
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][b]`, () => {
                const expression: string = `[a = 1][b]`;
                const expected: Type.TType = Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][b]?`, () => {
                const expression: string = `[a = 1][b]?`;
                const expected: Type.TType = Type.NullInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`let x = (1 as record) in x[a]`, () => {
                const expression: string = `let x = (1 as record) in x[a]`;
                const expected: Type.TType = Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`let x = (1 as record) in x[a]?`, () => {
                const expression: string = `let x = (1 as record) in x[a]?`;
                const expected: Type.TType = Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression}`, () => {
            it(`() => 1`, () => {
                const expression: string = `() => 1`;
                const expected: Type.DefinedFunction = TypeUtils.definedFunctionFactory(
                    false,
                    [],
                    TypeUtils.numberLiteralFactory(false, "1"),
                );

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            // Test AnyUnion return
            it(`() => if true then 1 else ""`, () => {
                const expression: string = `() => if true then 1 else ""`;
                const expected: Type.DefinedFunction = TypeUtils.definedFunctionFactory(
                    false,
                    [],
                    TypeUtils.anyUnionFactory([
                        TypeUtils.numberLiteralFactory(false, "1"),
                        TypeUtils.textLiteralFactory(false, `""`),
                    ]),
                );

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`(a, b as number, c as nullable number, optional d) => 1`, () => {
                const expression: string = `(a, b as number, c as nullable number, optional d) => 1`;
                const expected: Type.TType = TypeUtils.definedFunctionFactory(
                    false,
                    [
                        {
                            nameLiteral: "a",
                            isNullable: true,
                            isOptional: false,
                            maybeType: undefined,
                        },
                        {
                            nameLiteral: "b",
                            isNullable: false,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "c",
                            isNullable: true,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "d",
                            isNullable: true,
                            isOptional: true,
                            maybeType: undefined,
                        },
                    ],
                    TypeUtils.numberLiteralFactory(false, "1"),
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionType}`, () => {
            it(`type function`, () => {
                const expression: string = `type function`;
                const expected: Type.Function = Type.FunctionInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type function () as text`, () => {
                const expression: string = `type function () as text`;
                const expected: Type.FunctionType = TypeUtils.functionTypeFactory(false, [], Type.TextInstance);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, () => {
                const expression: string = `type function (foo as number, bar as nullable text, optional baz as date) as text`;
                const expected: Type.FunctionType = TypeUtils.functionTypeFactory(
                    false,
                    [
                        {
                            nameLiteral: "foo",
                            isNullable: false,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "bar",
                            isNullable: true,
                            isOptional: false,
                            maybeType: Type.TypeKind.Text,
                        },
                        {
                            nameLiteral: "baz",
                            isNullable: false,
                            isOptional: true,
                            maybeType: Type.TypeKind.Date,
                        },
                    ],
                    Type.TextInstance,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
            it(`let x = true in x`, () => {
                const expression: string = "let x = true in x";
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`let x = 1 in x`, () => {
                const expression: string = "let x = 1 in x";
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if true then true else false`, () => {
                const expression: string = `if true then true else false`;
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if true then 1 else false`, () => {
                const expression: string = `if true then 1 else false`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical),
                ]);

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if if true then true else false then 1 else 0`, () => {
                const expression: string = `if if true then true else false then 1 else ""`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.textLiteralFactory(false, `""`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if`, () => {
                const expression: string = `if`;
                const expected: Type.TType = Type.UnknownInstance;
                assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if "a"`, () => {
                const expression: string = `if "a"`;
                const expected: Type.TType = Type.NoneInstance;
                assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if true or "a"`, () => {
                const expression: string = `if true or "a"`;
                const expected: Type.TType = Type.NoneInstance;
                assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if 1 as any then "a" as text else "b" as text`, () => {
                const expression: string = `if 1 as any then "a"as text else "b" as text`;
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if 1 as any then "a" else "b"`, () => {
                const expression: string = `if 1 as any then "a" else "b"`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.textLiteralFactory(false, `"a"`),
                    TypeUtils.textLiteralFactory(false, `"b"`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if true then 1`, () => {
                const expression: string = `if true then 1`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Unknown),
                ]);
                assertParseErrNodeTypeEqual(expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IsExpression}`, () => {
            it(`1 is text`, () => {
                const expression: string = `1 is text`;
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
            it(`1 is nullable text`, () => {
                const expression: string = `1 is nullable text`;
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{1}`, () => {
                const expression: string = `{1}`;
                const expected: Type.DefinedList = TypeUtils.definedListFactory(false, [
                    TypeUtils.numberLiteralFactory(false, "1"),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`{1, ""}`, () => {
                const expression: string = `{1, ""}`;
                const expected: Type.DefinedList = TypeUtils.definedListFactory(false, [
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.textLiteralFactory(false, `""`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ListType}`, () => {
            it(`type { number }`, () => {
                const expression: string = `type { number }`;
                const expected: Type.ListType = TypeUtils.listTypeFactory(
                    false,
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.LiteralExpression}`, () => {
            it(`true`, () => {
                const expression: string = "true";
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`false`, () => {
                const expression: string = "false";
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1`, () => {
                const expression: string = "1";
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`null`, () => {
                const expression: string = "null";
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Null);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`{}`, () => {
                const expression: string = `{}`;
                const expected: Type.DefinedList = TypeUtils.definedListFactory(false, []);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
            it(`[]`, () => {
                const expression: string = `[]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(false, new Map(), false);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.NullableType}`, () => {
            it(`type nullable number`, () => {
                const expression: string = "type nullable number";
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Number);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
            it(`1 ?? 1`, () => {
                const expression: string = `1 ?? 1`;
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 ?? 2`, () => {
                const expression: string = `1 ?? 2`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.numberLiteralFactory(false, `2`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 ?? ""`, () => {
                const expression: string = `1 ?? ""`;
                const expected: Type.TType = TypeUtils.anyUnionFactory([
                    TypeUtils.numberLiteralFactory(false, "1"),
                    TypeUtils.textLiteralFactory(false, `""`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 ?? (1 + "")`, () => {
                const expression: string = `1 ?? (1 + "")`;
                const expected: Type.None = Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`[foo = 1] & [bar = 2]`, () => {
                const expression: string = `[foo = 1] & [bar = 2]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([
                        ["foo", TypeUtils.numberLiteralFactory(false, "1")],
                        ["bar", TypeUtils.numberLiteralFactory(false, "2")],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[] & [bar = 2]`, () => {
                const expression: string = `[] & [bar = 2]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["bar", TypeUtils.numberLiteralFactory(false, "2")]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[foo = 1] & []`, () => {
                const expression: string = `[foo = 1] & []`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["foo", TypeUtils.numberLiteralFactory(false, "1")]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[foo = 1] & [foo = ""]`, () => {
                const expression: string = `[foo = 1] & [foo = ""]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["foo", TypeUtils.textLiteralFactory(false, `""`)]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[] as record & [foo = 1]`, () => {
                const expression: string = `[] as record & [foo = 1]`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["foo", TypeUtils.numberLiteralFactory(false, "1")]]),
                    true,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[foo = 1] & [] as record`, () => {
                const expression: string = `[foo = 1] & [] as record`;
                const expected: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                    false,
                    new Map<string, Type.TType>([["foo", TypeUtils.numberLiteralFactory(false, "1")]]),
                    true,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[] as record & [] as record`, () => {
                const expression: string = `[] as record & [] as record`;
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.RecordType}`, () => {
            it(`type [foo]`, () => {
                const expression: string = `type [foo]`;
                const expected: Type.RecordType = TypeUtils.recordTypeFactory(
                    false,
                    new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type [foo, ...]`, () => {
                const expression: string = `type [foo, ...]`;
                const expected: Type.RecordType = TypeUtils.recordTypeFactory(
                    false,
                    new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                    true,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type [foo = number, bar = nullable text]`, () => {
                const expression: string = `type [foo = number, bar = nullable text]`;
                const expected: Type.RecordType = TypeUtils.recordTypeFactory(
                    false,
                    new Map<string, Type.TType>([
                        ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                        ["bar", TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Text)],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
            describe(`any is allowed`, () => {
                it(`${Ast.NodeKind.InvokeExpression}`, () => {
                    const expression: string = `let x = (_ as any) in x()`;
                    const expected: Type.Any = Type.AnyInstance;
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });

                it(`${Ast.NodeKind.ItemAccessExpression}`, () => {
                    const expression: string = `let x = (_ as any) in x{0}`;
                    const expected: Type.Any = Type.AnyInstance;
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });

                describe(`${Ast.NodeKind.FieldSelector}`, () => {
                    it("[a = 1][a]", () => {
                        const expression: string = `[a = 1][a]`;
                        const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                        assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                    });

                    it("[a = 1][b]", () => {
                        const expression: string = `[a = 1][b]`;
                        const expected: Type.None = Type.NoneInstance;
                        assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                    });

                    it("a[b]?", () => {
                        const expression: string = `[a = 1][b]?`;
                        const expected: Type.Null = Type.NullInstance;
                        assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                    });
                });

                it(`${Ast.NodeKind.FieldProjection}`, () => {
                    const expression: string = `let x = (_ as any) in x[[foo]]`;
                    const expected: Type.TType = TypeUtils.anyUnionFactory([
                        TypeUtils.definedRecordFactory(
                            false,
                            new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                            false,
                        ),
                        TypeUtils.definedTableFactory(
                            false,
                            new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                            false,
                        ),
                    ]);
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });

                it(`${Ast.NodeKind.FieldSelector}`, () => {
                    const expression: string = `[a = 1][a]`;
                    const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });
            });

            it(`let x = () as function => () as number => 1 in x()()`, () => {
                const expression: string = `let x = () as function => () as number => 1 in x()()`;
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.TableType}`, () => {
            it(`type table [foo]`, () => {
                const expression: string = `type table [foo]`;
                const expected: Type.TableType = TypeUtils.tableTypeFactory(
                    false,
                    new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type table [foo]`, () => {
                const expression: string = `type table [foo]`;
                const expected: Type.TableType = TypeUtils.tableTypeFactory(
                    false,
                    new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type table [foo = number, bar = nullable text]`, () => {
                const expression: string = `type table [foo = number, bar = nullable text]`;
                const expected: Type.TableType = TypeUtils.tableTypeFactory(
                    false,
                    new Map<string, Type.TType>([
                        ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                        ["bar", TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Text)],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.UnaryExpression}`, () => {
            it(`+1`, () => {
                const expression: string = `+1`;
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "+1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`-1`, () => {
                const expression: string = `-1`;
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "-1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`--1`, () => {
                const expression: string = `--1`;
                const expected: Type.NumberLiteral = TypeUtils.numberLiteralFactory(false, "--1");
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`not true`, () => {
                const expression: string = `not true`;
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`not false`, () => {
                const expression: string = `not false`;
                const expected: Type.Logical = Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`not 1`, () => {
                const expression: string = `not 1`;
                const expected: Type.None = Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`+true`, () => {
                const expression: string = `+true`;
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });
    });

    describe(`external type`, () => {
        describe(`value`, () => {
            it(`resolves to external type`, () => {
                const expression: string = `foo`;
                const expected: Type.Function = Type.FunctionInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`indirect identifier resolves to external type`, () => {
                const expression: string = `let bar = foo in bar`;
                const expected: Type.Function = Type.FunctionInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`fails to resolve to external type`, () => {
                const expression: string = `bar`;
                const expected: Type.Unknown = Type.UnknownInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`invocation`, () => {
            it(`resolves with identifier`, () => {
                const expression: string = `foo()`;
                const expected: Type.Text = Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`resolves with deferenced identifier`, () => {
                const expression: string = `let bar = foo in bar()`;
                const expected: Type.Text = Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`resolves based on argument`, () => {
                const expression1: string = `foo()`;
                const expected1: Type.Text = Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression1, expected1);

                const expression2: string = `foo("bar")`;
                const expected2: Type.Number = Type.NumberInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression2, expected2);
            });
        });
    });
});
