// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from ".";
import { ParseContext } from "..";
import { Language } from "../..";
import { ArrayUtils, Assert, CommonError, MapUtils, TypeScriptUtils } from "../../common";
import { Ast } from "../../language";
import { ParseContextUtils } from "../context";
import { IParserState } from "../IParserState";
import { AstNodeById, Collection, ContextNodeById } from "./nodeIdMap";
import { TXorNode, XorNodeKind, XorNodeTokenRange } from "./xorNode";

export function assertDeleteXorNode(nodeIdMapCollection: Collection, xorNode: TXorNode): void {
    assertDeleteXorNodeId(nodeIdMapCollection, xorNode.node.id);
}

export function assertDeleteXorNodeId(nodeIdMapCollection: Collection, nodeId: number): void {
    Assert.isFalse(nodeIdMapCollection.childIdsById.has(nodeId));
    Assert.isTrue(
        nodeIdMapCollection.astNodeById.delete(nodeId) || nodeIdMapCollection.contextNodeById.delete(nodeId),
        "nodeIdMapCollection.astNodeById.delete(nodeId) || nodeIdMapCollection.contextNodeById.delete(nodeId)",
    );

    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);
    if (maybeParentId !== undefined) {
        const childrenOfParent: ReadonlyArray<number> = MapUtils.assertGet(
            nodeIdMapCollection.childIdsById,
            maybeParentId,
            `nodeId has a parent, so parentId should have nodeId as a child`,
            { nodeId, parentId: maybeParentId },
        );
        nodeIdMapCollection.childIdsById.set(maybeParentId, ArrayUtils.removeFirstInstance(childrenOfParent, nodeId));
    }
}

export function assertReplaceXorNodeId(nodeIdMapCollection: Collection, oldId: number, newNode: TXorNode): void {
    Assert.isFalse(nodeIdMapCollection.childIdsById.has(oldId));
    Assert.isTrue(
        nodeIdMapCollection.astNodeById.delete(oldId) || nodeIdMapCollection.contextNodeById.delete(oldId),
        "nodeIdMapCollection.astNodeById.delete(nodeId) || nodeIdMapCollection.contextNodeById.delete(nodeId)",
    );

    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);
    if (maybeParentId !== undefined) {
        const childrenOfParent: ReadonlyArray<number> = MapUtils.assertGet(
            nodeIdMapCollection.childIdsById,
            maybeParentId,
            `nodeId has a parent, so parentId should have nodeId as a child`,
            { nodeId: oldId, parentId: maybeParentId },
        );
        nodeIdMapCollection.childIdsById.set(maybeParentId, ArrayUtils.removeFirstInstance(childrenOfParent, oldId));
    }
}

export function assertSetNewXorNode(nodeIdMapCollection: Collection, xorNode: TXorNode): void {
    if (xorNode.kind === XorNodeKind.Ast) {
        MapUtils.assertNotHas(nodeIdMapCollection.astNodeById, xorNode.node.id);
        nodeIdMapCollection.astNodeById.set(xorNode.node.id, xorNode.node);
    } else {
        MapUtils.assertNotHas(nodeIdMapCollection.contextNodeById, xorNode.node.id);
        nodeIdMapCollection.contextNodeById.set(xorNode.node.id, xorNode.node);
    }
}

export function expectAstNode(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return MapUtils.expectGet(astNodeById, nodeId);
}

export function expectContextNode(contextNodeById: ContextNodeById, nodeId: number): ParseContext.Node {
    return MapUtils.expectGet(contextNodeById, nodeId);
}

export function maybeXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(nodeId);
    if (maybeAstNode) {
        return XorNodeUtils.astFactory(maybeAstNode);
    }

    const maybeContextNode: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(nodeId);
    if (maybeContextNode) {
        return XorNodeUtils.contextFactory(maybeContextNode);
    }

    return undefined;
}

export function expectXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: TXorNode | undefined = maybeXorNode(nodeIdMapCollection, nodeId);
    Assert.isDefined(maybeNode, undefined, { nodeId });

    return maybeNode;
}

