// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assertXor, xor } from "./commonSelectors";
import { Ast, AstUtils } from "../../../language";
import { ChildIdsById, Collection } from "../nodeIdMap";
import { ParseContext, ParseContextUtils } from "../../context";
import { TXorNode, XorNode } from "../xorNode";
import { Assert } from "../../../common";
import { XorNodeUtils } from "..";

// You can think of a node as a collection which holds other nodes.
// The ArithmeticExpression `1 + 2` has three nodes (i.e. attributes):
//  * a literal node `1` as the first attribute.
//  * a literal operator constant `+` as the second attribute.
//  * a literal node `2` as the third attribute.
//
// The `INode` interface has the nullable field `attributeIndex`.
// A truthy value indicates it contains a parent and if so what attribute number it is under the parent.

export function assertChildIds(childIdsById: ChildIdsById, parentId: number): ReadonlyArray<number> {
    return Assert.asDefined(childIdsById.get(parentId), `parentId doesn't have any children`, { parentId });
}

export function assertNthChildXor(nodeIdMapCollection: Collection, parentId: number, attributeIndex: number): TXorNode {
    return Assert.asDefined(
        nthChildXor(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertNthChildXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    return XorNodeUtils.assertAsNodeKind(
        assertNthChildXor(nodeIdMapCollection, parentId, attributeIndex),
        expectedNodeKinds,
    );
}

export function assertNthChildAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode {
    return Assert.asDefined(
        nthChildAst(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have an Ast child at the given index`,
        {
            parentId,
            attributeIndex,
        },
    );
}

export function assertNthChildAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    return AstUtils.assertAsNodeKind(
        assertNthChildAst(nodeIdMapCollection, parentId, attributeIndex),
        expectedNodeKinds,
    );
}

export function assertNthChildContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.TNode {
    return Assert.asDefined(
        nthChildContext(nodeIdMapCollection, parentId, attributeIndex),
        `parentId doesn't have a ParseContext child at the given index`,
        { parentId, attributeIndex },
    );
}

export function assertNthChildContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    return ParseContextUtils.assertAsNodeKind(
        assertNthChildContext(nodeIdMapCollection, parentId, attributeIndex),
        expectedNodeKinds,
    );
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

export function nthChildXor(
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
        const xorNode: TXorNode = assertXor(nodeIdMapCollection, childId);

        if (xorNode.node.attributeIndex === attributeIndex) {
            return xorNode;
        }
    }

    return undefined;
}

export function nthChildXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const xorNode: TXorNode | undefined = nthChildXor(nodeIdMapCollection, parentId, attributeIndex);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}

export function nthChildAst(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): Ast.TNode | undefined {
    const xorNode: TXorNode | undefined = nthChildXor(nodeIdMapCollection, parentId, attributeIndex);

    return xorNode && XorNodeUtils.isAstXor(xorNode) ? xorNode.node : undefined;
}

export function nthChildAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const astNode: Ast.TNode | undefined = nthChildAst(nodeIdMapCollection, parentId, attributeIndex);

    return astNode && AstUtils.isNodeKind(astNode, expectedNodeKinds) ? astNode : undefined;
}

export function nthChildContext(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
): ParseContext.TNode | undefined {
    const xorNode: TXorNode | undefined = nthChildXor(nodeIdMapCollection, parentId, attributeIndex);

    return xorNode && XorNodeUtils.isContextXor(xorNode) ? xorNode.node : undefined;
}

export function nthChildContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const contextNode: ParseContext.TNode | undefined = nthChildContext(nodeIdMapCollection, parentId, attributeIndex);

    return contextNode && ParseContextUtils.isNodeKind(contextNode, expectedNodeKinds) ? contextNode : undefined;
}

export function unboxArrayWrapper(
    nodeIdMapCollection: Collection,
    nodeId: number,
): XorNode<Ast.TArrayWrapper> | undefined {
    return nthChildXorChecked<Ast.TArrayWrapper>(nodeIdMapCollection, nodeId, 1, Ast.NodeKind.ArrayWrapper);
}

export function unboxWrappedContent(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const wrapperXorNode: TXorNode | undefined = xor(nodeIdMapCollection, nodeId);

    if (wrapperXorNode === undefined || !XorNodeUtils.isTWrapped(wrapperXorNode)) {
        return undefined;
    }

    return nthChildXor(nodeIdMapCollection, nodeId, 1);
}

export function unboxWrappedContentChecked<C extends Ast.TWrapped["content"]>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<C["kind"]> | C["kind"],
): XorNode<C> | undefined {
    const xorNode: TXorNode | undefined = unboxWrappedContent(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}

export function unboxWrappedContentIfAst(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode | undefined {
    const xorNode: TXorNode | undefined = unboxWrappedContent(nodeIdMapCollection, nodeId);

    return xorNode && XorNodeUtils.isAstXor(xorNode) ? xorNode.node : undefined;
}

export function unboxWrappedContentIfAstChecked<C extends Ast.TWrapped["content"]>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<C["kind"]> | C["kind"],
): C | undefined {
    const astNode: Ast.TNode | undefined = unboxWrappedContentIfAst(nodeIdMapCollection, nodeId);

    return astNode && AstUtils.isNodeKind<C>(astNode, expectedNodeKinds) ? astNode : undefined;
}
