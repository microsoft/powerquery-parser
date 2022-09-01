// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AstNodeById, Collection } from "../nodeIdMap";
import { NodeIdMap, XorNodeUtils } from "..";
import { Assert } from "../../../common";
import { Ast } from "../../../language";
import { TXorNode } from "../xorNode";
import { xor } from "./commonSelectors";

export function assertUnboxLeftMostLeaf(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode {
    return XorNodeUtils.assertUnboxAst(
        Assert.asDefined(leftMostXor(nodeIdMapCollection, nodeId), `nodeId does not exist in nodeIdMapCollection`, {
            nodeId,
        }),
    );
}

export function assertGetLeftMostXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    return Assert.asDefined(leftMostXor(nodeIdMapCollection, nodeId), `nodeId does not exist in nodeIdMapCollection`, {
        nodeId,
    });
}

// Travels down the left most node under the given nodeId by way of the children collection.
export function leftMostXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const currentNode: TXorNode | undefined = xor(nodeIdMapCollection, nodeId);

    if (currentNode === undefined) {
        return undefined;
    }

    let currentNodeId: number = currentNode.node.id;
    let childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(currentNodeId);

    while (childIds?.length) {
        currentNodeId = childIds[0];
        childIds = nodeIdMapCollection.childIdsById.get(currentNodeId);
    }

    return xor(nodeIdMapCollection, currentNodeId);
}

// Same as leftMostXor but also checks if it's an Ast node.
export function leftMostLeaf(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): Ast.TNode | undefined {
    const xorNode: TXorNode | undefined = leftMostXor(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isAstXor(xorNode) ? xorNode.node : undefined;
}

// There are a few assumed invariants about children:
//  * Children were read left to right.
//  * Children were placed in childIdsById in the order they were read.
//  * Therefore the right-most child is the most recently read which also appears last in the document.
export function rightMostLeaf(
    nodeIdMapCollection: Collection,
    nodeId: number,
    predicateFn: ((node: Ast.TNode) => boolean) | undefined = undefined,
): Promise<Ast.TNode | undefined> {
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    let nodeIdsToExplore: number[] = [nodeId];
    let rightMost: Ast.TNode | undefined;

    while (nodeIdsToExplore.length) {
        const nodeId: number = Assert.asDefined(nodeIdsToExplore.pop());
        const astNode: Ast.TNode | undefined = astNodeById.get(nodeId);

        let addChildren: boolean = false;

        // Check if Ast.TNode or ParserContext.Node
        if (astNode !== undefined) {
            if (predicateFn && !predicateFn(astNode)) {
                continue;
            }

            // Is leaf, check if it's more right than the previous record.
            // As it's a leaf there are no children to add.
            if (astNode.isLeaf) {
                // Is the first leaf encountered.
                if (rightMost === undefined) {
                    rightMost = astNode;
                }
                // Compare current leaf node to the existing record.
                else if (astNode.tokenRange.tokenIndexStart > rightMost.tokenRange.tokenIndexStart) {
                    rightMost = astNode;
                }
            }
            // Is not a leaf, no previous record exists.
            // Add all children to the queue.
            else if (rightMost === undefined) {
                addChildren = true;
            }
            // Is not a leaf, previous record exists.
            // Check if we can cull the branch, otherwise add all children to the queue.
            else if (astNode.tokenRange.tokenIndexEnd > rightMost.tokenRange.tokenIndexStart) {
                addChildren = true;
            }
        }
        // Must be a ParserContext.Node.
        // Add all children to the queue as ParserContext.Nodes can have Ast children which are leafs.
        else {
            addChildren = true;
        }

        if (addChildren) {
            const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(nodeId);

            if (childIds !== undefined) {
                // Add the child ids in reversed order to prioritize visiting the right most nodes first.
                const reversedChildIds: number[] = [...childIds];
                reversedChildIds.reverse();
                nodeIdsToExplore = [...reversedChildIds, ...nodeIdsToExplore];
            }
        }
    }

    return Promise.resolve(rightMost);
}

export function rightMostLeafWhere(
    nodeIdMapCollection: Collection,
    nodeId: number,
    predicateFn: ((node: Ast.TNode) => boolean) | undefined,
): Promise<Ast.TNode | undefined> {
    return rightMostLeaf(nodeIdMapCollection, nodeId, predicateFn);
}
