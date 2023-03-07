// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";

import { Assert, DefaultSettings, Settings, Task, TaskUtils } from "../../powerquery-parser";
import { Ast, AstUtils } from "../../powerquery-parser/language";
import { NodeIdMap, NodeIdMapIterator, TXorNode, XorNodeUtils } from "../../powerquery-parser/parser";
import { TestConstants, TestFileUtils, TestResourceUtils } from "../testUtils";
import { TestResource } from "../testUtils/resourceUtils";

interface NodeDumpTask {
    readonly parserName: string;
    readonly resourceName: string;
    readonly nodeDump: string;
}

const OutputDirectory: string = path.join(__dirname, "nodeDump");
const IndentationString: string = "\t";
const JoiningString: string = ",";
const NewlineString: string = "\r\n";

const enum QueueObjectKind {
    EnterScope = "EnterScope",
    ExitScope = "ExitScope",
}

interface QueueObject {
    readonly kind: QueueObjectKind;
    readonly xorNode: TXorNode;
}

async function main(): Promise<void> {
    const resources: ReadonlyArray<TestResource> = TestResourceUtils.getResources();

    for (const [parserName, parser] of TestConstants.ParserByParserName.entries()) {
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

async function createNodeDumpTask(
    settings: Settings,
    parserName: string,
    resource: TestResource,
): Promise<NodeDumpTask> {
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

    let queue: QueueObject[] = [
        {
            xorNode: root,
            kind: QueueObjectKind.EnterScope,
        },
    ];

    const nodeDumpChunks: string[] = [];

    let indentation: number = 0;

    while (queue.length > 0) {
        const queueObject: QueueObject = Assert.asDefined(queue.shift());
        const nodeChunks: string[] = [];

        switch (queueObject.kind) {
            case QueueObjectKind.EnterScope: {
                nodeChunks.push(IndentationString.repeat(indentation) + visitQueueObject(queueObject));
                queue = expandQueue(nodeIdMapCollection, queue, queueObject);
                indentation += 1;

                const leafLiteral: string | undefined = getLeafContent(queueObject.xorNode);

                if (leafLiteral !== undefined) {
                    nodeChunks.push(IndentationString.repeat(indentation) + leafLiteral);
                }

                break;
            }

            case QueueObjectKind.ExitScope: {
                indentation -= 1;
                nodeChunks.push(IndentationString.repeat(indentation) + visitQueueObject(queueObject));

                break;
            }

            default:
                throw Assert.isNever(queueObject.kind);
        }

        nodeDumpChunks.push(nodeChunks.join(NewlineString));
    }

    return {
        nodeDump: nodeDumpChunks.join(NewlineString),
        parserName,
        resourceName: resource.resourceName,
    };
}

function visitQueueObject(queueObject: QueueObject): string {
    let kindLiteral: string;

    switch (queueObject.kind) {
        case QueueObjectKind.EnterScope:
            kindLiteral = ">>>";
            break;

        case QueueObjectKind.ExitScope:
            kindLiteral = "<<<";
            break;

        default:
            throw Assert.isNever(queueObject.kind);
    }

    return `${kindLiteral} ${[
        queueObject.xorNode.kind,
        queueObject.xorNode.node.kind,
        queueObject.xorNode.node.attributeIndex?.toString() ?? "undefined",
    ].join(JoiningString)}`;
}

// DFS expansion of the AST.
function expandQueue(
    nodeIdMapCollection: NodeIdMap.Collection,
    queue: QueueObject[],
    current: QueueObject,
): QueueObject[] {
    const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
        nodeIdMapCollection,
        current.xorNode.node.id,
    );

    return [
        ...children.map((xorNode: TXorNode) => ({
            kind: QueueObjectKind.EnterScope,
            xorNode,
        })),
        {
            kind: QueueObjectKind.ExitScope,
            xorNode: current.xorNode,
        },
        ...queue,
    ];
}

function getLeafContent(xorNode: TXorNode): string | undefined {
    if (!XorNodeUtils.isAstXor(xorNode) || !AstUtils.isLeaf(xorNode.node)) {
        return undefined;
    }

    let leafContent: string;

    switch (xorNode.node.kind) {
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.LiteralExpression:
            leafContent = xorNode.node.literal;
            break;

        case Ast.NodeKind.PrimitiveType:
            leafContent = xorNode.node.primitiveTypeKind;
            break;

        case Ast.NodeKind.Constant:
            leafContent = xorNode.node.constantKind;
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    return leafContent;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
