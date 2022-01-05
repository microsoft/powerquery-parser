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
        maybeParentAst(nodeIdMapCollection, nodeId),
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
        maybeParentContext(nodeIdMapCollection, nodeId),
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
    const maybeNode: TXorNode | undefined = maybeParentXor(nodeIdMapCollection, nodeId);

    return Assert.asDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId, maybeNodeKind: maybeNode?.node.kind });
}

export function assertGetParentXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> {
    const maybeXorNode: TXorNode = assertGetParentXor(nodeIdMapCollection, nodeId);
    XorNodeUtils.assertIsNodeKind(maybeXorNode, expectedNodeKinds);

    return maybeXorNode;
}

export function maybeParentAst(nodeIdMapCollection: Collection, childId: number): Ast.TNode | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);

    return maybeParentId !== undefined ? nodeIdMapCollection.astNodeById.get(maybeParentId) : undefined;
}

export function maybeParentAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): T | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeParentAst(nodeIdMapCollection, childId);

    return maybeAstNode && AstUtils.isNodeKind(maybeAstNode, expectedNodeKinds) ? maybeAstNode : undefined;
}

export function maybeParentContext(nodeIdMapCollection: Collection, childId: number): ParseContext.TNode | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);

    return maybeParentId !== undefined ? nodeIdMapCollection.contextNodeById.get(maybeParentId) : undefined;
}

export function maybeParentContextChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> | undefined {
    const maybeContextNode: ParseContext.TNode | undefined = maybeParentContext(nodeIdMapCollection, childId);

    return maybeContextNode && ParseContextUtils.isNodeKind(maybeContextNode, expectedNodeKinds)
        ? maybeContextNode
        : undefined;
}

export function maybeParentXor(nodeIdMapCollection: Collection, childId: number): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeParentAst(nodeIdMapCollection, childId);

    if (maybeAstNode !== undefined) {
        return boxAst(maybeAstNode);
    }

    const maybeContext: ParseContext.TNode | undefined = maybeParentContext(nodeIdMapCollection, childId);

    if (maybeContext !== undefined) {
        return boxContext(maybeContext);
    }

    return undefined;
}

export function maybeParentXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): XorNode<T> | undefined {
    const maybeXorNode: TXorNode | undefined = maybeParentXor(nodeIdMapCollection, childId);

    return maybeXorNode && XorNodeUtils.isNodeKind(maybeXorNode, expectedNodeKinds) ? maybeXorNode : undefined;
}
