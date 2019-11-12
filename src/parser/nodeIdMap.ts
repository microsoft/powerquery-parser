// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext } from ".";
import { CommonError, Option } from "../common";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export type AstNodeById = NumberMap<Ast.TNode>;

export type ContextNodeById = NumberMap<ParserContext.Node>;

export type ParentIdById = NumberMap<number>;

export type ChildIdsById = NumberMap<ReadonlyArray<number>>;

export type TXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode> | IXorNode<XorNodeKind.Context, ParserContext.Node>;

export interface IXorNode<Kind, T> {
    readonly kind: Kind & XorNodeKind;
    readonly node: T;
}

export interface Collection {
    readonly astNodeById: AstNodeById;
    readonly contextNodeById: ContextNodeById;
    readonly parentIdById: ParentIdById;
    readonly childIdsById: ChildIdsById;
}

export interface RepeatedAttributeIndexRequest {
    readonly nodeIdMapCollection: Collection;
    readonly firstDrilldown: FirstDrilldown;
    readonly drilldowns: ReadonlyArray<Drilldown>;
}

export interface FirstDrilldown {
    readonly rootNodeId: number;
    readonly attributeIndex: number;
    readonly maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>;
}

export interface Drilldown {
    readonly attributeIndex: number;
    readonly maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>;
}

export function maybeXorNode(nodeIdMapCollection: Collection, nodeId: number): Option<TXorNode> {
    const maybeAstNode: Option<Ast.TNode> = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode) {
        const astNode: Ast.TNode = maybeAstNode;
        return {
            kind: XorNodeKind.Ast,
            node: astNode,
        };
    }

    const maybeContextNode: Option<ParserContext.Node> = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode) {
        const contextNode: ParserContext.Node = maybeContextNode;
        return {
            kind: XorNodeKind.Context,
            node: contextNode,
        };
    }

    return undefined;
}

export function maybeNthSiblingXorNode(
    nodeIdMapCollection: Collection,
    rootId: number,
    offset: number,
): Option<TXorNode> {
    const childXorNode: TXorNode = expectXorNode(nodeIdMapCollection, rootId);
    if (childXorNode.node.maybeAttributeIndex === undefined) {
        return undefined;
    }

    const attributeIndex: number = childXorNode.node.maybeAttributeIndex + offset;
    if (attributeIndex < 0) {
        return undefined;
    }

    const parentXorNode: TXorNode = expectParentXorNode(nodeIdMapCollection, rootId);
    const childIds: ReadonlyArray<number> = expectChildIds(nodeIdMapCollection.childIdsById, parentXorNode.node.id);
    if (childIds.length >= attributeIndex) {
        return undefined;
    }

    return maybeXorNode(nodeIdMapCollection, childIds[attributeIndex]);
}

export function maybeNextSiblingXorNode(nodeIdMapCollection: Collection, nodeId: number): Option<TXorNode> {
    return maybeNthSiblingXorNode(nodeIdMapCollection, nodeId, 1);
}

export function maybeParentXorNode(nodeIdMapCollection: Collection, childId: number): Option<TXorNode> {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentNodeId === undefined) {
        return undefined;
    }
    const parentNodeId: number = maybeParentNodeId;

    return maybeXorNode(nodeIdMapCollection, parentNodeId);
}

export function maybeParentAstNode(nodeIdMapCollection: Collection, childId: number): Option<Ast.TNode> {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentNodeId === undefined) {
        return undefined;
    }
    const parentNodeId: number = maybeParentNodeId;

    return nodeIdMapCollection.astNodeById.get(parentNodeId);
}

export function maybeParentContextNode(nodeIdMapCollection: Collection, childId: number): Option<ParserContext.Node> {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentNodeId === undefined) {
        return undefined;
    }
    const parentNodeId: number = maybeParentNodeId;

    return nodeIdMapCollection.contextNodeById.get(parentNodeId);
}

export function maybeAstChildren(nodeIdMapCollection: Collection, parentId: number): Option<ReadonlyArray<Ast.TNode>> {
    const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    return childIds.map(childId => expectAstNode(astNodeById, childId));
}

