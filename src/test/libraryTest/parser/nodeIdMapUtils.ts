// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { DefaultSettings, Task } from "../../..";
import { Assert, MapUtils } from "../../../powerquery-parser";
import { Ast } from "../../../powerquery-parser/language";
import { NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../../../powerquery-parser/parser";
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
});
