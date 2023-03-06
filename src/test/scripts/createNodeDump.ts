// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";

import {
    Assert,
    DefaultSettings,
    Parser,
    ResultUtils,
    Settings,
    Task,
    TaskUtils,
    Traverse,
} from "../../powerquery-parser";
import { NodeIdMap, TXorNode, XorNodeUtils } from "../../powerquery-parser/parser";
import { TestFileUtils, TestResourceUtils } from "../testUtils";
import { Resource } from "../testUtils/resourceUtils";

interface NodeDumpTask {
    readonly parserName: string;
    readonly resourceName: string;
    readonly nodeDump: string;
}

type TraverseState = Traverse.ITraversalState<string>;

const OutputDirectory: string = path.join(__dirname, "nodeDump");

const parserByParserName: ReadonlyMap<string, Parser.Parser> = new Map([
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
]);

async function main(): Promise<void> {
    const resources: ReadonlyArray<Resource> = TestResourceUtils.getResources();
    const tasks: Promise<NodeDumpTask>[] = [];

    for (const [parserName, parser] of parserByParserName.entries()) {
        const settings: Settings = {
            ...DefaultSettings,
            parser,
        };

        for (const resource of resources) {
            tasks.push(createNodeDumpTask(settings, parserName, resource));
        }
    }

    for (const completedTask of await Promise.all(tasks)) {
        TestFileUtils.writeContents(
            path.join(OutputDirectory, `${completedTask.parserName}`, `${completedTask.resourceName}.log`),
            completedTask.nodeDump,
        );
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

    const triedTraverse: Traverse.TriedTraverse<string> = await Traverse.tryTraverseXor<TraverseState, string>(
        {
            initialCorrelationId: undefined,
            traceManager: DefaultSettings.traceManager,
            cancellationToken: undefined,
            locale: DefaultSettings.locale,
            result: "",
        },
        nodeIdMapCollection,
        root,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitXorNode,
        Traverse.assertGetAllXorChildren,
        undefined,
    );

    ResultUtils.assertIsOk(triedTraverse);

    return {
        parserName,
        nodeDump: triedTraverse.value,
        resourceName: resource.resourceName,
    };
}

// eslint-disable-next-line require-await
async function visitXorNode(
    state: TraverseState,
    xorNode: TXorNode,
    _correlationId: number | undefined,
): Promise<void> {
    // eslint-disable-next-line prefer-template
    state.result += [xorNode.kind, xorNode.node.kind, xorNode.node.id, xorNode.node.attributeIndex].join("\t") + "\n";
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
