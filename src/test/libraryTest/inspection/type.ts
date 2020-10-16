// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Task } from "../../..";
import { Assert } from "../../../common";
import { Position, ScopeTypeByKey } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast, Type, TypeUtils } from "../../../language";
import { IParserState, NodeIdMap, ParseContext, ParseError, TXorNode, XorNodeUtils } from "../../../parser";
import { CommonSettings, DefaultSettings } from "../../../settings";
import { TestAssertUtils } from "../../testUtils";

function assertParseOkNodeTypeEqual(text: string, expected: Type.TType): void {
    const lexParseOk: Task.LexParseOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
    const actual: Type.TType = assertGetParseNodeOk(
        DefaultSettings,
        lexParseOk.state.contextState.nodeIdMapCollection,
        lexParseOk.state.contextState.leafNodeIds,
        XorNodeUtils.astFactory(lexParseOk.root),
    );

    expect(actual).deep.equal(expected);
}

function assertParseErrNodeTypeEqual(text: string, expected: Type.TType): void {
    const parseErr: ParseError.ParseError<IParserState> = TestAssertUtils.assertGetParseErr(DefaultSettings, text);
    const maybeRoot: ParseContext.Node | undefined = parseErr.state.contextState.maybeRoot;
    Assert.isDefined(maybeRoot);

    const actual: Type.TType = assertGetParseNodeOk(
        DefaultSettings,
        parseErr.state.contextState.nodeIdMapCollection,
        parseErr.state.contextState.leafNodeIds,
        XorNodeUtils.contextFactory(maybeRoot),
    );

    expect(actual).deep.equal(expected);
}

function assertGetParseNodeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    xorNode: TXorNode,
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

function assertParseOkScopeTypeEqual(textWithPipe: string, expected: Inspection.ScopeTypeByKey): void {
    const [textWithoutPipe, position]: [string, Position] = TestAssertUtils.assertGetTextWithPosition(textWithPipe);
    const lexParseOk: Task.LexParseOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, textWithoutPipe);
    const nodeIdMapCollection: NodeIdMap.Collection = lexParseOk.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = lexParseOk.state.contextState.leafNodeIds;

    const actual: Inspection.ScopeTypeByKey = assertGetParseOkScopeTypeOk(
        DefaultSettings,
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    expect(actual).deep.equal(expected);
}

function assertGetParseOkScopeTypeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): Inspection.ScopeTypeByKey {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isDefined(maybeActiveNode);

    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        maybeActiveNode.ancestry[0].node.id,
    );
    Assert.isOk(triedScopeType);

    return triedScopeType.value;
}

