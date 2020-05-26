// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Task } from "../../..";
import { ResultUtils } from "../../../common";
import { Position, ScopeTypeByKey } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap, ParseContext, ParseError } from "../../../parser";
import { CommonSettings, DefaultSettings } from "../../../settings";
import { Type, TypeUtils } from "../../../type";
import { expectLexParseOk, expectParseErr, expectTextWithPosition } from "../../common";

function expectParseOkNodeTypeEqual(text: string, expected: Type.TType): void {
    const lexParseOk: Task.LexParseOk = expectLexParseOk(DefaultSettings, text);
    const actual: Type.TType = expectParseNodeOk(
        DefaultSettings,
        lexParseOk.state.contextState.nodeIdMapCollection,
        lexParseOk.state.contextState.leafNodeIds,
        lexParseOk.ast.id,
    );

    expect(actual).deep.equal(expected);
}

function expectParseErrNodeTypeEqual(text: string, expected: Type.TType): void {
    const parseErr: ParseError.ParseError<IParserState> = expectParseErr(DefaultSettings, text);
    const maybeRoot: ParseContext.Node | undefined = parseErr.state.contextState.root.maybeNode;
    if (maybeRoot === undefined) {
        throw new Error(`AssertFailed: maybeRoot !== undefined`);
    }

    const actual: Type.TType = expectParseNodeOk(
        DefaultSettings,
        parseErr.state.contextState.nodeIdMapCollection,
        parseErr.state.contextState.leafNodeIds,
        maybeRoot.id,
    );

    expect(actual).deep.equal(expected);
}

function expectParseNodeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
): Type.TType {
    const triedType: Inspection.TriedType = Inspection.tryType(settings, nodeIdMapCollection, leafNodeIds, nodeId);
    if (!ResultUtils.isOk(triedType)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedType) - ${triedType.error.message}`);
    }

    return triedType.value;
}

function expectParseOkScopeTypeEqual(textWithPipe: string, expected: Inspection.ScopeTypeByKey): void {
    const [textWithoutPipe, position]: [string, Position] = expectTextWithPosition(textWithPipe);
    const lexParseOk: Task.LexParseOk = expectLexParseOk(DefaultSettings, textWithoutPipe);
    const nodeIdMapCollection: NodeIdMap.Collection = lexParseOk.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = lexParseOk.state.contextState.leafNodeIds;

    const actual: Inspection.ScopeTypeByKey = expectParseOkScopeTypeOk(
        DefaultSettings,
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    expect(actual).deep.equal(expected);
}

function expectParseOkScopeTypeOk(
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
    if (maybeActiveNode === undefined) {
        throw new Error(`AssertFailed: maybeActiveNode !== undefined`);
    }

    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        maybeActiveNode.ancestry[0].node.id,
    );
    if (!ResultUtils.isOk(triedScopeType)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedScopeType) - ${triedScopeType.error}`);
    }

    return triedScopeType.value;
}

