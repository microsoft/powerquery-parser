// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { DefaultSettings, Task } from "../../..";
import { Assert, Language, MapUtils } from "../../../powerquery-parser";
import { Ast } from "../../../powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    ParseError,
    TXorNode,
    XorNodeUtils,
} from "../../../powerquery-parser/parser";
import { RecordKeyValuePair } from "../../../powerquery-parser/parser/nodeIdMap/nodeIdMapIterator";
import { TestAssertUtils } from "../../testUtils";

describe("nodeIdMapIterator", () => {
    describe(`iterRecord`, () => {
        it(`normalize record key`, () => {
            const text: string = `let key = [#"foo" = bar] in key`;
            const parseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
            const recordIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.RecordExpression,
            );
            expect(recordIds.size).to.equal(1);

            const recordId: number = Assert.asDefined([...recordIds.values()][0]);
            const record: TXorNode = NodeIdMapUtils.assertGetXor(parseOk.nodeIdMapCollection, recordId);
            const recordKeyValuePairs: ReadonlyArray<RecordKeyValuePair> = NodeIdMapIterator.iterRecord(
                parseOk.nodeIdMapCollection,
                record,
            );

            expect(recordKeyValuePairs.length).to.equal(1);

            const keyValuePair: RecordKeyValuePair = recordKeyValuePairs[0];
            expect(keyValuePair.normalizedKeyLiteral).to.equal("foo");
        });
    });

    describe(`iterFunctionExpressionParameters`, () => {
        it(`ast`, () => {
            const text: string = `(x, y as number) => x + y`;
            const parseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );
            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);
            const functionExpression: TXorNode = NodeIdMapUtils.assertGetXor(
                parseOk.nodeIdMapCollection,
                functionExpressionId,
            );
            const parameters: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterFunctionExpressionParameters(
                parseOk.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameters.length).to.equal(2);

            const firstParameter: Ast.TParameter = Language.AstUtils.assertAsParameter(
                XorNodeUtils.asserUnboxAst(parameters[0]),
            );
            const secondParameter: Ast.TParameter = Language.AstUtils.assertAsParameter(
                XorNodeUtils.asserUnboxAst(parameters[1]),
            );

            expect(firstParameter.name.literal).to.equal("x");
            expect(secondParameter.name.literal).to.equal("y");
        });

        it(`context`, () => {
            const text: string = `(x, y as number) => let`;
            const parseError: ParseError.ParseError = TestAssertUtils.assertGetParseError(DefaultSettings, text);
            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseError.state.contextState.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );
            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);
            const functionExpression: TXorNode = NodeIdMapUtils.assertGetXor(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpressionId,
            );
            const parameters: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterFunctionExpressionParameters(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameters.length).to.equal(2);

            const firstParameter: Ast.TParameter = Language.AstUtils.assertAsParameter(
                XorNodeUtils.asserUnboxAst(parameters[0]),
            );
            const secondParameter: Ast.TParameter = Language.AstUtils.assertAsParameter(
                XorNodeUtils.asserUnboxAst(parameters[1]),
            );

            expect(firstParameter.name.literal).to.equal("x");
            expect(secondParameter.name.literal).to.equal("y");
        });
    });

    describe(`iterFunctionExpressionParameterNames`, () => {
        it(`ast`, () => {
            const text: string = `(x, y as number) => x + y`;
            const parseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseOk.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );
            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);
            const functionExpression: TXorNode = NodeIdMapUtils.assertGetXor(
                parseOk.nodeIdMapCollection,
                functionExpressionId,
            );
            const parameterNames: ReadonlyArray<string> = NodeIdMapIterator.iterFunctionExpressionParameterNames(
                parseOk.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameterNames).to.deep.equal(["x", "y"]);
        });

        it(`context`, () => {
            const text: string = `(x, y as number) => let`;
            const parseError: ParseError.ParseError = TestAssertUtils.assertGetParseError(DefaultSettings, text);
            const functionExpressionIds: Set<number> = MapUtils.assertGet(
                parseError.state.contextState.nodeIdMapCollection.idsByNodeKind,
                Ast.NodeKind.FunctionExpression,
            );
            expect(functionExpressionIds.size).to.equal(1);

            const functionExpressionId: number = Assert.asDefined([...functionExpressionIds.values()][0]);
            const functionExpression: TXorNode = NodeIdMapUtils.assertGetXor(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpressionId,
            );
            const parameterNames: ReadonlyArray<string> = NodeIdMapIterator.iterFunctionExpressionParameterNames(
                parseError.state.contextState.nodeIdMapCollection,
                functionExpression,
            );

            expect(parameterNames).to.deep.equal(["x", "y"]);
        });
    });
});
