// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";

import { Assert, DefaultSettings, Parser, Settings, Task, TaskUtils } from "../../powerquery-parser";
import { NodeIdMap, NodeIdMapIterator, TXorNode, XorNodeUtils } from "../../powerquery-parser/parser";
import { TestFileUtils, TestResourceUtils } from "../testUtils";
import { Resource } from "../testUtils/resourceUtils";

interface NodeDumpTask {
    readonly parserName: string;
    readonly resourceName: string;
    readonly nodeDump: string;
}

const OutputDirectory: string = path.join(__dirname, "nodeDump");

const parserByParserName: ReadonlyMap<string, Parser.Parser> = new Map([
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
]);

async function main(): Promise<void> {
    const resources: ReadonlyArray<Resource> = TestResourceUtils.getResources();

    for (const [parserName, parser] of parserByParserName.entries()) {
        const settings: Settings = {
            ...DefaultSettings,
            parser,
        };

        for (const resource of resources) {
            console.log(`Starting ${resource.filePath} using ${parserName}}`);

            // eslint-disable-next-line no-await-in-loop
            const nodeDump: NodeDumpTask = await createNodeDumpTask(settings, parserName, resource);

            TestFileUtils.writeContents(
                path.join(OutputDirectory, nodeDump.parserName, `${nodeDump.resourceName}.log`),
                nodeDump.nodeDump,
            );
        }
    }
}

async function createNodeDumpTask(settings: Settings, parserName: string, resource: Resource): Promise<NodeDumpTask> {
    const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, resource.fileContents);

    let root: TXorNode;
    let nodeIdMapCollection: NodeIdMap.Collection;

    if (TaskUtils.isParseStageOk(triedLexParse)) {
        root = XorNodeUtils.boxAst(triedLexParse.ast);
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
    } else if (TaskUtils.isParseStageParseError(triedLexParse)) {
        root = XorNodeUtils.boxContext(Assert.asDefined(triedLexParse.parseState.currentContextNode));
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
    } else {
        throw new Error(
            `Unexpected task stage / result kind (${triedLexParse.stage} / ${triedLexParse.resultKind}) for ${resource.filePath}`,
        );
    }

    const queue: (TXorNode | number)[] = [root];
    const chunks: string[] = [];
    let indentation: number = 0;

    while (queue.length > 0) {
        const next: TXorNode | number = Assert.asDefined(queue.shift());

        if (typeof next === "number") {
            indentation += next;

            continue;
        }

        chunks.push("\t".repeat(indentation) + [next.kind, next.node.kind, next.node.id].join(","));

        const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
            nodeIdMapCollection,
            next.node.id,
        );

        if (children.length > 0) {
            indentation += 1;
            queue.push(...children);
            queue.push(-1);
        }
    }

    return {
        nodeDump: chunks.join("\r\n"),
        parserName,
        resourceName: resource.resourceName,
    };
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
