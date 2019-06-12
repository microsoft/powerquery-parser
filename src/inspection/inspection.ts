// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, isNever, Option, ResultKind, Traverse } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext, TokenRange } from "../parser";

// An inspection is done by selecting a leaf node, then recursively traveling up the node's parents.
// If a leaf node doesn't exist at the given postion, then the closest node to the left is used (if one exists).
//
// There are three forms that the parent path can take:
//  * all nodes are Ast.TNode
//  * all nodes are ParserContext.Node
//  * nodes are initially Ast.TNode, then they become ParserContext.Node

export type TriedInspect = Traverse.TriedTraverse<Inspection>;

export const enum NodeKind {
    Each = "EachExpression",
    List = "List",
    Record = "Record",
}

export interface Inspection {
    readonly nodes: INode[];
    readonly scope: string[];
}

export interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

export interface INode {
    readonly kind: NodeKind;
    readonly maybePositionStart: Option<TokenPosition>;
    readonly maybePositionEnd: Option<TokenPosition>;
}

export interface Record extends INode {
    readonly kind: NodeKind.Record;
}

export interface Each extends INode {
    readonly kind: NodeKind.Each;
}

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Traverse.TriedTraverse<Inspection> {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybeClosestXorNode(position, nodeIdMapCollection, leafNodeIds);
    if (maybeXorNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultInspection,
        };
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    const state: State = {
        result: {
            nodes: [],
            scope: [],
        },
        isEachEncountered: false,
        maybePreviousXorNode: undefined,
        position,
        nodeIdMapCollection,
        leafNodeIds,
    };
    return Traverse.tryTraverseXor<State, Inspection>(
        xorNode,
        nodeIdMapCollection,
        state,
        Traverse.VisitNodeStrategy.BreadthFirst,
        inspectXorNode,
        addParentXorNode,
        undefined,
    );
}

interface State extends Traverse.IState<Inspection> {
    maybePreviousXorNode: Option<NodeIdMap.TXorNode>;
    isEachEncountered: boolean;
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

const DefaultInspection: Inspection = {
    nodes: [],
    scope: [],
};

function addParentXorNode(
    _state: State & Traverse.IState<Inspection>,
    xorNode: NodeIdMap.TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<NodeIdMap.TXorNode> {
    let maybeParentNodeId: Option<number>;

    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const astNode: Ast.TNode = xorNode.node;
            maybeParentNodeId = nodeIdMapCollection.parentIdById.get(astNode.id);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const contextNode: ParserContext.Node = xorNode.node;
            maybeParentNodeId = nodeIdMapCollection.parentIdById.get(contextNode.nodeId);
            break;
        }

        default:
            throw isNever(xorNode);
    }

    if (maybeParentNodeId === undefined) {
        return [];
    }

    const maybeAstParentNode: Option<Ast.TNode> = nodeIdMapCollection.astNodeById.get(maybeParentNodeId);
    if (maybeAstParentNode) {
        return [
            {
                kind: NodeIdMap.XorNodeKind.Ast,
                node: maybeAstParentNode,
            },
        ];
    }

    const maybeContextParentNode: Option<ParserContext.Node> = nodeIdMapCollection.contextNodeById.get(
        maybeParentNodeId,
    );
    if (maybeContextParentNode) {
        return [
            {
                kind: NodeIdMap.XorNodeKind.Context,
                node: maybeContextParentNode,
            },
        ];
    }

    return [];
}

function inspectXorNode(xorNode: NodeIdMap.TXorNode, state: State): void {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            inspectAstNode(state, xorNode.node);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            inspectContextNode(state, xorNode.node);
            break;
        }

        default:
            throw isNever(xorNode);
    }
}

function inspectAstNode(state: State, node: Ast.TNode): void {
    switch (node.kind) {
        case Ast.NodeKind.EachExpression: {
            if (!state.isEachEncountered) {
                state.result.scope.push("_");
            }

            const tokenRange: TokenRange = node.tokenRange;
            state.result.nodes.push({
                kind: NodeKind.Each,
                maybePositionStart: tokenRange.positionStart,
                maybePositionEnd: tokenRange.positionEnd,
            });
            break;
        }

        case Ast.NodeKind.Identifier:
            if (!isParentOfNodeKind(state.nodeIdMapCollection, node.id, Ast.NodeKind.IdentifierExpression)) {
                state.result.scope.push(node.literal);
            }
            break;

        case Ast.NodeKind.IdentifierExpression: {
            let identifier: string = node.identifier.literal;
            if (node.maybeInclusiveConstant) {
                const inclusiveConstant: Ast.Constant = node.maybeInclusiveConstant;
                identifier = inclusiveConstant.literal + identifier;
            }
            state.result.scope.push(identifier);
            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral: {
            // Check if position is on closeWrapperConstant, eg. '}'
            const position: Position = state.position;
            const tokenRange: TokenRange = node.tokenRange;
            if (
                isInTokenRange(position, tokenRange) &&
                !isPositionOnTokenPosition(position, node.closeWrapperConstant.tokenRange.positionStart)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.List,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });
            }
            break;
        }

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            // Check if position is on closeWrapperConstant, eg. ']'
            const position: Position = state.position;
            const tokenRange: TokenRange = node.tokenRange;
            if (
                isInTokenRange(position, tokenRange) &&
                !isPositionOnTokenPosition(position, node.closeWrapperConstant.tokenRange.positionStart)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.Record,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });
            }
            break;
        }

        default:
            break;
    }
}

