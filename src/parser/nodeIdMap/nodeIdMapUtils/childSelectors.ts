// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert } from "../../../common";
import { Ast } from "../../../language";
import { ParseContext } from "../../context";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";
import { assertGetXor } from "./commonSelectors";

export function assertGetChildAstByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): Ast.TNode {
    const maybeNode: Ast.TNode | undefined = maybeChildAstByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );
    Assert.isDefined(maybeNode, `parentId doesn't have an Ast child at the given index`, { parentId, attributeIndex });

    return maybeNode;
}

export function assertGetChildContextByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): ParseContext.Node {
    const maybeNode: ParseContext.Node | undefined = maybeChildContextByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );
    Assert.isDefined(maybeNode, `parentId doesn't have a context child at the given index`, {
        parentId,
        attributeIndex,
    });

    return maybeNode;
}

export function assertGetChildXorByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): TXorNode {
    const maybeNode: TXorNode | undefined = maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );
    Assert.isDefined(maybeNode, `parentId doesn't have a child at the given index`, { parentId, attributeIndex });

    return maybeNode;
}

export function maybeChildAstByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): Ast.TNode | undefined {
    const maybeNode: TXorNode | undefined = maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );

    return maybeNode?.kind === XorNodeKind.Ast ? maybeNode.node : undefined;
}

export function maybeChildContextByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): ParseContext.Node | undefined {
    const maybeNode: TXorNode | undefined = maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );

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
export function maybeChildXorByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
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
            // If a Ast.NodeKind is given, validate the Ast.TNode at the given index matches the Ast.NodeKind.
            if (maybeChildNodeKinds !== undefined) {
                ArrayUtils.assertIn(maybeChildNodeKinds, xorNode.node.kind);
            }

            return xorNode;
        }
    }

    return undefined;
}
