// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { ParseContext } from "../../context";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNode } from "../xorNode";
import { createAstNode, createContextNode } from "../xorNodeUtils";

export function assertUnwrapParentAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): T {
    const maybeNode: T | undefined = maybeParentAst(nodeIdMapCollection, nodeId, maybeExpectedNodeKinds);
    return Assert.asDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId, maybeExpectedNodeKinds });
}

export function assertGetParentXor<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): TXorNode {
    const maybeNode: TXorNode | undefined = maybeParentXor(nodeIdMapCollection, nodeId, maybeExpectedNodeKinds);
    return Assert.asDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId, maybeExpectedNodeKinds });
}

export function maybeParentAst<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): T | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentId === undefined) {
        return undefined;
    }

    const maybeNode: T | undefined = nodeIdMapCollection.astNodeById.get(maybeParentId) as T | undefined;

    return maybeNode && (!maybeExpectedNodeKinds || AstUtils.isNodeKind(maybeNode, maybeExpectedNodeKinds))
        ? maybeNode
        : undefined;
}

export function maybeParentContext<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): ParseContext.Node | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentId === undefined) {
        return undefined;
    }

    const maybeNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(maybeParentId);

    return maybeNode &&
        (!maybeExpectedNodeKinds ||
            maybeNode.kind === maybeExpectedNodeKinds ||
            maybeExpectedNodeKinds.includes(maybeNode.kind))
        ? maybeNode
        : undefined;
}

export function maybeParentXor<T extends Ast.TNode>(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeExpectedNodeKinds?: ReadonlyArray<T["kind"]> | T["kind"] | undefined,
): XorNode<T> | undefined {
    const maybeAst: T | undefined = maybeParentAst<T>(nodeIdMapCollection, childId, maybeExpectedNodeKinds);
    if (maybeAst !== undefined) {
        return createAstNode<T>(maybeAst);
    }

    const maybeContext: ParseContext.Node | undefined = maybeParentContext(
        nodeIdMapCollection,
        childId,
        maybeExpectedNodeKinds,
    );
    if (maybeContext !== undefined) {
        return createContextNode(maybeContext);
    }

    return undefined;
}
