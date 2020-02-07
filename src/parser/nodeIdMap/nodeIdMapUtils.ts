// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParseContext } from "..";
import { CommonError, isNever } from "../../common";
import { TokenRange } from "../../lexer";
import { AstNodeById, ChildIdsById, Collection, ContextNodeById } from "./nodeIdMap";
import { TXorNode, XorNodeKind, XorNodeTokenRange } from "./xorNode";

export function xorNodeFromAst(node: Ast.TNode): TXorNode {
    return {
        kind: XorNodeKind.Ast,
        node,
    };
}

export function xorNodeFromContext(node: ParseContext.Node): TXorNode {
    return {
        kind: XorNodeKind.Context,
        node,
    };
}

export function maybeXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode) {
        const astNode: Ast.TNode = maybeAstNode;
        return {
            kind: XorNodeKind.Ast,
            node: astNode,
        };
    }

    const maybeContextNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode) {
        const contextNode: ParseContext.Node = maybeContextNode;
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
): TXorNode | undefined {
    const childXorNode: TXorNode = expectXorNode(nodeIdMapCollection, rootId);
    if (childXorNode.node.maybeAttributeIndex === undefined) {
        return undefined;
    }

    const attributeIndex: number = childXorNode.node.maybeAttributeIndex + offset;
    if (attributeIndex < 0) {
        return undefined;
    }

    const parentXorNode: TXorNode = expectParentXorNode(nodeIdMapCollection, rootId, undefined);
    const childIds: ReadonlyArray<number> = expectChildIds(nodeIdMapCollection.childIdsById, parentXorNode.node.id);
    if (childIds.length >= attributeIndex) {
        return undefined;
    }

    return maybeXorNode(nodeIdMapCollection, childIds[attributeIndex]);
}

export function maybeNextSiblingXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    return maybeNthSiblingXorNode(nodeIdMapCollection, nodeId, 1);
}

export function maybeParentXorNode(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeParentAstNode(nodeIdMapCollection, childId, maybeAllowedNodeKinds);
    if (maybeAstNode !== undefined) {
        return xorNodeFromAst(maybeAstNode);
    }

    const maybeContextNode: ParseContext.Node | undefined = maybeParentContextNode(
        nodeIdMapCollection,
        childId,
        maybeAllowedNodeKinds,
    );
    if (maybeContextNode !== undefined) {
        return xorNodeFromContext(maybeContextNode);
    }

    return undefined;
}

export function maybeParentAstNode(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): Ast.TNode | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentId === undefined) {
        return undefined;
    }
    const maybeParent: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(maybeParentId);

    if (maybeParent === undefined) {
        return undefined;
    }
    const parent: Ast.TNode = maybeParent;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(parent.kind) === -1) {
        return undefined;
    }

    return parent;
}

export function maybeParentContextNode(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): ParseContext.Node | undefined {
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentId === undefined) {
        return undefined;
    }
    const maybeParent: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(maybeParentId);

    if (maybeParent === undefined) {
        return undefined;
    }
    const parent: ParseContext.Node = maybeParent;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(parent.kind) === -1) {
        return undefined;
    }

    return parent;
}

export function maybeAstChildren(
    nodeIdMapCollection: Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> | undefined {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    return childIds.map(childId => expectAstNode(astNodeById, childId));
}

// Both Ast.TNode and ParserContext.Node store an attribute index
// when defined represents which child index they are under for their parent.
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
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): Ast.TNode | undefined {
    const maybeNode: TXorNode | undefined = maybeXorChildByAttributeIndex(
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
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): ParseContext.Node | undefined {
    const maybeNode: TXorNode | undefined = maybeXorChildByAttributeIndex(
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

export function maybeInvokeExpressionName(nodeIdMapCollection: Collection, nodeId: number): string | undefined {
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
    let maybeName: string | undefined;
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
                    : identifierExpression.maybeInclusiveConstant.constantKind +
                      identifierExpression.identifier.literal;
        }
    }

    return maybeName;
}

export function expectAstNode(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return expectInMap<Ast.TNode>(astNodeById, nodeId, "astNodeById");
}

export function expectContextNode(contextNodeById: ContextNodeById, nodeId: number): ParseContext.Node {
    return expectInMap<ParseContext.Node>(contextNodeById, nodeId, "contextNodeById");
}

export function expectXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: TXorNode | undefined = maybeXorNode(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't an astNode nor contextNode`, details);
    }

    return maybeNode;
}

