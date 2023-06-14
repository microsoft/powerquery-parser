// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Token } from "../../../language";
import { Collection, CollectionValidation, IdsByNodeKind, NodeSummary } from "../nodeIdMap";
import { TXorNode, XorNodeKind, XorNodeTokenRange } from "../xorNode";
import { Assert } from "../../../common";
import { ParseContext } from "../../context";
import { rightMostLeaf } from "./leafSelectors";

export function copy(nodeIdMapCollection: Collection): Collection {
    const astNodeById: Map<number, Ast.TNode> = new Map(
        Array.from(nodeIdMapCollection.astNodeById.entries()).map(([id, astNode]: [number, Ast.TNode]) => [
            id,
            { ...astNode },
        ]),
    );

    const contextNodeById: Map<number, ParseContext.TNode> = new Map(
        Array.from(nodeIdMapCollection.contextNodeById.entries()).map(
            ([id, contextNode]: [number, ParseContext.TNode]) => [id, { ...contextNode }],
        ),
    );

    const rightMostLeaf: Ast.TNode | undefined = nodeIdMapCollection.rightMostLeaf
        ? { ...nodeIdMapCollection.rightMostLeaf }
        : undefined;

    const idsByNodeKind: IdsByNodeKind = new Map<Ast.NodeKind, Set<number>>(
        Array.from(nodeIdMapCollection.idsByNodeKind.entries()).map(
            ([nodeKind, nodeIds]: [Ast.NodeKind, Set<number>]) => [nodeKind, new Set(nodeIds)],
        ),
    );

    return {
        astNodeById,
        childIdsById: new Map(nodeIdMapCollection.childIdsById),
        contextNodeById,
        leafIds: new Set(nodeIdMapCollection.leafIds),
        idsByNodeKind,
        rightMostLeaf,
        parentIdById: new Map(nodeIdMapCollection.parentIdById),
    };
}

// Checks if the given nodeId contains at least one parsed token.
export function hasParsedToken(nodeIdMapCollection: Collection, nodeId: number): boolean {
    let childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(nodeId);

    while (childIds !== undefined) {
        const numChildren: number = childIds.length;

        // No children means no nothing was parsed under this node.
        if (numChildren === 0) {
            return false;
        }
        // There might be a child under here.
        else if (numChildren === 1) {
            const childId: number = childIds[0];

            // We know it's an Ast Node, therefore something was parsed.
            if (nodeIdMapCollection.astNodeById.has(childId)) {
                return true;
            }
            // There still might be a child under here. Recurse down to the grandchildren.
            else {
                childIds = nodeIdMapCollection.childIdsById.get(childId);
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

            const rightMostChild: Ast.TNode | undefined = await rightMostLeaf(nodeIdMapCollection, xorNode.node.id);

            if (rightMostChild === undefined) {
                tokenIndexEnd = contextNode.tokenIndexStart;
            } else {
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

export function validate(nodeIdMapCollection: Collection): CollectionValidation {
    const encounteredNodeKinds: Set<Ast.NodeKind> = new Set([
        ...Array.from(nodeIdMapCollection.astNodeById.values()).map((astNode: Ast.TNode) => astNode.kind),
        ...Array.from(nodeIdMapCollection.contextNodeById.values()).map(
            (parseContext: ParseContext.TNode) => parseContext.kind,
        ),
    ]);

    const encounteredIds: Set<number> = new Set([
        ...nodeIdMapCollection.astNodeById.keys(),
        ...nodeIdMapCollection.contextNodeById.keys(),
    ]);

    const nodes: { [key: string]: NodeSummary } = {};

    for (const [nodeId, astNode] of nodeIdMapCollection.astNodeById.entries()) {
        nodes[nodeId] = {
            nodeKind: astNode.kind,
            childIds: nodeIdMapCollection.childIdsById.get(nodeId),
            parentId: nodeIdMapCollection.parentIdById.get(nodeId),
            isAstNode: true,
        };
    }

    for (const [nodeId, contextNode] of nodeIdMapCollection.contextNodeById.entries()) {
        nodes[nodeId] = {
            nodeKind: contextNode.kind,
            childIds: nodeIdMapCollection.childIdsById.get(nodeId),
            parentId: nodeIdMapCollection.parentIdById.get(nodeId),
            isAstNode: false,
        };
    }

    const nodeIdsByNodeKind: { [key: string]: number[] } = {};

    for (const [nodeKind, nodeIds] of nodeIdMapCollection.idsByNodeKind.entries()) {
        nodeIdsByNodeKind[nodeKind] = [...nodeIds];
    }

    const badParentChildLink: [number, number][] = [];

    const unknownParentIdKeys: number[] = [];
    const unknownParentIdValues: number[] = [];

    for (const [childId, parentId] of nodeIdMapCollection.parentIdById.entries()) {
        if (!encounteredIds.has(parentId)) {
            unknownParentIdKeys.push(parentId);
        }

        if (!encounteredIds.has(childId)) {
            unknownParentIdValues.push(childId);
        }

        const childIdsOfParent: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);

        if (childIdsOfParent !== undefined && !childIdsOfParent.includes(childId)) {
            badParentChildLink.push([parentId, childId]);
        }
    }

    const unknownChildIdsKeys: number[] = [];
    const unknownChildIdsValues: number[] = [];

    for (const [parentId, childIds] of nodeIdMapCollection.childIdsById.entries()) {
        if (!encounteredIds.has(parentId)) {
            unknownChildIdsKeys.push(parentId);
        }

        for (const childId of childIds) {
            if (!encounteredIds.has(childId)) {
                unknownChildIdsValues.push(childId);
            }

            if (nodeIdMapCollection.parentIdById.get(childId) !== parentId) {
                badParentChildLink.push([parentId, childId]);
            }
        }
    }

    const unknownByNodeKindNodeIds: number[] = [];

    for (const nodeIds of nodeIdMapCollection.idsByNodeKind.values()) {
        for (const nodeId of nodeIds) {
            if (!encounteredIds.has(nodeId)) {
                unknownByNodeKindNodeIds.push(nodeId);
            }
        }
    }

    return {
        nodes,
        leafIds: [...nodeIdMapCollection.leafIds],
        nodeIdsByNodeKind,
        unknownLeafIds: [...nodeIdMapCollection.leafIds].filter((id: number) => !encounteredIds.has(id)),
        unknownParentIdKeys,
        unknownParentIdValues,
        unknownChildIdsKeys,
        unknownChildIdsValues,
        unknownByNodeKindNodeKinds: Array.from(nodeIdMapCollection.idsByNodeKind.keys()).filter(
            (nodeKind: Ast.NodeKind) => !encounteredNodeKinds.has(nodeKind),
        ),
        unknownByNodeKindNodeIds,
        badParentChildLink,
    };
}
