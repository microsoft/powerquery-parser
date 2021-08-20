// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { XorNodeUtils } from "..";
import { Assert } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNode } from "../xorNode";
import { createAstNode, createContextNode } from "../xorNodeUtils";

export function assertUnwrapParentAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKind: T["kind"],
): T {
    const maybeNode: T | undefined = maybeParentAstChecked(nodeIdMapCollection, nodeId, expectedNodeKind);
    return Assert.asDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId });
}

export function assertGetParentXor(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: TXorNode | undefined = maybeParentXor(nodeIdMapCollection, nodeId);
    return Assert.asDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId });
}

export function assertGetParentXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    expectedNodeKind: T["kind"],
): XorNode<T> {
    const maybeNode: XorNode<T> | undefined = maybeParentXorChecked(nodeIdMapCollection, nodeId, expectedNodeKind);
    return Assert.asDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId });
}

export function maybeParentAst(nodeIdMapCollection: Collection, childId: number): Ast.TNode | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentId === undefined) {
        return undefined;
    }
    return nodeIdMapCollection.astNodeById.get(maybeParentId);
}

export function maybeParentAstChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKind: T["kind"],
): T | undefined {
    const maybeParent: Ast.TNode | undefined = maybeParentAst(nodeIdMapCollection, childId);
    if (maybeParent === undefined) {
        return undefined;
    }

    return AstUtils.isNodeKind(maybeParent, expectedNodeKind) ? maybeParent : undefined;
}

export function maybeParentAstCheckedMany<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKinds: ReadonlyArray<T["kind"]>,
): T | undefined {
    const maybeParent: Ast.TNode | undefined = maybeParentAst(nodeIdMapCollection, childId);
    if (maybeParent === undefined) {
        return undefined;
    }

    return AstUtils.isAnyNodeKind(maybeParent, expectedNodeKinds) ? maybeParent : undefined;
}

export function maybeParentContext(nodeIdMapCollection: Collection, childId: number): ParseContext.Node | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentId === undefined) {
        return undefined;
    }

    return nodeIdMapCollection.contextNodeById.get(maybeParentId);
}

export function maybeParentContextChecked(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKind: Ast.NodeKind,
): ParseContext.Node | undefined {
    const maybeParent: ParseContext.Node | undefined = maybeParentContext(nodeIdMapCollection, childId);
    return maybeParent?.kind === expectedNodeKind ? maybeParent : undefined;
}

export function maybeParentXor(nodeIdMapCollection: Collection, childId: number): TXorNode | undefined {
    const maybeAst: Ast.TNode | undefined = maybeParentAst(nodeIdMapCollection, childId);
    if (maybeAst !== undefined) {
        return createAstNode(maybeAst);
    }

    const maybeContext: ParseContext.Node | undefined = maybeParentContext(nodeIdMapCollection, childId);
    if (maybeContext !== undefined) {
        return createContextNode(maybeContext);
    }

    return undefined;
}

export function maybeParentXorChecked<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    expectedNodeKind: T["kind"],
): XorNode<T> | undefined {
    const maybeXor: TXorNode | undefined = maybeParentXor(nodeIdMapCollection, childId);
    if (maybeXor === undefined) {
        return undefined;
    }

    return XorNodeUtils.isAst(maybeXor, expectedNodeKind) || XorNodeUtils.isContextXor(maybeXor) ? maybeXor : undefined;
}