export function expectParentXorNode(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeNode: TXorNode | undefined = maybeParentXorNode(nodeIdMapCollection, nodeId, maybeAllowedNodeKinds);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId doesn't have a parent`, details);
    }

    return maybeNode;
}

export function expectParentAstNode(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): Ast.TNode {
    const maybeNode: Ast.TNode | undefined = maybeParentAstNode(nodeIdMapCollection, nodeId, maybeAllowedNodeKinds);
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
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): TXorNode {
    const maybeNode: TXorNode | undefined = maybeXorChildByAttributeIndex(
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
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): Ast.TNode {
    const maybeNode: Ast.TNode | undefined = maybeAstChildByAttributeIndex(
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

export function expectContextChildByAttributeIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    attributeIndex: number,
    maybeChildNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined,
): ParseContext.Node {
    const maybeNode: ParseContext.Node | undefined = maybeContextChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        maybeChildNodeKinds,
    );
    if (maybeNode === undefined) {
        const details: {} = { parentId, attributeIndex };
        throw new CommonError.InvariantError(`parentId doesn't have a context child at the given index`, details);
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
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return [];
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    return expectXorNodes(nodeIdMapCollection, childIds);
}

// There are a few assumed invariants about children:
//  * Children are read left to right.
//  * Children are placed in childIdsById in the order they were read.
//  * Therefore the right-most child is the most recently read which also appears last in the document.
export function maybeRightMostLeaf(
    nodeIdMapCollection: Collection,
    rootId: number,
    maybeCondition: ((node: Ast.TNode) => boolean) | undefined = undefined,
): Ast.TNode | undefined {
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    let nodeIdsToExplore: number[] = [rootId];
    let maybeRightMost: Ast.TNode | undefined;

    while (nodeIdsToExplore.length) {
        const nodeId: number = nodeIdsToExplore.pop()!;
        const maybeAstNode: Ast.TNode | undefined = astNodeById.get(nodeId);

        let addChildren: boolean = false;

        // Check if Ast.TNode or ParserContext.Node
        if (maybeAstNode !== undefined) {
            const astNode: Ast.TNode = maybeAstNode;
            if (maybeCondition && !maybeCondition(astNode)) {
                continue;
            }

            // Is leaf, check if it's more right than the previous record.
            // As it's a leaf there are no children to add.
            if (astNode.isLeaf) {
                // Is the first leaf encountered.
                if (maybeRightMost === undefined) {
                    maybeRightMost = astNode;
                }
                // Compare current leaf node to the existing record.
                else if (astNode.tokenRange.tokenIndexStart > maybeRightMost.tokenRange.tokenIndexStart) {
                    maybeRightMost = astNode;
                }
            }
            // Is not a leaf, no previous record exists.
            // Add all children to the queue.
            else if (maybeRightMost === undefined) {
                addChildren = true;
            }
            // Is not a leaf, previous record exists.
            // Check if we can cull the branch, otherwise add all children to the queue.
            else if (astNode.tokenRange.tokenIndexEnd > maybeRightMost.tokenRange.tokenIndexStart) {
                addChildren = true;
            }
        }
        // Must be a ParserContext.Node.
        // Add all children to the queue as ParserContext.Nodes can have Ast children which are leafs.
        else {
            addChildren = true;
        }

        if (addChildren) {
            const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(nodeId);
            if (maybeChildIds !== undefined) {
                // Add the child ids in reversed order to prioritize visiting the right most nodes first.
                const childIds: ReadonlyArray<number> = maybeChildIds;
                const reversedChildIds: number[] = [...childIds];
                reversedChildIds.reverse();
                nodeIdsToExplore = [...reversedChildIds, ...nodeIdsToExplore];
            }
        }
    }

    return maybeRightMost;
}

export function maybeRightMostLeafWhere(
    nodeIdMapCollection: Collection,
    rootId: number,
    maybeCondition: ((node: Ast.TNode) => boolean) | undefined,
): Ast.TNode | undefined {
    return maybeRightMostLeaf(nodeIdMapCollection, rootId, maybeCondition);
}

export function leftMostXorNode(nodeIdMapCollection: Collection, rootId: number): TXorNode {
    let currentNode: TXorNode | undefined = expectXorNode(nodeIdMapCollection, rootId);
    let potentialNode: TXorNode | undefined = expectXorChildByAttributeIndex(
        nodeIdMapCollection,
        currentNode.node.id,
        0,
        undefined,
    );

    while (potentialNode !== undefined) {
        currentNode = potentialNode;
        potentialNode = expectXorChildByAttributeIndex(nodeIdMapCollection, currentNode.node.id, 0, undefined);
    }

    return currentNode;
}

export function isTUnaryType(xorNode: TXorNode): boolean {
    return xorNode.node.kind === Ast.NodeKind.UnaryExpression || isTTypeExpression(xorNode);
}

export function isTTypeExpression(xorNode: TXorNode): boolean {
    return xorNode.node.kind === Ast.NodeKind.TypePrimaryType || isTPrimaryExpression(xorNode);
}

export function isTPrimaryExpression(xorNode: TXorNode): boolean {
    switch (xorNode.node.kind) {
        case Ast.NodeKind.LiteralExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.IdentifierExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.RecursivePrimaryExpression:
        case Ast.NodeKind.NotImplementedExpression:
            return true;

        default:
            return isTFieldAccessExpression(xorNode);
    }
}

export function isTFieldAccessExpression(xorNode: TXorNode): boolean {
    return xorNode.node.kind === Ast.NodeKind.FieldSelector || xorNode.node.kind === Ast.NodeKind.FieldProjection;
}

export function expectAncestry(nodeIdMapCollection: Collection, rootId: number): ReadonlyArray<TXorNode> {
    const ancestryIds: number[] = [rootId];

    let maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(rootId);
    while (maybeParentId) {
        const parentId: number = maybeParentId;
        ancestryIds.push(parentId);
        maybeParentId = nodeIdMapCollection.parentIdById.get(parentId);
    }

    return expectXorNodes(nodeIdMapCollection, ancestryIds);
}

export function xorNodeTokenRange(nodeIdMapCollection: Collection, xorNode: TXorNode): XorNodeTokenRange {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const tokenRange: TokenRange = xorNode.node.tokenRange;
            return {
                tokenIndexStart: tokenRange.tokenIndexStart,
                tokenIndexEnd: tokenRange.tokenIndexEnd,
            };
        }

        case XorNodeKind.Context: {
            const contextNode: ParseContext.Node = xorNode.node;
            let tokenIndexEnd: number;

            const maybeRightMostChild: Ast.TNode | undefined = maybeRightMostLeaf(nodeIdMapCollection, xorNode.node.id);
            if (maybeRightMostChild === undefined) {
                tokenIndexEnd = contextNode.tokenIndexStart;
            } else {
                const rightMostChild: Ast.TNode = maybeRightMostChild;
                tokenIndexEnd = rightMostChild.tokenRange.tokenIndexEnd;
            }

            return {
                tokenIndexStart: contextNode.tokenIndexStart,
                tokenIndexEnd,
            };
        }

        default:
            throw isNever(xorNode);
    }
}

function expectInMap<T>(map: Map<number, T>, nodeId: number, mapName: string): T {
    const maybeValue: T | undefined = map.get(nodeId);
    if (maybeValue === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't in ${mapName}`, details);
    }
    return maybeValue;
}