// Helper function for repeatedly calling maybeXorChildByAttributeIndex.
export function maybeXorChildByRepeatedAttributeIndex(request: RepeatedAttributeIndexRequest): Option<TXorNode> {
    const nodeIdMapCollection: Collection = request.nodeIdMapCollection;
    const firstDrilldown: FirstDrilldown = request.firstDrilldown;

    let maybeChildXorNode: Option<TXorNode> = maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        firstDrilldown.rootNodeId,
        firstDrilldown.attributeIndex,
        firstDrilldown.maybeAllowedNodeKinds,
    );

    for (const drilldown of request.drilldowns) {
        if (maybeChildXorNode === undefined) {
            return maybeChildXorNode;
        }

        maybeChildXorNode = maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            maybeChildXorNode.node.id,
            drilldown.attributeIndex,
            drilldown.maybeAllowedNodeKinds,
        );
    }

    return maybeChildXorNode;
}

// Both Ast.TNode and ParserContext.Node store an attribute index,
// which when not undefined represents which child index they are under for their parent.
//
// This function grabs the parent and if they have a child matching the attribute index it is returned as an XorNode.
// If the parent doesn't have a matching child that means (assuming a valid attributeIndex is given) the parent is
// a ParserContext.Node which failed to fully parse all of their attributes.
//
// An optional array of Ast.NodeKind can be given for validation purposes.
// If the child's node kind isn't in the given array, then an exception is thrown.
export function maybeXorChildByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>,
): Option<TXorNode> {
    // Grab the node's childIds.
    const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    // Iterate over the children and try to find one which matches attributeIndex.
    for (const childId of childIds) {
        const xorNode: TXorNode = expectXorNode(nodeIdMapCollection, childId);
        if (xorNode.node.maybeAttributeIndex === attributeIndex) {
            // If a Ast.NodeKind is given, validate the Ast.TNode at the given index matches the Ast.NodeKind.
            if (maybeChildNodeKinds !== undefined && maybeChildNodeKinds.indexOf(xorNode.node.kind) === -1) {
                const details: {} = {
                    childId,
                    expectedAny: maybeChildNodeKinds,
                    actual: xorNode.node.kind,
                };
                throw new CommonError.InvariantError(`incorrect node kind for attribute`, details);
            } else {
                return xorNode;
            }
        }
    }

    return undefined;
}

export function maybeAstChildByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>,
): Option<Ast.TNode> {
    const maybeNode: Option<TXorNode> = maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );

    if (maybeNode === undefined || maybeNode.kind === XorNodeKind.Context) {
        return undefined;
    } else {
        return maybeNode.node;
    }
}

export function maybeContextChildByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>,
): Option<ParserContext.Node> {
    const maybeNode: Option<TXorNode> = maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );

    if (maybeNode === undefined || maybeNode.kind === XorNodeKind.Ast) {
        return undefined;
    } else {
        return maybeNode.node;
    }
}

export function maybeInvokeExpressionName(nodeIdMapCollection: Collection, nodeId: number): Option<string> {
    const invokeExprXorNode: TXorNode = expectXorNode(nodeIdMapCollection, nodeId);

    if (invokeExprXorNode.node.kind !== Ast.NodeKind.InvokeExpression) {
        const details: {} = { invokeExprXorNode };
        throw new CommonError.InvariantError(
            `expected invokeExprXorNode to have a Ast.NodeKind of ${Ast.NodeKind.InvokeExpression}`,
            details,
        );
    }

    // The only place for an identifier in a RecursivePrimaryExpression is as the head, therefore an InvokeExpression
    // only has a name if the InvokeExpression is the 0th element in the RecursivePrimaryExpressionArray.
    let maybeName: Option<string>;
    if (invokeExprXorNode.node.maybeAttributeIndex === 0) {
        // Grab the RecursivePrimaryExpression's head if it's an IdentifierExpression
        const recursiveArrayXorNode: TXorNode = expectParentXorNode(nodeIdMapCollection, invokeExprXorNode.node.id);
        const recursiveExprXorNode: TXorNode = expectParentXorNode(nodeIdMapCollection, recursiveArrayXorNode.node.id);
        const headXorNode: TXorNode = expectXorChildByAttributeIndex(
            nodeIdMapCollection,
            recursiveExprXorNode.node.id,
            0,
            undefined,
        );
        if (headXorNode.node.kind === Ast.NodeKind.IdentifierExpression) {
            if (headXorNode.kind !== XorNodeKind.Ast) {
                const details: {} = {
                    identifierExpressionNodeId: headXorNode.node.id,
                    invokeExpressionNodeId: invokeExprXorNode.node.id,
                };
                throw new CommonError.InvariantError(
                    `the younger IdentifierExpression sibling should've finished parsing before the InvokeExpression node was reached`,
                    details,
                );
            }

            const identifierExpression: Ast.IdentifierExpression = headXorNode.node as Ast.IdentifierExpression;
            maybeName =
                identifierExpression.maybeInclusiveConstant === undefined
                    ? identifierExpression.identifier.literal
                    : identifierExpression.maybeInclusiveConstant.literal + identifierExpression.identifier.literal;
        }
    }

    return maybeName;
}

