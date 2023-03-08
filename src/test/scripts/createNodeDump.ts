// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";

import { Assert, DefaultSettings, Settings, Task, TaskUtils } from "../../powerquery-parser";
import { Ast, AstUtils } from "../../powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapIterator,
    ParseContext,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "../../powerquery-parser/parser";
import { TestConstants, TestFileUtils, TestResourceUtils } from "../testUtils";
import { TestResource } from "../testUtils/resourceUtils";

const OutputDirectory: string = path.join(__dirname, "nodeDump");

type TNodeDump = AstNodeDump | AstLeafNodeDump | ContextNodeDump;

type AstNodeDump = Pick<Ast.TNode, "kind" | "attributeIndex" | "id"> & {
    readonly xorNodeKind: XorNodeKind.Ast;
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number;
    readonly children: ReadonlyArray<TNodeDump>;
};

type AstLeafNodeDump = Omit<AstNodeDump, "children"> & {
    readonly leafContent: string;
};

type ContextNodeDump = Pick<ParseContext.TNode, "kind" | "attributeIndex" | "id" | "tokenIndexStart"> & {
    readonly xorNodeKind: XorNodeKind.Context;
    readonly children: ReadonlyArray<TNodeDump>;
};

async function main(): Promise<void> {
    const resources: ReadonlyArray<TestResource> = TestResourceUtils.getResources();

    const resourcesWithErrors: string[] = [];

    for (const [parserName, parser] of TestConstants.ParserByParserName.entries()) {
        const settings: Settings = {
            ...DefaultSettings,
            parser,
        };

        for (const resource of resources) {
            console.log(`Starting ${resource.filePath} using ${parserName}`);

            try {
                // eslint-disable-next-line no-await-in-loop
                const nodeDump: TNodeDump = await lexParseDump(settings, resource);

                TestFileUtils.writeContents(
                    path.join(OutputDirectory, parserName, `${resource.resourceName}.log`),
                    JSON.stringify(nodeDump, undefined, 2),
                );
            } catch (caught: unknown) {
                resourcesWithErrors.push(`Error for ${resource.filePath} using ${parserName}: ${caught}`);
            }
        }
    }

    if (resourcesWithErrors) {
        JSON.stringify(console.error(resourcesWithErrors), null, 4);
    }
}

async function lexParseDump(settings: Settings, resource: TestResource): Promise<TNodeDump> {
    const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, resource.fileContents);

    if (TaskUtils.isParseStageOk(triedLexParse)) {
        return createAstNodeDump(triedLexParse.nodeIdMapCollection, triedLexParse.ast);
    } else if (TaskUtils.isParseStageParseError(triedLexParse)) {
        return createContextNodeDump(
            triedLexParse.nodeIdMapCollection,
            Assert.asDefined(triedLexParse.parseState.currentContextNode),
        );
    } else {
        throw new Error(
            `Unexpected task stage / result kind (${triedLexParse.stage} / ${triedLexParse.resultKind}) for ${resource.filePath}`,
        );
    }
}

function createAstNodeDump(
    nodeIdMapCollection: NodeIdMap.Collection,
    astNode: Ast.TNode,
): AstNodeDump | AstLeafNodeDump {
    const leafContent: string | undefined = getLeafContent(astNode);

    return {
        kind: astNode.kind,
        xorNodeKind: XorNodeKind.Ast,
        tokenIndexStart: astNode.tokenRange.tokenIndexStart,
        tokenIndexEnd: astNode.tokenRange.tokenIndexEnd,
        attributeIndex: astNode.attributeIndex,
        id: astNode.id,
        ...(leafContent
            ? { leafContent }
            : {
                  children: NodeIdMapIterator.assertIterChildrenAst(nodeIdMapCollection, astNode.id).map(
                      (child: Ast.TNode) => createAstNodeDump(nodeIdMapCollection, child),
                  ),
              }),
    };
}

function createContextNodeDump(
    nodeIdMapCollection: NodeIdMap.Collection,
    contextNode: ParseContext.TNode,
): ContextNodeDump {
    return {
        kind: contextNode.kind,
        xorNodeKind: XorNodeKind.Context,
        tokenIndexStart: contextNode.tokenIndexStart,
        attributeIndex: contextNode.attributeIndex,
        id: contextNode.id,
        children: NodeIdMapIterator.assertIterChildrenXor(nodeIdMapCollection, contextNode.id).map((child: TXorNode) =>
            XorNodeUtils.isAstXor(child)
                ? createAstNodeDump(nodeIdMapCollection, child.node)
                : createContextNodeDump(nodeIdMapCollection, child.node),
        ),
    };
}

function getLeafContent(astNode: Ast.TNode): string | undefined {
    if (!AstUtils.isLeaf(astNode)) {
        return undefined;
    }

    let leafContent: string;

    switch (astNode.kind) {
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.LiteralExpression:
            leafContent = astNode.literal;
            break;

        case Ast.NodeKind.PrimitiveType:
            leafContent = astNode.primitiveTypeKind;
            break;

        case Ast.NodeKind.Constant:
            leafContent = astNode.constantKind;
            break;

        default:
            throw Assert.isNever(astNode);
    }

    return leafContent;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();