// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Token } from "../../../language";
import { Collection, IdsByNodeKind } from "../nodeIdMap";
import { TXorNode, XorNodeKind, XorNodeTokenRange } from "../xorNode";
import { Assert } from "../../../common";
import { maybeRightMostLeaf } from "./leafSelectors";
import { ParseContext } from "../../context";

export function copy(nodeIdMapCollection: Collection): Collection {
    const contextNodeById: Map<number, ParseContext.TNode> = new Map(
        [...nodeIdMapCollection.contextNodeById.entries()].map(([id, contextNode]: [number, ParseContext.TNode]) => [
            id,
            { ...contextNode },
        ]),
    );

    const idsByNodeKind: IdsByNodeKind = new Map();

    for (const [nodeKind, nodeIds] of nodeIdMapCollection.idsByNodeKind.entries()) {
        idsByNodeKind.set(nodeKind, new Set(nodeIds));
    }

    return {
        astNodeById: new Map(nodeIdMapCollection.astNodeById),
        childIdsById: new Map(nodeIdMapCollection.childIdsById),
        contextNodeById,
        leafIds: new Set(nodeIdMapCollection.leafIds),
        idsByNodeKind,
        rightMostLeaf: nodeIdMapCollection.rightMostLeaf,
        parentIdById: new Map(nodeIdMapCollection.parentIdById),
    };
}

// Checks if the given nodeId contains at least one parsed token.
export function hasParsedToken(nodeIdMapCollection: Collection, nodeId: number): boolean {
    let maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(nodeId);

    while (maybeChildIds !== undefined) {
        const numChildren: number = maybeChildIds.length;

        // No children means no nothing was parsed under this node.
        if (numChildren === 0) {
            return false;
        }
        // There might be a child under here.
        else if (numChildren === 1) {
            const childId: number = maybeChildIds[0];

            // We know it's an Ast Node, therefore something was parsed.
            if (nodeIdMapCollection.astNodeById.has(childId)) {
                return true;
            }
            // There still might be a child under here. Recurse down to the grandchildren.
            else {
                maybeChildIds = nodeIdMapCollection.childIdsById.get(childId);
            }
        }
        // Handles the 'else if (numChildren > 2)' branch.
        // A Context should never have more than one open Context node at a time,
        // meaning there must be at least one Ast node under here.
        else {
            return true;
        }
    }

    return false;
}

// Return a XorNodeTokenRange for the given TXorNode.
export async function xorNodeTokenRange(
    nodeIdMapCollection: Collection,
    xorNode: TXorNode,
): Promise<XorNodeTokenRange> {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const tokenRange: Token.TokenRange = xorNode.node.tokenRange;

            return {
                tokenIndexStart: tokenRange.tokenIndexStart,
                tokenIndexEnd: tokenRange.tokenIndexEnd,
            };
        }

        case XorNodeKind.Context: {
            const contextNode: ParseContext.TNode = xorNode.node;
            let tokenIndexEnd: number;

            const maybeRightMostChild: Ast.TNode | undefined = await maybeRightMostLeaf(
                nodeIdMapCollection,
                xorNode.node.id,
            );

            if (maybeRightMostChild === undefined) {
                tokenIndexEnd = contextNode.tokenIndexStart;
            } else {
                const rightMostChild: Ast.TNode = maybeRightMostChild;
                tokenIndexEnd = rightMostChild.tokenRange.tokenIndexEnd;
            }

            return {
                tokenIndexStart: contextNode.tokenIndexStart,
                tokenIndexEnd,
            };
        }

        default:
            throw Assert.isNever(xorNode);
    }
}
