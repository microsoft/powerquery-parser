// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert, CommonError } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext, ParseContextUtils } from "../../context";
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
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    const xorNode: TXorNode = assertGetNthChild(nodeIdMapCollection, parentId, attributeIndex);
    XorNodeUtils.assertIsNodeKind(xorNode, expectedNodeKinds);
    return xorNode;
}

export function assertUnwrapNthChildAsAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode {
    return Assert.asDefined(
        maybeUnwrapNthChildIfAst(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have an Ast child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertUnwrapNthChildAsAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    const astNode: Ast.TNode = assertUnwrapNthChildAsAst(nodeIdMapCollection, parentId, attributeIndex);
    AstUtils.assertIsNodeKind(astNode, expectedNodeKinds);
    return astNode;
}

export function assertUnwrapNthChildAsContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.TNode {
    return Assert.asDefined(
        maybeUnwrapNthChildIfContext(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a context child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertUnwrapNthChildAsContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    const parseContext: ParseContext.TNode = assertUnwrapNthChildAsContext(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
    );
    if (!ParseContextUtils.isNodeKind(parseContext, expectedNodeKinds)) {
        throw new CommonError.InvariantError("expected a different node kind", {
            parentId,
            expectedNodeKinds,
            nodeId: parseContext.id,
            nodeKind: parseContext.kind,
        });
    }
    return parseContext;
}

export function maybeArrayWrapper(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
): XorNode<Ast.TArrayWrapper> | undefined {
    return maybeNthChildChecked<Ast.TArrayWrapper>(nodeIdMapCollection, wrapped.node.id, 1, Ast.NodeKind.ArrayWrapper);
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
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const maybeXorNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    return maybeXorNode && XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
}

export function maybeUnwrapNthChildIfAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode | undefined {
    const maybeXorNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    return maybeXorNode && XorNodeUtils.isAstXor(maybeXorNode) ? maybeXorNode.node : undefined;
}

export function maybeUnwrapNthChildIfAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeUnwrapNthChildIfAst(nodeIdMapCollection, parentId, attributeIndex);
    return maybeAstNode && AstUtils.isNodeKind(maybeAstNode, expectedNodeKinds) ? maybeAstNode : undefined;
}

export function maybeUnwrapNthChildIfContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.TNode | undefined {
    const maybeXorNode: TXorNode | undefined = maybeNthChild(nodeIdMapCollection, parentId, attributeIndex);
    return maybeXorNode && XorNodeUtils.isContextXor(maybeXorNode) ? maybeXorNode.node : undefined;
}

export function maybeUnwrapNthChildIfContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const maybeContextNode: ParseContext.TNode | undefined = maybeUnwrapNthChildIfContext(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
    );
    return maybeContextNode && ParseContextUtils.isNodeKind(maybeContextNode, expectedNodeKinds)
        ? maybeContextNode
        : undefined;
}

export function maybeUnwrapWrappedContentIfAst(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
): Ast.TWrapped | undefined {
    const maybeXorNode: TXorNode | undefined = maybeWrappedContent(nodeIdMapCollection, wrapped);
    return maybeXorNode && XorNodeUtils.isAstXor(maybeXorNode) && XorNodeUtils.isTWrapped(maybeXorNode)
        ? maybeXorNode.node
        : undefined;
}

export function maybeUnwrapWrappedContentIfAstChecked<T extends Ast.TWrapped, C extends T["content"]>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    expectedNodeKinds: ReadonlyArray<C["kind"]> | C["kind"],
): C | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeUnwrapWrappedContentIfAst(nodeIdMapCollection, wrapped);
    return maybeAstNode && AstUtils.isNodeKind<C>(maybeAstNode, expectedNodeKinds) ? maybeAstNode : undefined;
}

export function maybeWrappedContent(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    return maybeNthChild(nodeIdMapCollection, wrapped.node.id, 1);
}

export function maybeWrappedContentChecked<C extends Ast.TWrapped["content"]>(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    expectedNodeKinds: ReadonlyArray<C["kind"]> | C["kind"],
): XorNode<C> | undefined {
    const maybeXorNode: TXorNode | undefined = maybeWrappedContent(nodeIdMapCollection, wrapped);
    return maybeXorNode && XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
}
