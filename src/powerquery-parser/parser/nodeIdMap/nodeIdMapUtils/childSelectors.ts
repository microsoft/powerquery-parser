// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert } from "../../../common";
import { Ast } from "../../../language";
import { ParseContext } from "../../context";
import { ChildIdsById, Collection } from "../nodeIdMap";
import { TXorNode, XorNode } from "../xorNode";
import { assertGetXor } from "./commonSelectors";

// You can think of a node as a collection which holds other nodes.
// The ArithmeticExpression `1 + 2` has three nodes (i.e. attributes):
//  * a literal node `1` as the first attribute.
//  * a literal operator constant `+` as the second attribute.
//  * a literal node `2` as the third attribute.
//
// The `INode` interface has the nullable field `maybeAttributeIndex`.
// A truthy value indicates it contains a parent and if so what attribute number it is under the parent.

export function assertGetChildren(childIdsById: ChildIdsById, parentId: number): ReadonlyArray<number> {
    return Assert.asDefined(childIdsById.get(parentId), `parentId doesn't have any children`, { parentId });
}

export function assertGetNthChild(nodeIdMapCollection: Collection, parentId: number, attributeIndex: number): TXorNode {
    return Assert.asDefined(
        maybeNthChild(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertGetNthChildChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKind: T["kind"],
): XorNode<T> {
    return Assert.asDefined(
        maybeNthChildChecked(nodeIdMapCollection, parentId, attributeIndex, expectedNodeKind),
        `parentId doesn't have a child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertGetNthChildIfAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode {
    return Assert.asDefined(
        maybeNthChildIfAst(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have an Ast child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertGetNthChildIfAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKind: T["kind"],
): T {
    return Assert.asDefined(
        maybeNthChildIfAstChecked(nodeIdMapCollection, parentId, attributeIndex, expectedNodeKind),
        `parentId doesn't have an Ast child at the given index`,
        { parentId, attributeIndex, expectedNodeKind },
    );
}

export function assertGetNthChildIfContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.Node {
    return Assert.asDefined(
        maybeNthChildIfContext(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a context child at the given index`,
        { parentId, attributeIndex },
    );
}

export function maybeNthChild(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): TXorNode | undefined {
    // Grab the node's childIds.
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    // Iterate over the children and try to find one which matches attributeIndex.
    for (const childId of childIds) {
        const xorNode: TXorNode = assertGetXor(nodeIdMapCollection, childId);
        if (xorNode.node.maybeAttributeIndex === attributeIndex) {
            return xorNode;
        }
    }

    return undefined;
}

export function maybeNthChildChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedChildNodeKind: T["kind"],
): XorNode<T> | undefined {
    return maybeNthChildCheckedMany(nodeIdMapCollection, parentId, attributeIndex, [expectedChildNodeKind]);
}

export function maybeNthChildCheckedMany<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedChildNodeKinds: ReadonlyArray<T["kind"]>,
): XorNode<T> | undefined {
    const maybeChild: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    if (maybeChild === undefined) {
        return undefined;
    }

    return XorNodeUtils.isXorCheckedMany(maybeChild, expectedChildNodeKinds) ? maybeChild : undefined;
}

export function maybeNthChildIfAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isAstXor(maybeNode) ? maybeNode.node : undefined;
}

export function maybeNthChildIfAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKind: T["kind"],
): T | undefined {
    return maybeNthChildIfAstCheckedMany(nodeIdMapCollection, parentId, attributeIndex, [expectedNodeKind]);
}

export function maybeNthChildIfAstCheckedMany<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]>,
): T | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isAstXorCheckedMany(maybeNode, expectedNodeKinds) ? maybeNode.node : undefined;
}

export function maybeNthChildIfContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.Node | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isContextXor(maybeNode) ? maybeNode.node : undefined;
}
