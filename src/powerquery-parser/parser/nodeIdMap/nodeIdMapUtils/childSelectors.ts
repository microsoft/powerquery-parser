// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError } from "../../../common";
import { assertGetXor, maybeXor } from "./commonSelectors";
import { Ast, AstUtils } from "../../../language";
import { ChildIdsById, Collection } from "../nodeIdMap";
import { ParseContext, ParseContextUtils } from "../../context";
import { TXorNode, XorNode } from "../xorNode";
import { XorNodeUtils } from "..";

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
        nthChild(nodeIdMapCollection, parentId, attributeIndex),
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

export function assertUnboxArrayWrapperAst(nodeIdMapCollection: Collection, nodeId: number): Ast.TArrayWrapper {
    const xorNode: XorNode<Ast.TArrayWrapper> | undefined = Assert.asDefined(
        unboxArrayWrapper(nodeIdMapCollection, nodeId),
        "failure in assertUnboxArrayWrapperAst",
        { nodeId },
    );

    XorNodeUtils.assertIsAstXor(xorNode);

    return xorNode.node;
}

export function assertUnboxNthChildAsAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode {
    return Assert.asDefined(
        unboxNthChildIfAst(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have an Ast child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertUnboxNthChildAsAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    const astNode: Ast.TNode = assertUnboxNthChildAsAst(nodeIdMapCollection, parentId, attributeIndex);
    AstUtils.assertIsNodeKind(astNode, expectedNodeKinds);

    return astNode;
}

export function assertUnboxNthChildAsContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.TNode {
    return Assert.asDefined(
        nthChildIfContext(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a context child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertUnboxNthChildAsContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    const parseContext: ParseContext.TNode = assertUnboxNthChildAsContext(
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

export function nthChild(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): TXorNode | undefined {
    // Grab the node's childIds.
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);

    if (childIds === undefined) {
        return undefined;
    }

    // Iterate over the children and try to find one which matches attributeIndex.
    for (const childId of childIds) {
        const xorNode: TXorNode = assertGetXor(nodeIdMapCollection, childId);

        if (xorNode.node.attributeIndex === attributeIndex) {
            return xorNode;
        }
    }

    return undefined;
}

export function nthChildChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const xorNode: TXorNode | undefined = nthChild(nodeIdMapCollection, parentId, attributeIndex);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}

export function nthChildIfContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.TNode | undefined {
    const maybeXorNode: TXorNode | undefined = nthChild(nodeIdMapCollection, parentId, attributeIndex);

    return maybeXorNode && XorNodeUtils.isContextXor(maybeXorNode) ? maybeXorNode.node : undefined;
}

export function unboxArrayWrapper(
    nodeIdMapCollection: Collection,
    nodeId: number,
): XorNode<Ast.TArrayWrapper> | undefined {
    return nthChildChecked<Ast.TArrayWrapper>(nodeIdMapCollection, nodeId, 1, Ast.NodeKind.ArrayWrapper);
}

export function unboxNthChildIfAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode | undefined {
    const xorNode: TXorNode | undefined = nthChild(nodeIdMapCollection, parentId, attributeIndex);

    return xorNode && XorNodeUtils.isAstXor(xorNode) ? xorNode.node : undefined;
}

export function unboxNthChildIfAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const astNode: Ast.TNode | undefined = unboxNthChildIfAst(nodeIdMapCollection, parentId, attributeIndex);

    return astNode && AstUtils.isNodeKind(astNode, expectedNodeKinds) ? astNode : undefined;
}

export function unboxNthChildIfContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const maybeContextNode: ParseContext.TNode | undefined = nthChildIfContext(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
    );

    return maybeContextNode && ParseContextUtils.isNodeKind(maybeContextNode, expectedNodeKinds)
        ? maybeContextNode
        : undefined;
}

export function unboxIfAst(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode | undefined {
    const maybeXorNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);

    return maybeXorNode && XorNodeUtils.isAstXor(maybeXorNode) ? maybeXorNode.node : undefined;
}

export function unboxIfAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const maybeXorNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);

    return maybeXorNode && XorNodeUtils.isAstXorChecked(maybeXorNode, expectedNodeKinds)
        ? maybeXorNode.node
        : undefined;
}

export function unboxWrappedContent(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const maybeWrapperXorNode: TXorNode | undefined = maybeXor(nodeIdMapCollection, nodeId);

    if (maybeWrapperXorNode === undefined || !XorNodeUtils.isTWrapped(maybeWrapperXorNode)) {
        return undefined;
    }

    return nthChild(nodeIdMapCollection, nodeId, 1);
}

export function unboxWrappedContentChecked<C extends Ast.TWrapped["content"]>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<C["kind"]> | C["kind"],
): XorNode<C> | undefined {
    const maybeXorNode: TXorNode | undefined = unboxWrappedContent(nodeIdMapCollection, nodeId);

    return maybeXorNode && XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
}

export function unboxWrappedContentIfAst(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode | undefined {
    const maybeXorNode: TXorNode | undefined = unboxWrappedContent(nodeIdMapCollection, nodeId);

    return maybeXorNode && XorNodeUtils.isAstXor(maybeXorNode) ? maybeXorNode.node : undefined;
}

export function unboxWrappedContentIfAstChecked<C extends Ast.TWrapped["content"]>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<C["kind"]> | C["kind"],
): C | undefined {
    const maybeAstNode: Ast.TNode | undefined = unboxWrappedContentIfAst(nodeIdMapCollection, nodeId);

    return maybeAstNode && AstUtils.isNodeKind<C>(maybeAstNode, expectedNodeKinds) ? maybeAstNode : undefined;
}