function inspectContextNode(state: State, node: ParserContext.Node): void {
    switch (node.nodeKind) {
        case Ast.NodeKind.EachExpression: {
            if (!state.isEachEncountered) {
                state.result.scope.push("_");
            }
            state.isEachEncountered = true;

            state.result.nodes.push({
                kind: NodeKind.Each,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral: {
            state.result.nodes.push({
                kind: NodeKind.List,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            state.result.nodes.push({
                kind: NodeKind.Record,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        default:
            break;
    }
}

function isInTokenRange(position: Position, tokenRange: TokenRange): boolean {
    const tokenRangePositionStart: TokenPosition = tokenRange.positionStart;
    const tokenRangePositionEnd: TokenPosition = tokenRange.positionEnd;

    if (
        position.lineNumber < tokenRangePositionStart.lineNumber ||
        position.lineNumber > tokenRangePositionEnd.lineNumber
    ) {
        return false;
    } else if (
        position.lineNumber === tokenRangePositionStart.lineNumber &&
        position.lineCodeUnit < tokenRangePositionStart.lineCodeUnit
    ) {
        return false;
    } else if (
        position.lineNumber === tokenRangePositionEnd.lineNumber &&
        position.lineCodeUnit >= tokenRangePositionEnd.lineCodeUnit
    ) {
        return false;
    } else {
        return true;
    }
}

function isPositionOnTokenPosition(position: Position, tokenPosition: TokenPosition): boolean {
    return position.lineNumber !== tokenPosition.lineNumber && position.lineCodeUnit !== tokenPosition.lineCodeUnit;
}

function maybeClosestXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    let maybeClosestNode: Option<NodeIdMap.TXorNode>;

    for (const nodeId of leafNodeIds) {
        const newNode: NodeIdMap.TXorNode = NodeIdMap.expectXorNode(nodeIdMapCollection, nodeId);
        maybeClosestNode = closerXorNode(position, maybeClosestNode, newNode);
    }

    return maybeClosestNode;
}

// Assumes both TXorNode parameters are leaf nodes.
function closerXorNode(
    position: Position,
    maybeCurrentNode: Option<NodeIdMap.TXorNode>,
    newNode: NodeIdMap.TXorNode,
): Option<NodeIdMap.TXorNode> {
    const newNodePositionStart: TokenPosition = expectTokenStart(newNode);

    // If currentToken isn't set and newNode's start position is <= position: return newToken
    // Else: return undefined
    if (maybeCurrentNode === undefined) {
        if (newNodePositionStart.lineNumber > position.lineNumber) {
            return undefined;
        } else if (
            newNodePositionStart.lineNumber === position.lineNumber &&
            newNodePositionStart.lineCodeUnit >= position.lineCodeUnit
        ) {
            return undefined;
        } else {
            return newNode;
        }
    }
    const currentNode: NodeIdMap.TXorNode = maybeCurrentNode;
    const currentNodePositionStart: TokenPosition = expectTokenStart(currentNode);

    // Verifies newTokenPositionStart starts no later than the position argument.
    if (newNodePositionStart.lineNumber > position.lineNumber) {
        return currentNode;
    } else if (
        newNodePositionStart.lineNumber === position.lineNumber &&
        newNodePositionStart.lineCodeUnit > position.lineCodeUnit
    ) {
        return currentNode;
    }

    // Both currentTokenPositionStart and newTokenPositionStart are <= position,
    // so a quick comparison can be done by examining TokenPosition.codeUnit
    return currentNodePositionStart.codeUnit < newNodePositionStart.codeUnit ? newNode : currentNode;
}

function expectTokenStart(xorNode: NodeIdMap.TXorNode): TokenPosition {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return xorNode.node.tokenRange.positionStart;

        case NodeIdMap.XorNodeKind.Context: {
            const contextNode: ParserContext.Node = xorNode.node;
            if (!contextNode.maybeTokenStart) {
                const details: {} = { nodeId: contextNode.nodeId };
                throw new CommonError.InvariantError(`contextNode.maybeTokenStart should be truthy`, details);
            }
            return contextNode.maybeTokenStart.positionStart;
        }

        default:
            throw isNever(xorNode);
    }
}

function isParentOfNodeKind(
    nodeIdMapCollection: NodeIdMap.Collection,
    childId: number,
    parentNodeKind: Ast.NodeKind,
): boolean {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentNodeId === undefined) {
        return false;
    }
    const parentNodeId: number = maybeParentNodeId;

    const maybeParentNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNode(nodeIdMapCollection, parentNodeId);
    if (maybeParentNode === undefined) {
        return false;
    }
    const parent: NodeIdMap.TXorNode = maybeParentNode;

    switch (parent.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return parent.node.kind === parentNodeKind;

        case NodeIdMap.XorNodeKind.Context:
            return parent.node.nodeKind === parentNodeKind;

        default:
            throw isNever(parent);
    }
}
