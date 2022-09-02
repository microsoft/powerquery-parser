// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils } from "../../../language";
import { boxAst, boxContext } from "../xorNodeUtils";
import { ParseContext, ParseContextUtils } from "../../context";
import { TXorNode, XorNode } from "../xorNode";
import { Assert } from "../../../common";
import { Collection } from "../nodeIdMap";
import { XorNodeUtils } from "..";

export function assertUnboxParentAst(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode {
    return Assert.asDefined(
        parentAst(nodeIdMapCollection, nodeId),
        "couldn't find the expected parent Ast for nodeId",
        { nodeId },
    );
}

export function assertUnboxParentAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T {
    const astNode: Ast.TNode = assertUnboxParentAst(nodeIdMapCollection, nodeId);
    AstUtils.assertIsNodeKind(astNode, expectedNodeKinds);

    return astNode;
}

export function assertUnboxParentContext(nodeIdMapCollection: Collection, nodeId: number): ParseContext.TNode {
    return Assert.asDefined(
        parentContext(nodeIdMapCollection, nodeId),
        "couldn't find the expected parent context for nodeId",
        { nodeId },
    );
}

export function assertUnboxParentContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    const contextNode: ParseContext.TNode = assertUnboxParentContext(nodeIdMapCollection, nodeId);
    ParseContextUtils.assertIsNodeKind(contextNode, expectedNodeKinds);

    return contextNode;
}

export function assertGetParentXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const node: TXorNode | undefined = parentXor(nodeIdMapCollection, nodeId);

    return Assert.asDefined(node, `nodeId doesn't have a parent`, { nodeId, nodeKind: node?.node.kind });
}

export function assertGetParentXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    const xorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, nodeId);
    XorNodeUtils.assertIsNodeKind(xorNode, expectedNodeKinds);

    return xorNode;
}

export function parentAst(nodeIdMapCollection: Collection, childId: number): Ast.TNode | undefined {
    const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);

    return parentId !== undefined ? nodeIdMapCollection.astNodeById.get(parentId) : undefined;
}

export function parentAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const astNode: Ast.TNode | undefined = parentAst(nodeIdMapCollection, childId);

    return astNode && AstUtils.isNodeKind(astNode, expectedNodeKinds) ? astNode : undefined;
}

export function parentContext(nodeIdMapCollection: Collection, childId: number): ParseContext.TNode | undefined {
    const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);

    return parentId !== undefined ? nodeIdMapCollection.contextNodeById.get(parentId) : undefined;
}

export function parentContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const contextNode: ParseContext.TNode | undefined = parentContext(nodeIdMapCollection, childId);

    return contextNode && ParseContextUtils.isNodeKind(contextNode, expectedNodeKinds) ? contextNode : undefined;
}

export function parentXor(nodeIdMapCollection: Collection, childId: number): TXorNode | undefined {
    const astNode: Ast.TNode | undefined = parentAst(nodeIdMapCollection, childId);

    if (astNode !== undefined) {
        return boxAst(astNode);
    }

    const context: ParseContext.TNode | undefined = parentContext(nodeIdMapCollection, childId);

    if (context !== undefined) {
        return boxContext(context);
    }

    return undefined;
}

export function parentXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const xorNode: TXorNode | undefined = parentXor(nodeIdMapCollection, childId);

    return xorNode && XorNodeUtils.isNodeKind(xorNode, expectedNodeKinds) ? xorNode : undefined;
}
