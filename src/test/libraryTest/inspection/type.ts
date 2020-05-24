// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Task } from "../../..";
import { ResultUtils } from "../../../common";
import { Position, ScopeTypeByKey, TriedScopeType } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap, ParseError, ParseOk, TXorNode, AncestryUtils, ParseContext } from "../../../parser";
import { CommonSettings, DefaultSettings } from "../../../settings";
import { Type, TypeUtils } from "../../../type";
import { expectDeepEqual, expectLexParseOk, expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

// type Type.TType = Type.TType;

function expressionActualFactoryFn(inspected: ScopeTypeByKey): Type.TType {
    const maybeBar: Type.TType | undefined = inspected.get("__bar");
    if (!(maybeBar !== undefined)) {
        throw new Error(`AssertFailed: maybebar !== undefined`);
    }

    return maybeBar;
}

function wrapExpression(expression: string): string {
    return `let __foo = |__bar, __bar = ${expression} in _`;
}

// function expectExpressionLexParseOkTypeOk(expression: string, expected: Type.TType): void {
//     const [text, position]: [string, Inspection.Position] = expectTextWithPosition(wrapExpression(expression));
//     const parseOk: ParseOk<IParserState> = expectParseOk(DefaultSettings, text);
//     const scopeTypeMap: ScopeTypeByKey = expectNodeTypeOk(
//         DefaultSettings,
//         parseOk.state.contextState.nodeIdMapCollection,
//         parseOk.state.contextState.leafNodeIds,
//         position,
//     );
//     expectDeepEqual(scopeTypeMap, expected, expressionActualFactoryFn);
// }

// function expectParseErrTypeOk(expression: string, expected: Type.TType): void {
//     const [text, position]: [string, Inspection.Position] = expectTextWithPosition(wrapExpression(expression));
//     const parseErr: ParseError.ParseError<IParserState> = expectParseErr(DefaultSettings, text);
//     const scopeTypeMap: ScopeTypeByKey = expectNodeTypeOk(
//         DefaultSettings,
//         parseErr.state.contextState.nodeIdMapCollection,
//         parseErr.state.contextState.leafNodeIds,
//         position,
//     );
//     expectDeepEqual(scopeTypeMap, expected, expressionActualFactoryFn);
// }

// function expectNodeTypeOk(
//     settings: CommonSettings,
//     nodeIdMapCollection: NodeIdMap.Collection,
//     leafNodeIds: ReadonlyArray<number>,
//     position: Position,
// ): ScopeTypeByKey {
//     const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
//         nodeIdMapCollection,
//         leafNodeIds,
//         position,
//     );
//     if (!(maybeActiveNode !== undefined)) {
//         throw new Error(`AssertedFailed: maybeActiveNode !== undefined`);
//     }
//     const activeNode: ActiveNode = maybeActiveNode;

//     const triedScope: Inspection.TriedScope = Inspection.tryScope(
//         settings,
//         nodeIdMapCollection,
//         leafNodeIds,
//         activeNode.ancestry,
//         undefined,
//     );
//     if (!ResultUtils.isOk(triedScope)) {
//         throw new Error(`AssertFailed: ResultUtils.isOk(triedScope) - ${triedScope.error}`);
//     }

//     const triedScopeType: TriedScopeType = Inspection.tryScopeType(
//         settings,
//         nodeIdMapCollection,
//         leafNodeIds,
//         activeNode.ancestry[0].node.id,
//         triedScope.value,
//         undefined,
//     );
//     if (!ResultUtils.isOk(triedScopeType)) {
//         throw new Error(`AssertFailed: ResultUtils.isOk(triedScopeType) - ${triedScopeType.error}`);
//     }

//     return triedScopeType.value;
// }

// function expectLexParseOkNodeTypeOk<Y>(text: string, expected: Y, actualFactoryFn: (partial: ScopeTypeByKey) => Y): void {
//     const [text2, position]: [string, Inspection.Position] = expectTextWithPosition(text);
//     const parseErr: Task.LexParseOk = expectLexParseOk(DefaultSettings, text2);
//     const scopeTypeMap: ScopeTypeByKey = expectNodeTypeOk(
//         DefaultSettings,
//         parseErr.state.contextState.nodeIdMapCollection,
//         parseErr.state.contextState.leafNodeIds,
//         position,
//     );
//     expectDeepEqual<ScopeTypeByKey, Y>(scopeTypeMap, expected, actualFactoryFn);
// }

// function expectSimpleExpressionType(expression: string, kind: Type.TypeKind, isNullable: boolean): void {
//     const expected: Type.TType = {
//         kind,
//         maybeExtendedKind: undefined,
//         isNullable,
//     };
//     expectExpressionLexParseOkTypeOk(expression, expected);
// }

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
        throw new Error(`AssertFailed: ResultUtils.isOk(triedType) - ${triedType.error}`);
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
            expectParseOkNodeTypeEqual("1 + 1", TypeUtils.genericFactory(Type.TypeKind.Number, false));
        });

        it(`true and false`, () => {
            expectParseOkNodeTypeEqual(`true and false`, TypeUtils.genericFactory(Type.TypeKind.Logical, false));
        });

        it(`"hello" & "world"`, () => {
            expectParseOkNodeTypeEqual(`"hello" & "world"`, TypeUtils.genericFactory(Type.TypeKind.Text, false));
        });

        it(`true + 1`, () => {
            expectParseOkNodeTypeEqual(`true + 1`, TypeUtils.genericFactory(Type.TypeKind.None, false));
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

    describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
        it(`(foo as number, bar as nullable number) => foo + bar|`, () => {
            const expression: string = `(foo as number, bar as nullable number) => foo + bar|`;
            const expected: ScopeTypeByKey = new Map([
                ["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
                ["bar", TypeUtils.genericFactory(Type.TypeKind.Number, true)],
            ]);
            expectParseOkScopeTypeEqual(expression, expected);
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
    });

    describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
        it(`let x = true in x`, () => {
            expectParseOkNodeTypeEqual("let x = true in x", TypeUtils.genericFactory(Type.TypeKind.Logical, false));
        });

        it(`let x = 1 in x`, () => {
            expectParseOkNodeTypeEqual("let x = 1 in x", TypeUtils.genericFactory(Type.TypeKind.Number, false));
        });
    });

    describe(`${Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, () => {
            expectParseOkNodeTypeEqual("true", TypeUtils.genericFactory(Type.TypeKind.Logical, false));
        });

        it(`false`, () => {
            expectParseOkNodeTypeEqual("false", TypeUtils.genericFactory(Type.TypeKind.Logical, false));
        });

        it(`1`, () => {
            expectParseOkNodeTypeEqual("1", TypeUtils.genericFactory(Type.TypeKind.Number, false));
        });

        it(`null`, () => {
            expectParseOkNodeTypeEqual("null", TypeUtils.genericFactory(Type.TypeKind.Null, true));
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

    describe(`${Ast.NodeKind.IfExpression}`, () => {
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

    // describe(`${Ast.NodeKind.RecordExpression}`, () => {
    //     it(`[foo=1] & [bar=2]`, () => {
    //         const expression: string = `[foo=1] & [bar=2]`;
    //         const expected: Type.TType = {
    //             kind: Type.TypeKind.Record,
    //             maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //             isNullable: false,
    //             fields: new Map<string, Type.TType>([
    //                 ["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
    //                 ["bar", TypeUtils.genericFactory(Type.TypeKind.Number, false)],
    //             ]),
    //             isOpen: false,
    //         };
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });

    //     it(`[] & [bar=2]`, () => {
    //         const expression: string = `[] & [bar=2]`;
    //         const expected: Type.TType = {
    //             kind: Type.TypeKind.Record,
    //             maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //             isNullable: false,
    //             fields: new Map<string, Type.TType>([["bar", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
    //             isOpen: false,
    //         };
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });

    //     it(`[foo=1] & []`, () => {
    //         const expression: string = `[foo=1] & []`;
    //         const expected: Type.TType = {
    //             kind: Type.TypeKind.Record,
    //             maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //             isNullable: false,
    //             fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
    //             isOpen: false,
    //         };
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });

    //     it(`[foo=1] & [foo=""]`, () => {
    //         const expression: string = `[foo=1] & [foo=""]`;
    //         const expected: Type.TType = {
    //             kind: Type.TypeKind.Record,
    //             maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //             isNullable: false,
    //             fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Text, false)]]),
    //             isOpen: false,
    //         };
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });

    //     it(`[] as record & [foo=1]`, () => {
    //         const expression: string = `[] as record & [foo=1]`;
    //         const expected: Type.TType = {
    //             kind: Type.TypeKind.Record,
    //             maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //             isNullable: false,
    //             fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
    //             isOpen: true,
    //         };
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });

    //     it(`[foo=1] & [] as record`, () => {
    //         const expression: string = `[foo=1] & [] as record`;
    //         const expected: Type.TType = {
    //             kind: Type.TypeKind.Record,
    //             maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //             isNullable: false,
    //             fields: new Map<string, Type.TType>([["foo", TypeUtils.genericFactory(Type.TypeKind.Number, false)]]),
    //             isOpen: true,
    //         };
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });

    //     it(`[] as record & [] as record`, () => {
    //         const expression: string = `[] as record & [] as record`;
    //         const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Record, false);
    //         expectExpressionLexParseOkTypeOk(expression, expected);
    //     });
    // });

    // describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
    //     describe(`any is allowed`, () => {
    //         it(`${Ast.NodeKind.InvokeExpression}`, () => {
    //             const expression: string = `(_ as any)()`;
    //             const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Any, false);
    //             expectExpressionLexParseOkTypeOk(expression, expected);
    //         });

    //         it(`${Ast.NodeKind.ItemAccessExpression}`, () => {
    //             const expression: string = `(_ as any){0}`;
    //             const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Any, false);
    //             expectExpressionLexParseOkTypeOk(expression, expected);
    //         });

    //         describe(`${Ast.NodeKind.FieldSelector}`, () => {
    //             it("[a=1][a]", () => {
    //                 const expression: string = `[a=1][a]`;
    //                 const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
    //                 expectExpressionLexParseOkTypeOk(expression, expected);
    //             });

    //             it("[a=1][b]", () => {
    //                 const expression: string = `[a=1][b]`;
    //                 const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.None, false);
    //                 expectExpressionLexParseOkTypeOk(expression, expected);
    //             });

    //             it("[a=1][b]?", () => {
    //                 const expression: string = `[a=1][b]?`;
    //                 const expected: Type.TType = TypeUtils.nullFactory();
    //                 expectExpressionLexParseOkTypeOk(expression, expected);
    //             });
    //         });

    //         it(`${Ast.NodeKind.FieldProjection}`, () => {
    //             const expression: string = `(_ as any)[[foo]]`;
    //             const expected: Type.TType = {
    //                 kind: Type.TypeKind.Any,
    //                 maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
    //                 isNullable: false,
    //                 unionedTypePairs: [
    //                     {
    //                         kind: Type.TypeKind.Record,
    //                         maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
    //                         isNullable: false,
    //                         fields: new Map([["foo", TypeUtils.anyFactory()]]),
    //                         isOpen: false,
    //                     },
    //                     {
    //                         kind: Type.TypeKind.Table,
    //                         maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
    //                         isNullable: false,
    //                         fields: new Map([["foo", TypeUtils.anyFactory()]]),
    //                         isOpen: false,
    //                     },
    //                 ],
    //             };
    //             expectExpressionLexParseOkTypeOk(expression, expected);
    //         });

    //         it(`${Ast.NodeKind.FieldSelector}`, () => {
    //             const expression: string = `[a=1][a]`;
    //             const expected: Type.TType = TypeUtils.genericFactory(Type.TypeKind.Number, false);
    //             expectExpressionLexParseOkTypeOk(expression, expected);
    //         });
    //     });

    //     xit(`let foo = (x as number) as number => if x > 0 then @foo(x - 1) else 0 in foo(0)`, () => {
    //         expectSimpleExpressionType(
    //             "let foo = (x as number) as number => if x > 0 then @foo(x - 1) else 0 in foo(0)",
    //             Type.TypeKind.Number,
    //             false,
    //         );
    //     });

    //     xit(`let foo = (x as number) => if x > 0 then @foo(x - 1) else 0 in foo(0)`, () => {
    //         expectSimpleExpressionType(
    //             "let foo = (x as number) => if x > 0 then @foo(x - 1) else 0 in foo(0)",
    //             Type.TypeKind.Any,
    //             true,
    //         );
    //     });

    //     it(`let x = () as function => () as number => 1 in x()()`, () => {
    //         expectSimpleExpressionType(
    //             "let x = () as function => () as number => 1 in x()()",
    //             Type.TypeKind.Number,
    //             false,
    //         );
    //     });
    // });

    // describe(`${Ast.NodeKind.UnaryExpression}`, () => {
    //     it(`+1`, () => {
    //         expectSimpleExpressionType(`+1`, Type.TypeKind.Number, false);
    //     });

    //     it(`-1`, () => {
    //         expectSimpleExpressionType(`-1`, Type.TypeKind.Number, false);
    //     });

    //     it(`not true`, () => {
    //         expectSimpleExpressionType(`not true`, Type.TypeKind.Logical, false);
    //     });

    //     it(`not false`, () => {
    //         expectSimpleExpressionType(`not false`, Type.TypeKind.Logical, false);
    //     });

    //     it(`not 1`, () => {
    //         expectSimpleExpressionType(`not 1`, Type.TypeKind.None, false);
    //     });

    //     it(`+true`, () => {
    //         expectSimpleExpressionType(`+true`, Type.TypeKind.None, false);
    //     });
    // });
});