export function maybeParentXorNode(
    nodeIdMapCollection: Collection,
    childId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode | undefined {
    const maybeAstNode: Ast.TNode | undefined = maybeParentAstNode(nodeIdMapCollection, childId, maybeAllowedNodeKinds);
    if (maybeAstNode !== undefined) {
        return XorNodeUtils.astFactory(maybeAstNode);
    }

    const maybeContextNode: ParseContext.Node | undefined = maybeParentContextNode(
        nodeIdMapCollection,
        childId,
        maybeAllowedNodeKinds,
    );
    if (maybeContextNode !== undefined) {
        return XorNodeUtils.contextFactory(maybeContextNode);
    }

    return undefined;
}

export function expectParentXorNode(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): TXorNode {
    const maybeNode: TXorNode | undefined = maybeParentXorNode(nodeIdMapCollection, nodeId, maybeAllowedNodeKinds);
    Assert.isDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId });

    return maybeNode;
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

    if (maybeAllowedNodeKinds?.indexOf(parent.kind) === -1) {
        return undefined;
    }

    return parent;
}

export function expectParentAstNode(
    nodeIdMapCollection: Collection,
    nodeId: number,
    maybeAllowedNodeKinds: ReadonlyArray<Ast.NodeKind> | undefined = undefined,
): Ast.TNode {
    const maybeNode: Ast.TNode | undefined = maybeParentAstNode(nodeIdMapCollection, nodeId, maybeAllowedNodeKinds);
    Assert.isDefined(maybeNode, `nodeId doesn't have a parent`, { nodeId });

    return maybeNode;
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

    if (maybeAllowedNodeKinds?.indexOf(parent.kind) === -1) {
        return undefined;
    }

    return parent;
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
            if (maybeChildNodeKinds !== undefined) {
                ArrayUtils.assertIn(maybeChildNodeKinds, xorNode.node.kind);
            }

            return xorNode;
        }
    }

    return undefined;
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
    Assert.isDefined(maybeNode, `parentId doesn't have a child at the given index`, { parentId, attributeIndex });

    return maybeNode;
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

    return maybeNode?.kind === XorNodeKind.Ast ? maybeNode.node : undefined;
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
    Assert.isDefined(maybeNode, `parentId doesn't have an Ast child at the given index`, { parentId, attributeIndex });

    return maybeNode;
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

    return maybeNode?.kind === XorNodeKind.Context ? maybeNode.node : undefined;
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
    Assert.isDefined(maybeNode, `parentId doesn't have a context child at the given index`, {
        parentId,
        attributeIndex,
    });

    return maybeNode;
}

export function maybeLeftMostXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode | undefined {
    const currentNode: TXorNode | undefined = maybeXorNode(nodeIdMapCollection, nodeId);
    if (currentNode === undefined) {
        return undefined;
    }

    let currentNodeId: number = currentNode.node.id;
    let maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(currentNodeId);
    while (maybeChildIds?.length) {
        currentNodeId = maybeChildIds[0];
        maybeChildIds = nodeIdMapCollection.childIdsById.get(currentNodeId);
    }

    return maybeXorNode(nodeIdMapCollection, currentNodeId);
}

export function maybeLeftMostLeaf(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): Ast.TNode | undefined {
    const maybeNode: TXorNode | undefined = maybeLeftMostXorNode(nodeIdMapCollection, nodeId);

    return maybeNode?.kind === XorNodeKind.Ast ? maybeNode.node : undefined;
}

export function expectLeftMostXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: TXorNode | undefined = maybeLeftMostXorNode(nodeIdMapCollection, nodeId);
    Assert.isDefined(maybeNode, undefined, { nodeId });

    return maybeNode;
}

// There are a few assumed invariants about children:
//  * Children were read left to right.
//  * Children were placed in childIdsById in the order they were read.
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

// Returns the previous sibling of the given recursive expression.
// Commonly used for things like getting the identifier name used in an InvokeExpression.
export function expectRecursiveExpressionPreviousSibling(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const xorNode: TXorNode = expectXorNode(nodeIdMapCollection, nodeId);
    const arrayWrapper: TXorNode = expectParentXorNode(nodeIdMapCollection, nodeId, [Ast.NodeKind.ArrayWrapper]);
    const maybeInvokeExpressionAttributeIndex: number | undefined = xorNode.node.maybeAttributeIndex;

    // It's not the first element in the ArrayWrapper.
    if (maybeInvokeExpressionAttributeIndex && maybeInvokeExpressionAttributeIndex > 0) {
        const childIds: ReadonlyArray<number> = NodeIdMapIterator.expectChildIds(
            nodeIdMapCollection.childIdsById,
            arrayWrapper.node.id,
        );
        const indexOfInvokeExprId: number = childIds.indexOf(xorNode.node.id);
        if (indexOfInvokeExprId === -1 || indexOfInvokeExprId === 0) {
            const details: {} = {
                invokeExprId: xorNode.node.id,
                arrayWrapperId: arrayWrapper.node.id,
                indexOfInvokeExprId,
            };
            throw new CommonError.InvariantError(
                `expected to find invokeExpr in arrayWrapper's children at an index > 0`,
                details,
            );
        }

        return expectXorChildByAttributeIndex(
            nodeIdMapCollection,
            arrayWrapper.node.id,
            indexOfInvokeExprId - 1,
            undefined,
        );
    }
    // It's the first element in ArrayWrapper, meaning we must grab RecursivePrimaryExpression.head
    else {
        const recursivePrimaryExpression: TXorNode = expectParentXorNode(nodeIdMapCollection, arrayWrapper.node.id);
        return expectXorChildByAttributeIndex(nodeIdMapCollection, recursivePrimaryExpression.node.id, 0, undefined);
    }
}

