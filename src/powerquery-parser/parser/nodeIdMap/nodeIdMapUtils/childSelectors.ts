// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert } from "../../../common";
import { Ast } from "../../../language";
import { ParseContext } from "../../context";
import { ChildIdsById, Collection } from "../nodeIdMap";
import { TXorNode, XorNode, XorNodeKind } from "../xorNode";
import { assertGetXor } from "./commonSelectors";

export function assertGetChildren(childIdsById: ChildIdsById, parentId: number): ReadonlyArray<number> {
    return Assert.asDefined(childIdsById.get(parentId), `parentId doesn't have any children`, { parentId });
}

export function assertGetNthChildAsAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode {
    return Assert.asDefined(
        maybeNthChildAsAst(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have an Ast child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertGetNthChildAsContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.Node {
    return Assert.asDefined(
        maybeNthChildAsContext(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a context child at the given index`,
        {
            parentId,
            attributeIndex,
        },
    );
}

export function assertGetNthChild(nodeIdMapCollection: Collection, parentId: number, attributeIndex: number): TXorNode {
    return Assert.asDefined(
        maybeNthChild(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a child at the given index`,
        { parentId, attributeIndex },
    );
}

export function maybeNthChildAsAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);

    return maybeNode?.kind === XorNodeKind.Ast ? maybeNode.node : undefined;
}

export function maybeNthChildAsAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKind: T["kind"],
): T | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isAstXorChecked(maybeNode, expectedNodeKind) ? maybeNode.node : undefined;
}

export function maybeNthChildAsAstCheckedMany<T extends Ast.TNode>(
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

export function maybeNthChildAsContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.Node | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);

    return maybeNode?.kind === XorNodeKind.Context ? maybeNode.node : undefined;
}

// Nodes can be thought of as a collection bag which hold other nodes.
// The ArithmeticExpression `1 + 2` has three attributes:
//  * a literal node `1` as the first attribute.
//  * a literal operator constant `+` as the second attribute.
//  * a literal node `2` as the third attribute.
//
// This function takes a node id and an attribute index, then returns the nth child of the parent.
// Example: If the ArithmeticExpression above is the parent and attributeIndex is 0, you would get the node for '1'.
// Example: If the ArithmeticExpression above is the parent and attributeIndex is 1, you would get the node for '+'.
//
// If an array of NodeKind is given then an assert is made on the child (if it exists)
// that its kind matches any value inside is in it.
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
    const maybeChild: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    if (maybeChild === undefined) {
        return undefined;
    }

    return XorNodeUtils.isXorChecked(maybeChild, expectedChildNodeKind) ? maybeChild : undefined;
}