describe(`Inspection - Scope - Type`, () => {
    describe("BinOpExpression", () => {
        it(`1 + 1`, () => {
            const expression: string = "1 + 1";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`true and false`, () => {
            const expression: string = `true and false`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`"hello" & "world"`, () => {
            const expression: string = `"hello" & "world"`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`true + 1`, () => {
            const expression: string = `true + 1`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
        it(`(foo as number, bar as nullable number) => foo + bar|`, () => {
            const expression: string = `(foo as number, bar as nullable number) => foo + bar|`;
            const expected: ScopeTypeByKey = new Map<string, Type.TType>([
                ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ["bar", TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Number)],
            ]);
            assertParseOkScopeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.AsExpression}`, () => {
        it(`1 as number`, () => {
            const expression: string = `1 as number`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`1 as text`, () => {
            const expression: string = `1 as text`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`1 as any`, () => {
            const expression: string = `1 as any`;
            const expected: Type.TType = Type.AnyInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try 1`, () => {
            const expression: string = `try 1`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record),
                ],
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`try 1 otherwise false`, () => {
            const expression: string = `try 1 otherwise false`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical),
                ],
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`error 1`, () => {
            const expression: string = `error 1`;
            const expected: Type.TType = Type.AnyInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldProjection}`, () => {
        it(`[a=1][[a]]`, () => {
            const expression: string = `[a=1][[a]]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["a", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][[b]]`, () => {
            const expression: string = `[a=1][[b]]`;
            const expected: Type.TType = Type.NoneInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][[b]]?`, () => {
            const expression: string = `[a=1][[b]]?`;
            const expected: Type.TType = Type.NullInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[[a]]`, () => {
            const expression: string = `(1 as record)[[a]]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["a", Type.AnyInstance]]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[[a]]?`, () => {
            const expression: string = `(1 as record)[[a]]?`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["a", Type.AnyInstance]]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldSelector}`, () => {
        it(`[a=1][a]`, () => {
            const expression: string = `[a=1][a]`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][b]`, () => {
            const expression: string = `[a=1][b]`;
            const expected: Type.TType = Type.NoneInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][b]?`, () => {
            const expression: string = `[a=1][b]?`;
            const expected: Type.TType = Type.NullInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[a]`, () => {
            const expression: string = `(1 as record)[a]`;
            const expected: Type.TType = Type.AnyInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[a]?`, () => {
            const expression: string = `(1 as record)[a]?`;
            const expected: Type.TType = Type.AnyInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`() => 1`, () => {
            const expression: string = `() => 1`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Function,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: [],
                returnType: TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        // Test AnyUnion return
        it(`() => if true then 1 else ""`, () => {
            const expression: string = `() => if true then 1 else ""`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Function,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: [],
                returnType: TypeUtils.anyUnionFactory([
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text),
                ]),
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`(a, b as number, c as nullable number, optional d) => 1`, () => {
            const expression: string = `(a, b as number, c as nullable number, optional d) => 1`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Function,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: [
                    {
                        name: "a",
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                    {
                        name: "b",
                        isNullable: false,
                        isOptional: false,
                        maybeType: Type.TypeKind.Number,
                    },
                    {
                        name: "c",
                        isNullable: true,
                        isOptional: false,
                        maybeType: Type.TypeKind.Number,
                    },
                    {
                        name: "d",
                        isNullable: true,
                        isOptional: true,
                        maybeType: undefined,
                    },
                ],
                returnType: TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionType}`, () => {
        it(`type function`, () => {
            const expression: string = `type function`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Function);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`type function () as text`, () => {
            const expression: string = `type function () as text`;
            const expected: Type.FunctionType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
                isNullable: false,
                parameters: [],
                returnType: TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text),
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, () => {
            const expression: string = `type function (foo as number, bar as nullable text, optional baz as date) as text`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
                isNullable: false,
                parameters: [
                    {
                        name: "foo",
                        isNullable: false,
                        isOptional: false,
                        maybeType: Type.TypeKind.Number,
                    },
                    {
                        name: "bar",
                        isNullable: true,
                        isOptional: false,
                        maybeType: Type.TypeKind.Text,
                    },
                    {
                        name: "baz",
                        isNullable: false,
                        isOptional: true,
                        maybeType: Type.TypeKind.Date,
                    },
                ],
                returnType: TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text),
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
        it(`let x = true in x`, () => {
            const expression: string = "let x = true in x";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`let x = 1 in x`, () => {
            const expression: string = "let x = 1 in x";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if true then true else false`, () => {
            const expression: string = `if true then true else false`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`if true then 1 else false`, () => {
            const expression: string = `if true then 1 else false`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical),
                ],
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`if if true then true else false then 1 else 0`, () => {
            const expression: string = `if if true then true else false then 1 else ""`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text),
                ],
            };
            assertParseOkNodeTypeEqual(expression, expected);
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

        it(`if 1 as any then "a" else "b"`, () => {
            const expression: string = `if 1 as any then "a" else "b"`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`if true then 1`, () => {
            const expression: string = `if true then 1`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Unknown),
                ],
            };
            assertParseErrNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IsExpression}`, () => {
        it(`1 is text`, () => {
            const expression: string = `1 is text`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
        it(`1 is nullable text`, () => {
            const expression: string = `1 is nullable text`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{1}`, () => {
            const expression: string = `{1}`;
            const expected: Type.TType = {
                kind: Type.TypeKind.List,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
                isNullable: false,
                elements: [TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`{1, ""}`, () => {
            const expression: string = `{1, ""}`;
            const expected: Type.TType = {
                kind: Type.TypeKind.List,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
                isNullable: false,
                elements: [
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
                    TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text),
                ],
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ListType}`, () => {
        it(`type { number }`, () => {
            const expression: string = `type { number }`;
            const expected: Type.ListType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.ListType,
                isNullable: false,
                itemType: TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number),
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, () => {
            const expression: string = "true";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`false`, () => {
            const expression: string = "false";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`1`, () => {
            const expression: string = "1";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`null`, () => {
            const expression: string = "null";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Null);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`{}`, () => {
            const expression: string = `{}`;
            const expected: Type.TType = {
                kind: Type.TypeKind.List,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
                isNullable: false,
                elements: [],
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
        it(`[]`, () => {
            const expression: string = `[]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>(),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.NullableType}`, () => {
        it(`type nullable number`, () => {
            const expression: string = "type nullable number";
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
        it(`1 ?? 2`, () => {
            const expression: string = `1 ?? 2`;
            const expected: Type.TType = Type.NumberInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`1 ?? ""`, () => {
            const expression: string = `1 ?? ""`;
            const expected: Type.TType = TypeUtils.anyUnionFactory([Type.NumberInstance, Type.TextInstance]);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`1 ?? (1 + "")`, () => {
            const expression: string = `1 ?? (1 + "")`;
            const expected: Type.TType = Type.NoneInstance;
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`[foo=1] & [bar=2]`, () => {
            const expression: string = `[foo=1] & [bar=2]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                    ["bar", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[] & [bar=2]`, () => {
            const expression: string = `[] & [bar=2]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["bar", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[foo=1] & []`, () => {
            const expression: string = `[foo=1] & []`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[foo=1] & [foo=""]`, () => {
            const expression: string = `[foo=1] & [foo=""]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[] as record & [foo=1]`, () => {
            const expression: string = `[] as record & [foo=1]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ]),
                isOpen: true,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[foo=1] & [] as record`, () => {
            const expression: string = `[foo=1] & [] as record`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                ]),
                isOpen: true,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`[] as record & [] as record`, () => {
            const expression: string = `[] as record & [] as record`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.RecordType}`, () => {
        it(`type [foo]`, () => {
            const expression: string = `type [foo]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`type [foo, ...]`, () => {
            const expression: string = `type [foo, ...]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                isOpen: true,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`type [foo = number, bar = nullable text]`, () => {
            const expression: string = `type [foo = number, bar = nullable text]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                    ["bar", TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Text)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
        describe(`any is allowed`, () => {
            it(`${Ast.NodeKind.InvokeExpression}`, () => {
                const expression: string = `(_ as any)()`;
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Any);
                assertParseOkNodeTypeEqual(expression, expected);
            });

            it(`${Ast.NodeKind.ItemAccessExpression}`, () => {
                const expression: string = `(_ as any){0}`;
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Any);
                assertParseOkNodeTypeEqual(expression, expected);
            });

            describe(`${Ast.NodeKind.FieldSelector}`, () => {
                it("[a=1][a]", () => {
                    const expression: string = `[a=1][a]`;
                    const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
                    assertParseOkNodeTypeEqual(expression, expected);
                });

                it("[a=1][b]", () => {
                    const expression: string = `[a=1][b]`;
                    const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);
                    assertParseOkNodeTypeEqual(expression, expected);
                });

                it("a[b]?", () => {
                    const expression: string = `[a=1][b]?`;
                    const expected: Type.TType = Type.NullInstance;
                    assertParseOkNodeTypeEqual(expression, expected);
                });
            });

            it(`${Ast.NodeKind.FieldProjection}`, () => {
                const expression: string = `(_ as any)[[foo]]`;
                const expected: Type.TType = {
                    kind: Type.TypeKind.Any,
                    maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                    isNullable: false,
                    unionedTypePairs: [
                        {
                            kind: Type.TypeKind.Record,
                            maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                            isNullable: false,
                            fields: new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                            isOpen: false,
                        },
                        {
                            kind: Type.TypeKind.Table,
                            maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                            isNullable: false,
                            fields: new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                            isOpen: false,
                        },
                    ],
                };
                assertParseOkNodeTypeEqual(expression, expected);
            });

            it(`${Ast.NodeKind.FieldSelector}`, () => {
                const expression: string = `[a=1][a]`;
                const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
                assertParseOkNodeTypeEqual(expression, expected);
            });
        });

        it(`let x = () as function => () as number => 1 in x()()`, () => {
            const expression: string = `let x = () as function => () as number => 1 in x()()`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.TableType}`, () => {
        it(`type table [foo]`, () => {
            const expression: string = `type table [foo]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.TableType,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`type table [foo]`, () => {
            const expression: string = `type table [foo]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.TableType,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", Type.AnyInstance]]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`type table [foo = number, bar = nullable text]`, () => {
            const expression: string = `type table [foo = number, bar = nullable text]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.TableType,
                isNullable: false,
                fields: new Map<string, Type.TType>([
                    ["foo", TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number)],
                    ["bar", TypeUtils.primitiveTypeFactory(true, Type.TypeKind.Text)],
                ]),
                isOpen: false,
            };
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.UnaryExpression}`, () => {
        it(`+1`, () => {
            const expression: string = `+1`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`-1`, () => {
            const expression: string = `-1`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`not true`, () => {
            const expression: string = `not true`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`not false`, () => {
            const expression: string = `not false`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`not 1`, () => {
            const expression: string = `not 1`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);
            assertParseOkNodeTypeEqual(expression, expected);
        });

        it(`+true`, () => {
            const expression: string = `+true`;
            const expected: Type.TType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);
            assertParseOkNodeTypeEqual(expression, expected);
        });
    });
});
