// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Task, TaskUtils } from "../../../../powerquery-parser";
import { Ast, Type, TypeUtils } from "../../../../powerquery-parser/language";
import { NodeIdMapUtils, XorNode, XorNodeUtils } from "../../../../powerquery-parser/parser";
import { AssertTestUtils } from "../../../testUtils";

// Couples the parser's node map with an AST or context parameter for TypeUtils.inspectParameter tests.
interface ParsedParameter {
    readonly parsed: Task.ParseTaskOk | Task.ParseTaskParseError;
    readonly parameter: XorNode<Ast.TParameter>;
}

async function parseParameter(text: string, isIncomplete: boolean = false): Promise<ParsedParameter> {
    const parsed: Task.ParseTaskOk | Task.ParseTaskParseError = isIncomplete
        ? await AssertTestUtils.assertGetLexParseError(DefaultSettings, text)
        : await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

    const nodeId: number = Assert.asDefined(
        parsed.nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Parameter)?.values().next().value,
    );

    const parameter: XorNode<Ast.TParameter> = NodeIdMapUtils.assertXorChecked<Ast.TParameter>(
        parsed.nodeIdMapCollection,
        nodeId,
        Ast.NodeKind.Parameter,
    );

    return { parsed, parameter };
}

describe("TypeUtils.inspectParameter", () => {
    for (const [annotation, type, isNullable] of [
        ["text", Type.TypeKind.Text, false],
        ["nullable text", Type.TypeKind.Text, true],
        ["[Value = text]", Type.TypeKind.Record, false],
        ["{text}", Type.TypeKind.List, false],
        ["table [Value = text]", Type.TypeKind.Table, false],
        ["function () as text", Type.TypeKind.Function, false],
        ["(type text)", Type.TypeKind.Text, false],
        ["nullable (type text)", Type.TypeKind.Text, true],
    ] as const) {
        for (const isOptional of [false, true]) {
            it(`preserves ${isOptional ? "optional" : "required"} ${annotation} parameters`, async () => {
                const { parsed, parameter }: ParsedParameter = await parseParameter(
                    `type function (${isOptional ? "optional " : ""}x as ${annotation}) as any`,
                );

                expect(TypeUtils.inspectParameter(parsed.nodeIdMapCollection, parameter)).to.deep.equal({
                    kind: TypeUtils.InspectedParameterKind.Resolved,
                    nameLiteral: "x",
                    isOptional,
                    isNullable,
                    type,
                });
            });
        }
    }

    for (const annotation of [
        "T",
        "nullable T",
        "(T)",
        "nullable (T)",
        "((type nullable T))",
        "(if true then T else U)",
    ]) {
        it(`retains the whole unresolved ${annotation} annotation`, async () => {
            const { parsed, parameter }: ParsedParameter = await parseParameter(
                `let T = type text in type function (optional x as ${annotation}) as any`,
            );

            const inspected: TypeUtils.InspectedParameter = TypeUtils.inspectParameter(
                parsed.nodeIdMapCollection,
                parameter,
            );

            if (inspected.kind !== TypeUtils.InspectedParameterKind.Unresolved) {
                throw new Error("Expected an unresolved parameter");
            }

            expect(inspected.kind).to.equal(TypeUtils.InspectedParameterKind.Unresolved);
            expect(inspected.nameLiteral).to.equal("x");
            expect(inspected.isOptional).to.equal(true);
            expect(XorNodeUtils.isAst(inspected.annotation)).to.equal(true);
            XorNodeUtils.assertIsAst(parameter);
            expect(inspected.annotation.node).to.equal(parameter.node.parameterType);
            expect(inspected).not.to.have.property("type");
            expect(inspected).not.to.have.property("isNullable");
        });
    }

    for (const text of ["(x) => x", "(optional x) => x", "(x as text) => x", "(x as nullable text) => x"]) {
        it(`preserves function-expression parameter inspection for ${text}`, async () => {
            const { parsed, parameter }: ParsedParameter = await parseParameter(text);

            expect(TypeUtils.inspectParameter(parsed.nodeIdMapCollection, parameter)).to.deep.equal({
                kind: TypeUtils.InspectedParameterKind.Resolved,
                nameLiteral: "x",
                isOptional: text.includes("optional"),
                isNullable: !text.includes("as text"),
                type: text.includes("as ") ? Type.TypeKind.Text : undefined,
            });
        });
    }

    for (const text of [
        "type function (x as",
        "type function (optional x as nullable",
        "type function (x as (T",
        "(x as",
    ]) {
        it(`distinguishes an incomplete annotation in ${text} from no annotation`, async () => {
            const { parsed, parameter }: ParsedParameter = await parseParameter(text, true);

            const inspected: TypeUtils.InspectedParameter = TypeUtils.inspectParameter(
                parsed.nodeIdMapCollection,
                parameter,
            );

            if (inspected.kind !== TypeUtils.InspectedParameterKind.Unresolved) {
                throw new Error("Expected an unresolved parameter");
            }

            expect(inspected.kind).to.equal(TypeUtils.InspectedParameterKind.Unresolved);
            expect(inspected.isOptional).to.equal(text.includes("optional"));
            expect(XorNodeUtils.isContext(inspected.annotation)).to.equal(true);

            expect(inspected.annotation.node.id).to.equal(
                NodeIdMapUtils.assertNthChildXor(parsed.nodeIdMapCollection, parameter.node.id, 2).node.id,
            );
        });
    }

    it("preserves a named parameter with no annotation in an incomplete parse", async () => {
        const { parsed, parameter }: ParsedParameter = await parseParameter("type function (x", true);

        expect(TypeUtils.inspectParameter(parsed.nodeIdMapCollection, parameter)).to.deep.equal({
            kind: TypeUtils.InspectedParameterKind.Resolved,
            nameLiteral: "x",
            isOptional: false,
            isNullable: true,
            type: undefined,
        });
    });

    for (const annotation of ["text", "T", "nullable T"]) {
        it(`inspects a completed ${annotation} annotation in an incomplete document`, async () => {
            const { parsed, parameter }: ParsedParameter = await parseParameter(
                `type function (x as ${annotation}`,
                true,
            );

            const inspected: TypeUtils.InspectedParameter = TypeUtils.inspectParameter(
                parsed.nodeIdMapCollection,
                parameter,
            );

            if (annotation === "text") {
                expect(inspected).to.deep.equal({
                    kind: TypeUtils.InspectedParameterKind.Resolved,
                    nameLiteral: "x",
                    isOptional: false,
                    isNullable: false,
                    type: Type.TypeKind.Text,
                });
            } else {
                if (inspected.kind !== TypeUtils.InspectedParameterKind.Unresolved) {
                    throw new Error("Expected an unresolved parameter");
                }

                expect(inspected.kind).to.equal(TypeUtils.InspectedParameterKind.Unresolved);
                expect(XorNodeUtils.isAst(inspected.annotation)).to.equal(true);
            }
        });
    }

    for (const text of ["type function (optional", "(optional"]) {
        it(`reports a missing parameter name in ${text}`, async () => {
            const { parsed, parameter }: ParsedParameter = await parseParameter(text, true);

            expect(TypeUtils.inspectParameter(parsed.nodeIdMapCollection, parameter)).to.deep.equal({
                kind: TypeUtils.InspectedParameterKind.MissingName,
            });
        });
    }

    it("reports the annotation in the invocation-validation reproduction as unresolved", async () => {
        const { parsed, parameter }: ParsedParameter = await parseParameter(
            "let T = type text in Value.ReplaceType((x) => x, type function (x as T) as any)",
        );

        TaskUtils.assertIsParseStageOk(parsed);

        expect(TypeUtils.inspectParameter(parsed.nodeIdMapCollection, parameter).kind).to.equal(
            TypeUtils.InspectedParameterKind.Resolved,
        );

        const inspectedParameters: ReadonlyArray<TypeUtils.InspectedParameter> = [
            ...Assert.asDefined(parsed.nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Parameter)),
        ].map((nodeId: number) =>
            TypeUtils.inspectParameter(
                parsed.nodeIdMapCollection,
                NodeIdMapUtils.assertXorChecked<Ast.TParameter>(
                    parsed.nodeIdMapCollection,
                    nodeId,
                    Ast.NodeKind.Parameter,
                ),
            ),
        );

        expect(
            inspectedParameters.filter(
                (item: TypeUtils.InspectedParameter) => item.kind === TypeUtils.InspectedParameterKind.Unresolved,
            ),
        ).to.have.length(1);
    });
});
