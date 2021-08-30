// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, XorNodeUtils } from "..";
import { Assert } from "../../../common";
import { Ast } from "../../../language";
import { AstNodeById, Collection } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";
import { maybeXor } from "./commonSelectors";

export function assertUnboxLeftMostLeaf(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode {
    return XorNodeUtils.asserUnboxAst(
        Assert.asDefined(
            maybeLeftMostXor(nodeIdMapCollection, nodeId),
            `nodeId does not exist in nodeIdMapCollection`,
            { nodeId },
        ),
    );
}

export function assertGetLeftMostXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(
        maybeLeftMostXor(nodeIdMapCollection, nodeId),
        `nodeId does not exist in nodeIdMapCollection`,
        { nodeId },
    );
}

export function maybeLeftMostXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const currentNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);
    if (currentNode === undefined) {
        return undefined;
    }

    let currentNodeId: number = currentNode.node.id;
    let maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(currentNodeId);
    while (maybeChildIds?.length) {
        currentNodeId = maybeChildIds[0];
        maybeChildIds = nodeIdMapCollection.childIdsById.get(currentNodeId);
    }

    return maybeXor(nodeIdMapCollection, currentNodeId);
}

export function maybeLeftMostLeaf(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): Ast.TNode | undefined {
    const maybeNode: TXorNode | undefined = maybeLeftMostXor(nodeIdMapCollection, nodeId);

    return maybeNode?.kind === XorNodeKind.Ast ? maybeNode.node : undefined;
}

// There are a few assumed invariants about children:
//  * Children were read left to right.
//  * Children were placed in childIdsById in the order they were read.
//  * Therefore the right-most child is the most recently read which also appears last in the document.
export function maybeRightMostLeaf(
    nodeIdMapCollection: Collection,
    rootId: number,
    maybeCondition: ((node: Ast.TNode) => boolean) | undefined = undefined,
): Ast.TNode | undefined {
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    let nodeIdsToExplore: number[] = [rootId];
    let maybeRightMost: Ast.TNode | undefined;

    while (nodeIdsToExplore.length) {
        const nodeId: number = nodeIdsToExplore.pop()!;
        const maybeAstNode: Ast.TNode | undefined = astNodeById.get(nodeId);

        let addChildren: boolean = false;

        // Check if Ast.TNode or ParserContext.Node
        if (maybeAstNode !== undefined) {
            const astNode: Ast.TNode = maybeAstNode;
            if (maybeCondition && !maybeCondition(astNode)) {
                continue;
            }

            // Is leaf, check if it's more right than the previous record.
            // As it's a leaf there are no children to add.
            if (astNode.isLeaf) {
                // Is the first leaf encountered.
                if (maybeRightMost === undefined) {
                    maybeRightMost = astNode;
                }
                // Compare current leaf node to the existing record.
                else if (astNode.tokenRange.tokenIndexStart > maybeRightMost.tokenRange.tokenIndexStart) {
                    maybeRightMost = astNode;
                }
            }
            // Is not a leaf, no previous record exists.
            // Add all children to the queue.
            else if (maybeRightMost === undefined) {
                addChildren = true;
            }
            // Is not a leaf, previous record exists.
            // Check if we can cull the branch, otherwise add all children to the queue.
            else if (astNode.tokenRange.tokenIndexEnd > maybeRightMost.tokenRange.tokenIndexStart) {
                addChildren = true;
            }
        }
        // Must be a ParserContext.Node.
        // Add all children to the queue as ParserContext.Nodes can have Ast children which are leafs.
        else {
            addChildren = true;
        }

        if (addChildren) {
            const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(nodeId);
            if (maybeChildIds !== undefined) {
                // Add the child ids in reversed order to prioritize visiting the right most nodes first.
                const childIds: ReadonlyArray<number> = maybeChildIds;
                const reversedChildIds: number[] = [...childIds];
                reversedChildIds.reverse();
                nodeIdsToExplore = [...reversedChildIds, ...nodeIdsToExplore];
            }
        }
    }

    return maybeRightMost;
}

export function maybeRightMostLeafWhere(
    nodeIdMapCollection: Collection,
    rootId: number,
    maybeCondition: ((node: Ast.TNode) => boolean) | undefined,
): Ast.TNode | undefined {
    return maybeRightMostLeaf(nodeIdMapCollection, rootId, maybeCondition);
}