export function expectAstNode(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return expectInMap<Ast.TNode>(astNodeById, nodeId, "astNodeById");
}

export function expectContextNode(contextNodeById: ContextNodeById, nodeId: number): ParserContext.Node {
    return expectInMap<ParserContext.Node>(contextNodeById, nodeId, "contextNodeById");
}

export function expectXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: Option<TXorNode> = maybeXorNode(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't an astNode nor contextNode`, details);
    }

    return maybeNode;
}

export function expectParentXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: Option<TXorNode> = maybeParentXorNode(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId doesn't have a parent`, details);
    }

    return maybeNode;
}

export function expectParentAstNode(nodeIdMapCollection: Collection, nodeId: number): Ast.TNode {
    const maybeNode: Option<Ast.TNode> = maybeParentAstNode(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId doesn't have a parent`, details);
    }

    return maybeNode;
}

export function expectXorChildByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>,
): TXorNode {
    const maybeNode: Option<TXorNode> = maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );
    if (maybeNode === undefined) {
        const details: {} = { parentId, attributeIndex };
        throw new CommonError.InvariantError(`parentId doesn't have a child at the given index`, details);
    }

    return maybeNode;
}

export function expectAstChildByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: Option<ReadonlyArray<Ast.NodeKind>>,
): Ast.TNode {
    const maybeNode: Option<Ast.TNode> = maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );
    if (maybeNode === undefined) {
        const details: {} = { parentId, attributeIndex };
        throw new CommonError.InvariantError(`parentId doesn't have an Ast child at the given index`, details);
    }

    return maybeNode;
}

export function expectXorNodes(
    nodeIdMapCollection: Collection,
    nodeIds: ReadonlyArray<number>,
): ReadonlyArray<TXorNode> {
    return nodeIds.map(nodeId => expectXorNode(nodeIdMapCollection, nodeId));
}

export function expectChildIds(childIdsById: ChildIdsById, nodeId: number): ReadonlyArray<number> {
    return expectInMap<ReadonlyArray<number>>(childIdsById, nodeId, "childIdsById");
}

export function expectAstChildren(nodeIdMapCollection: Collection, parentId: number): ReadonlyArray<Ast.TNode> {
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    return expectChildIds(nodeIdMapCollection.childIdsById, parentId).map(childId =>
        expectAstNode(astNodeById, childId),
    );
}

export function expectXorChildren(nodeIdMapCollection: Collection, parentId: number): ReadonlyArray<TXorNode> {
    const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return [];
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    return expectXorNodes(nodeIdMapCollection, childIds);
}

export function deepCopyCollection(nodeIdMapCollection: Collection): Collection {
    const contextNodeById: ContextNodeById = new Map<number, ParserContext.Node>();
    nodeIdMapCollection.contextNodeById.forEach((value: ParserContext.Node, key: number) => {
        contextNodeById.set(key, { ...value });
    });
    return {
        // Ast.TNode is readonly so a shallow copy should be safe
        astNodeById: new Map(nodeIdMapCollection.astNodeById.entries()),
        contextNodeById,
        // Shallow copies of Map<number, number> is safe
        childIdsById: new Map(nodeIdMapCollection.childIdsById.entries()),
        parentIdById: new Map(nodeIdMapCollection.parentIdById.entries()),
    };
}

type NumberMap<T> = Map<number, T>;

function expectInMap<T>(map: Map<number, T>, nodeId: number, mapName: string): T {
    const maybeValue: Option<T> = map.get(nodeId);
    if (maybeValue === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't in ${mapName}`, details);
    }
    return maybeValue;
}