describe(`Inspection - Scope - Type`, () => {
    describe("BinOpExpression", () => {
        it(`1 + 1`, () => {
            const expression: string = "1 + 1";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`true and false`, () => {
            const expression: string = `true and false`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`"hello" & "world"`, () => {
            const expression: string = `"hello" & "world"`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Text, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`true + 1`, () => {
            const expression: string = `true + 1`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.None, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
        it(`(foo as number, bar as nullable number) => foo + bar|`, () => {
            const expression: string = `(foo as number, bar as nullable number) => foo + bar|`;
            const expected: ScopeTypeByKey = new Map<string, Type.TType>([
                ["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
                ["bar", TypeUtils.genericFactory(Type.TypeKind.Number, true)],
            ]);
            expectParseOkScopeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.AsExpression}`, () => {
        it(`1 as number`, () => {
            const expression: string = `1 as number`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`1 as text`, () => {
            const expression: string = `1 as text`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Text, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`1 as any`, () => {
            const expression: string = `1 as any`;
            const expected: Type.TType = TypeUtils.anyFactory();
            expectParseOkNodeTypeEqual(expression, expected);
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
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Record, false),
                ],
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`try 1 otherwise false`, () => {
            const expression: string = `try 1 otherwise false`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Logical, false),
                ],
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`error 1`, () => {
            const expression: string = `error 1`;
            const expected: Type.TType = TypeUtils.anyFactory();
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldProjection}`, () => {
        it(`[a=1][[a]]`, () => {
            const expression: string = `[a=1][[a]]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["a", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][[b]]`, () => {
            const expression: string = `[a=1][[b]]`;
            const expected: Type.TType = TypeUtils.noneFactory();
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][[b]]?`, () => {
            const expression: string = `[a=1][[b]]?`;
            const expected: Type.TType = TypeUtils.nullFactory();
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[[a]]`, () => {
            const expression: string = `(1 as record)[[a]]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["a", TypeUtils.anyFactory()]]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[[a]]?`, () => {
            const expression: string = `(1 as record)[[a]]?`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["a", TypeUtils.anyFactory()]]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldSelector}`, () => {
        it(`[a=1][a]`, () => {
            const expression: string = `[a=1][a]`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][b]`, () => {
            const expression: string = `[a=1][b]`;
            const expected: Type.TType = TypeUtils.noneFactory();
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[a=1][b]?`, () => {
            const expression: string = `[a=1][b]?`;
            const expected: Type.TType = TypeUtils.nullFactory();
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[a]`, () => {
            const expression: string = `(1 as record)[a]`;
            const expected: Type.TType = TypeUtils.anyFactory();
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`(1 as record)[a]?`, () => {
            const expression: string = `(1 as record)[a]?`;
            const expected: Type.TType = TypeUtils.anyFactory();
            expectParseOkNodeTypeEqual(expression, expected);
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
                returnType: TypeUtils.genericFactory(Type.TypeKind.Number, false),
            };
            expectParseOkNodeTypeEqual(expression, expected);
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
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Text, false),
                ]),
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`(a, b as number, c as nullable number, optional d) => 1`, () => {
            const expression: string = `(a, b as number, c as nullable number, optional d) => 1`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Function,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: [
                    {
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Type.TypeKind.Number,
                    },
                    {
                        isNullable: true,
                        isOptional: false,
                        maybeType: Type.TypeKind.Number,
                    },
                    {
                        isNullable: true,
                        isOptional: true,
                        maybeType: undefined,
                    },
                ],
                returnType: TypeUtils.genericFactory(Type.TypeKind.Number, false),
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionType}`, () => {
        it(`type function`, () => {
            const expression: string = `type function`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Function, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`type function () as text`, () => {
            const expression: string = `type function () as text`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Function,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
                    isNullable: false,
                    parameters: [],
                    returnType: TypeUtils.genericFactory(Type.TypeKind.Text, false),
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, () => {
            const expression: string = `type function (foo as number, bar as nullable text, optional baz as date) as text`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Function,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
                    isNullable: false,
                    parameters: [
                        {
                            isNullable: false,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                        },
                        {
                            isNullable: true,
                            isOptional: false,
                            maybeType: Type.TypeKind.Text,
                        },
                        {
                            isNullable: false,
                            isOptional: true,
                            maybeType: Type.TypeKind.Date,
                        },
                    ],
                    returnType: TypeUtils.genericFactory(Type.TypeKind.Text, false),
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
        it(`let x = true in x`, () => {
            const expression: string = "let x = true in x";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`let x = 1 in x`, () => {
            const expression: string = "let x = 1 in x";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if true then true else false`, () => {
            const expression: string = `if true then true else false`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`if true then 1 else false`, () => {
            const expression: string = `if true then 1 else false`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Logical, false),
                ],
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`if if true then true else false then 1 else 0`, () => {
            const expression: string = `if if true then true else false then 1 else ""`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Text, false),
                ],
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`if`, () => {
            const expression: string = `if`;
            const expected: Type.TType = TypeUtils.unknownFactory();
            expectParseErrNodeTypeEqual(expression, expected);
        });

        it(`if "a"`, () => {
            const expression: string = `if "a"`;
            const expected: Type.TType = TypeUtils.noneFactory();
            expectParseErrNodeTypeEqual(expression, expected);
        });

        it(`if true or "a"`, () => {
            const expression: string = `if true or "a"`;
            const expected: Type.TType = TypeUtils.noneFactory();
            expectParseErrNodeTypeEqual(expression, expected);
        });

        it(`if 1 as any then "a" else "b"`, () => {
            const expression: string = `if 1 as any then "a" else "b"`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Text, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`if true then 1`, () => {
            const expression: string = `if true then 1`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Any,
                maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Unknown, false),
                ],
            };
            expectParseErrNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IsExpression}`, () => {
        it(`1 is text`, () => {
            const expression: string = `1 is text`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
        it(`1 is nullable text`, () => {
            const expression: string = `1 is nullable text`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{1}`, () => {
            const expression: string = `{1}`;
            const expected: Type.TType = {
                kind: Type.TypeKind.List,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
                isNullable: false,
                elements: [TypeUtils.genericFactory(Type.TypeKind.Number, false)],
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`{1, ""}`, () => {
            const expression: string = `{1, ""}`;
            const expected: Type.TType = {
                kind: Type.TypeKind.List,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
                isNullable: false,
                elements: [
                    TypeUtils.genericFactory(Type.TypeKind.Number, false),
                    TypeUtils.genericFactory(Type.TypeKind.Text, false),
                ],
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.ListType}`, () => {
        it(`type { number }`, () => {
            const expression: string = `type { number }`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Type,
                    maybeExtendedKind: Type.ExtendedTypeKind.ListType,
                    isNullable: false,
                    itemType: TypeUtils.genericFactory(Type.TypeKind.Number, false),
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, () => {
            const expression: string = "true";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`false`, () => {
            const expression: string = "false";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`1`, () => {
            const expression: string = "1";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`null`, () => {
            const expression: string = "null";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Null, true);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`{}`, () => {
            const expression: string = `{}`;
            const expected: Type.TType = {
                kind: Type.TypeKind.List,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
                isNullable: false,
                elements: [],
            };
            expectParseOkNodeTypeEqual(expression, expected);
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
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.NullableType}`, () => {
        it(`type nullable number`, () => {
            const expression: string = "type nullable number";
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, true);
            expectParseOkNodeTypeEqual(expression, expected);
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
                    ["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
                    ["bar", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
                ]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[] & [bar=2]`, () => {
            const expression: string = `[] & [bar=2]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["bar", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[foo=1] & []`, () => {
            const expression: string = `[foo=1] & []`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[foo=1] & [foo=""]`, () => {
            const expression: string = `[foo=1] & [foo=""]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Text, false)]]),
                isOpen: false,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[] as record & [foo=1]`, () => {
            const expression: string = `[] as record & [foo=1]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
                isOpen: true,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[foo=1] & [] as record`, () => {
            const expression: string = `[foo=1] & [] as record`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Record,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
                isOpen: true,
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`[] as record & [] as record`, () => {
            const expression: string = `[] as record & [] as record`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Record, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.RecordType}`, () => {
        it(`type [foo]`, () => {
            const expression: string = `type [foo]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Record,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                    isNullable: false,
                    fields: new Map<string, Type.TType>([["foo", TypeUtils.anyFactory()]]),
                    isOpen: false,
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`type [foo, ...]`, () => {
            const expression: string = `type [foo, ...]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Record,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                    isNullable: false,
                    fields: new Map<string, Type.TType>([["foo", TypeUtils.anyFactory()]]),
                    isOpen: true,
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`type [foo = number, bar = nullable text]`, () => {
            const expression: string = `type [foo = number, bar = nullable text]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Record,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
                    isNullable: false,
                    fields: new Map<string, Type.TType>([
                        ["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
                        ["bar", TypeUtils.genericFactory(Type.TypeKind.Text, true)],
                    ]),
                    isOpen: false,
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
        describe(`any is allowed`, () => {
            it(`${Ast.NodeKind.InvokeExpression}`, () => {
                const expression: string = `(_ as any)()`;
                const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Any, false);
                expectParseOkNodeTypeEqual(expression, expected);
            });

            it(`${Ast.NodeKind.ItemAccessExpression}`, () => {
                const expression: string = `(_ as any){0}`;
                const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Any, false);
                expectParseOkNodeTypeEqual(expression, expected);
            });

            describe(`${Ast.NodeKind.FieldSelector}`, () => {
                it("[a=1][a]", () => {
                    const expression: string = `[a=1][a]`;
                    const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
                    expectParseOkNodeTypeEqual(expression, expected);
                });

                it("[a=1][b]", () => {
                    const expression: string = `[a=1][b]`;
                    const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.None, false);
                    expectParseOkNodeTypeEqual(expression, expected);
                });

                it("[a=1][b]?", () => {
                    const expression: string = `[a=1][b]?`;
                    const expected: Type.TType = TypeUtils.nullFactory();
                    expectParseOkNodeTypeEqual(expression, expected);
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
                            fields: new Map<string, Type.TType>([["foo", TypeUtils.anyFactory()]]),
                            isOpen: false,
                        },
                        {
                            kind: Type.TypeKind.Table,
                            maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                            isNullable: false,
                            fields: new Map<string, Type.TType>([["foo", TypeUtils.anyFactory()]]),
                            isOpen: false,
                        },
                    ],
                };
                expectParseOkNodeTypeEqual(expression, expected);
            });

            it(`${Ast.NodeKind.FieldSelector}`, () => {
                const expression: string = `[a=1][a]`;
                const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
                expectParseOkNodeTypeEqual(expression, expected);
            });
        });

        it(`let x = () as function => () as number => 1 in x()()`, () => {
            const expression: string = `let x = () as function => () as number => 1 in x()()`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.TableType}`, () => {
        it(`type table [foo]`, () => {
            const expression: string = `type table [foo]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Table,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                    isNullable: false,
                    fields: new Map<string, Type.TType>([["foo", TypeUtils.anyFactory()]]),
                    isOpen: false,
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`type table [foo]`, () => {
            const expression: string = `type table [foo]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Table,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                    isNullable: false,
                    fields: new Map<string, Type.TType>([["foo", TypeUtils.anyFactory()]]),
                    isOpen: false,
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`type table [foo = number, bar = nullable text]`, () => {
            const expression: string = `type table [foo = number, bar = nullable text]`;
            const expected: Type.TType = {
                kind: Type.TypeKind.Type,
                maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
                isNullable: false,
                primaryType: {
                    kind: Type.TypeKind.Table,
                    maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
                    isNullable: false,
                    fields: new Map<string, Type.TType>([
                        ["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
                        ["bar", TypeUtils.genericFactory(Type.TypeKind.Text, true)],
                    ]),
                    isOpen: false,
                },
            };
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.UnaryExpression}`, () => {
        it(`+1`, () => {
            const expression: string = `+1`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`-1`, () => {
            const expression: string = `-1`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`not true`, () => {
            const expression: string = `not true`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`not false`, () => {
            const expression: string = `not false`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Logical, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`not 1`, () => {
            const expression: string = `not 1`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.None, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });

        it(`+true`, () => {
            const expression: string = `+true`;
            const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.None, false);
            expectParseOkNodeTypeEqual(expression, expected);
        });
    });
});