export function maybeInvokeExpressionName(nodeIdMapCollection: Collection, nodeId: number): string | undefined {
    const invokeExprXorNode: TXorNode = expectXorNode(nodeIdMapCollection, nodeId);
    XorNodeUtils.assertAstNodeKind(invokeExprXorNode, Ast.NodeKind.InvokeExpression);

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

// Contains at least one parsed token.
export function hasParsedToken(nodeIdMapCollection: Collection, nodeId: number): boolean {
    let maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(nodeId);

    while (maybeChildIds !== undefined) {
        const numChildren: number = maybeChildIds.length;

        // No children means no nothing was parsed under this node.
        if (numChildren === 0) {
            return false;
        }
        // There might be a child under here.
        else if (numChildren === 1) {
            const childId: number = maybeChildIds[0];
            // We know it's an Ast Node, therefore something was parsed.
            if (nodeIdMapCollection.astNodeById.has(childId)) {
                return true;
            }
            // There still might be a child under here. Recurse down to the grandchildren.
            else {
                maybeChildIds = nodeIdMapCollection.childIdsById.get(childId);
            }
        }
        // Handles the 'else if (numChildren > 2)' branch.
        // A Context should never have more than one open Context node at a time,
        // meaning there must be at least one Ast node under here.
        else {
            return true;
        }
    }

    return false;
}

// Recalculates the id numbers of the Ast, starting with the given TXorNode and continuing for all of its children.
// Used to help reset a node's id for recursive node kinds, such as RecursivePrimaryExpression.
//
// Mutates the NodeIdMap.Collection and the TXorNodes it holds.
// Assumes the given arguments are valid before as this function does no validation.
export function recalculateId(nodeIdMapCollection: Collection, parserState: IParserState, nodeStart: TXorNode): void {
    // A helper stack we use for recursively visiting children nodes.
    const newNodeIdByOldNodeId: Map<number, number> = new Map();
    let nodeStack: TXorNode[] = [nodeStart];
    let currentNode: TXorNode | undefined = nodeStack.pop();
    while (currentNode !== undefined) {
        const newNodeId: number = ParseContextUtils.nextId(parserState.contextState);
        newNodeIdByOldNodeId.set(currentNode.node.id, newNodeId);

        const childrenOfCurrentNode: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorChildren(
            nodeIdMapCollection,
            currentNode.node.id,
        );
        const reversedChildrenOfCurrentNode: ReadonlyArray<TXorNode> = [...childrenOfCurrentNode].reverse();
        nodeStack = nodeStack.concat(reversedChildrenOfCurrentNode);

        currentNode = nodeStack.pop();
    }

    updateNodeIds(nodeIdMapCollection, newNodeIdByOldNodeId);
}

// Given a mapping of (existingId) => (newId) thism utates the NodeIdMap.Collection and the TXorNodes it holds.
export function updateNodeIds(nodeIdMapCollection: Collection, newNodeIdByOldNodeId: Map<number, number>): void {
    // We'll be iterating over them twice, so grab them once.
    const xorNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorNodes(nodeIdMapCollection, [
        ...newNodeIdByOldNodeId.keys(),
    ]);

    // Storage for the change delta before modifying nodeIdMapCollection.
    const partialCollection: Collection = {
        astNodeById: new Map(),
        childIdsById: new Map(),
        contextNodeById: new Map(),
        maybeRightMostLeaf: undefined,
        parentIdById: new Map(),
    };

    // Build up the change delta.
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = newNodeIdByOldNodeId.get(oldId)!;

        if (xorNode.kind === XorNodeKind.Ast) {
            partialCollection.astNodeById.set(newId, xorNode.node);
        } else {
            partialCollection.contextNodeById.set(newId, xorNode.node);
        }

        // If the node has children and the change delta hasn't been calculated,
        // then calculate the children for the change delta.
        const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);
        if (maybeChildIds !== undefined && !partialCollection.childIdsById.has(newId)) {
            const newChildIds: ReadonlyArray<number> = maybeChildIds.map(
                (childId: number) => newNodeIdByOldNodeId.get(childId) ?? childId,
            );
            partialCollection.childIdsById.set(newId, newChildIds);
        }

        // If the node has a parent,
        // then calculate the updated parent for the change delta.
        const maybeOldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);
        if (maybeOldParentId !== undefined) {
            const newParentId: number = newNodeIdByOldNodeId.get(maybeOldParentId) ?? maybeOldParentId;
            partialCollection.parentIdById.set(newId, newParentId);

            // If the parent has children and the change delta hasn't been calculated for the parent's children,
            // then calculate the children for the change delta.
            if (!partialCollection.childIdsById.has(newParentId)) {
                const oldChildIdsOfParent: ReadonlyArray<number> = MapUtils.assertGet(
                    nodeIdMapCollection.childIdsById,
                    maybeOldParentId,
                );
                const newChildIdsOfParent: ReadonlyArray<number> = oldChildIdsOfParent.map(
                    (childId: number) => newNodeIdByOldNodeId.get(childId) ?? childId,
                );
                partialCollection.childIdsById.set(newParentId, newChildIdsOfParent);
            }
        }
    }

    // Apply the change delta
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = newNodeIdByOldNodeId.get(oldId)!;

        if (xorNode.kind === XorNodeKind.Ast) {
            const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode> = xorNode.node;
            mutableNode.id = newId;
            nodeIdMapCollection.astNodeById.set(newId, mutableNode);
            if (!partialCollection.astNodeById.has(oldId)) {
                nodeIdMapCollection.astNodeById.delete(oldId);
            }
        } else {
            const mutableNode: TypeScriptUtils.StripReadonly<ParseContext.Node> = xorNode.node;
            mutableNode.id = newId;
            nodeIdMapCollection.contextNodeById.set(newId, mutableNode);
            if (!partialCollection.contextNodeById.has(oldId)) {
                nodeIdMapCollection.contextNodeById.delete(oldId);
            }
        }

        const maybeParentId: number | undefined = partialCollection.parentIdById.get(newId);
        if (maybeParentId !== undefined) {
            nodeIdMapCollection.parentIdById.set(newId, maybeParentId);
            if (!partialCollection.parentIdById.has(oldId)) {
                MapUtils.assertDelete(nodeIdMapCollection.parentIdById, oldId);
            }
        } else {
            nodeIdMapCollection.parentIdById.delete(newId);
        }

        const maybeChildIds: ReadonlyArray<number> | undefined = partialCollection.childIdsById.get(newId);
        if (maybeChildIds !== undefined) {
            nodeIdMapCollection.childIdsById.set(newId, maybeChildIds);
            if (!partialCollection.parentIdById.has(oldId)) {
                MapUtils.assertDelete(nodeIdMapCollection.childIdsById, oldId);
            }
        } else {
            nodeIdMapCollection.childIdsById.delete(newId);
        }
    }
}

