// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Token } from "../../../language";
import { ParseContext } from "../../context";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNodeKind, XorNodeTokenRange } from "../xorNode";
import { maybeRightMostLeaf } from "./leafSelectors";

export function cloneCollection(nodeIdMapCollection: Collection): Collection {
    return {
        astNodeById: new Map(nodeIdMapCollection.astNodeById),
        contextNodeById: new Map(nodeIdMapCollection.contextNodeById),
        parentIdById: new Map(nodeIdMapCollection.parentIdById),
        childIdsById: new Map(nodeIdMapCollection.childIdsById),
        maybeRightMostLeaf: nodeIdMapCollection.maybeRightMostLeaf,
    };
}

export function deepCloneCollection(nodeIdMapCollection: Collection): Collection {
    const contextNodeById: Map<number, ParseContext.Node> = new Map(
        [...nodeIdMapCollection.contextNodeById.entries()].map(([id, contextNode]: [number, ParseContext.Node]) => {
            return [id, { ...contextNode }];
        }),
    );

    return {
        astNodeById: new Map(nodeIdMapCollection.astNodeById),
        contextNodeById,
        parentIdById: new Map(nodeIdMapCollection.parentIdById),
        childIdsById: new Map(nodeIdMapCollection.childIdsById),
        maybeRightMostLeaf: nodeIdMapCollection.maybeRightMostLeaf,
    };
}

// Contains at least one parsed token.
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

export function xorNodeTokenRange(nodeIdMapCollection: Collection, xorNode: TXorNode): XorNodeTokenRange {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const tokenRange: Token.TokenRange = xorNode.node.tokenRange;
            return {
                tokenIndexStart: tokenRange.tokenIndexStart,
                tokenIndexEnd: tokenRange.tokenIndexEnd,
            };
        }

        case XorNodeKind.Context: {
            const contextNode: ParseContext.Node = xorNode.node;
            let tokenIndexEnd: number;

            const maybeRightMostChild: Ast.TNode | undefined = maybeRightMostLeaf(nodeIdMapCollection, xorNode.node.id);
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
