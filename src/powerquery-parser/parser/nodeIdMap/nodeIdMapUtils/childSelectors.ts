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

export function assertGetNthChild<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): TXorNode {
    return Assert.asDefined(
        maybeNthChild(nodeIdMapCollection, parentId, attributeIndex, maybeExpectedNodeKinds),
        `parentId doesn't have a child at the given index`,
        { parentId, attributeIndex, maybeExpectedNodeKinds },
    );
}

export function assertGetNthChildIfAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): T {
    return Assert.asDefined(
        maybeNthChildIfAst<T>(nodeIdMapCollection, parentId, attributeIndex, maybeExpectedNodeKinds),
        `parentId doesn't have an Ast child at the given index`,
        { parentId, attributeIndex, maybeExpectedNodeKinds },
    );
}

export function assertGetNthChildIfContext<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): ParseContext.Node {
    return Assert.asDefined(
        maybeNthChildIfContext(nodeIdMapCollection, parentId, attributeIndex, maybeExpectedNodeKinds),
        `parentId doesn't have a context child at the given index`,
        { parentId, attributeIndex, maybeExpectedNodeKinds },
    );
}

export function maybeNthChild<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    // Grab the node's childIds.
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    // Iterate over the children and try to find one which matches attributeIndex.
    for (const childId of childIds) {
        const xorNode: XorNode<T> = assertGetXor(nodeIdMapCollection, childId, maybeExpectedNodeKinds);
        if (xorNode.node.maybeAttributeIndex === attributeIndex) {
            return xorNode;
        }
    }

    return undefined;
}

export function maybeNthChildIfAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): T | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeExpectedNodeKinds,
    );
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isAstXor<T>(maybeNode, /* already checked in maybeNthChild */ undefined)
        ? maybeNode.node
        : undefined;
}

export function maybeNthChildIfContext<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): ParseContext.Node | undefined {
    const maybeNode: TXorNode | undefined = maybeNthChild(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeExpectedNodeKinds,
    );
    if (maybeNode === undefined) {
        return undefined;
    }

    return XorNodeUtils.isContextXor<T>(maybeNode, /* already checked in maybeNthChild */ undefined)
        ? maybeNode.node
        : undefined;
}