export function xorNodeTokenRange(nodeIdMapCollection: Collection, xorNode: TXorNode): XorNodeTokenRange {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const tokenRange: Language.TokenRange = xorNode.node.tokenRange;
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
            throw Assert.isNever(xorNode);
    }
}

export function maybeWrappedContent(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: Ast.NodeKind,
): TXorNode | undefined {
    return maybeXorChildByAttributeIndex(nodeIdMapCollection, wrapped.node.id, 1, [maybeChildNodeKind]);
}

export function maybeWrappedContentAst(
    nodeIdMapCollection: Collection,
    wrapped: TXorNode,
    maybeChildNodeKind: Ast.NodeKind,
): Ast.TNode | undefined {
    const maybeAst: TXorNode | undefined = maybeXorChildByAttributeIndex(nodeIdMapCollection, wrapped.node.id, 1, [
        maybeChildNodeKind,
    ]);
    return maybeAst?.kind === XorNodeKind.Ast ? maybeAst.node : undefined;
}

export function maybeArrayWrapperContent(nodeIdMapCollection: Collection, wrapped: TXorNode): TXorNode | undefined {
    return maybeXorChildByAttributeIndex(nodeIdMapCollection, wrapped.node.id, 1, [Ast.NodeKind.ArrayWrapper]);
}

export function maybeCsvNode(nodeIdMapCollection: Collection, csv: TXorNode): TXorNode | undefined {
    return maybeXorChildByAttributeIndex(nodeIdMapCollection, csv.node.id, 0, undefined);
}
