// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option, Traverse } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";

export const enum NodeKind {
    Each = "EachExpression",
    List = "List",
    Record = "Record",
}

export interface State extends Traverse.IState<Inspected> {
    maybePreviousXorNode: Option<NodeIdMap.TXorNode>;
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export interface Inspected {
    readonly nodes: INode[];
    readonly scope: Map<string, NodeIdMap.TXorNode>;
}

export interface INode {
    readonly kind: NodeKind;
    readonly maybePositionStart: Option<TokenPosition>;
    readonly maybePositionEnd: Option<TokenPosition>;
}

export interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

export interface Record extends INode {
    readonly kind: NodeKind.Record;
}

export interface Each extends INode {
    readonly kind: NodeKind.Each;
}

export function isParentOfNodeKind(
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
            return parent.node.kind === parentNodeKind;

        default:
            throw isNever(parent);
    }
}

export function isInTokenRange(position: Position, tokenRange: Ast.TokenRange): boolean {
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

export function isTokenPositionOnPosition(tokenPosition: TokenPosition, position: Position): boolean {
    return position.lineNumber !== tokenPosition.lineNumber && position.lineCodeUnit !== tokenPosition.lineCodeUnit;
}

export function addToScopeIfNew(state: State, key: string, xorNode: NodeIdMap.TXorNode): void {
    const scopeMap: Map<string, NodeIdMap.TXorNode> = state.result.scope;
    if (!scopeMap.has(key)) {
        scopeMap.set(key, xorNode);
    }
}

export function isTokenPositionBeforePostiion(tokenPosition: TokenPosition, position: Position): boolean {
    return (
        tokenPosition.lineNumber < position.lineNumber ||
        (tokenPosition.lineNumber === position.lineNumber && tokenPosition.lineCodeUnit < position.lineCodeUnit)
    );
}

// Same as TCsvArray.elements.map(csv => csv.node), plus TXorNode handling.
export function csvArrayChildrenXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    root: NodeIdMap.TXorNode,
): ReadonlyArray<NodeIdMap.TXorNode> {
    switch (root.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            if (root.node.kind !== Ast.NodeKind.CsvArray) {
                const details: {} = { root };
                throw new CommonError.InvariantError(
                    `root must have a Ast.NodeKind of ${Ast.NodeKind.CsvArray}`,
                    details,
                );
            }

            return root.node.elements.map(csv => {
                return {
                    kind: NodeIdMap.XorNodeKind.Ast,
                    node: csv.node,
                };
            });

        case NodeIdMap.XorNodeKind.Context: {
            if (root.node.kind !== Ast.NodeKind.CsvArray) {
                const details: {} = { root };
                throw new CommonError.InvariantError(
                    `root must have a Ast.NodeKind of ${Ast.NodeKind.CsvArray}`,
                    details,
                );
            }
            const csvArrayContextNode: ParserContext.Node = root.node;

            const result: NodeIdMap.TXorNode[] = [];

            const maybeCsvArrayChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(
                csvArrayContextNode.id,
            );
            if (maybeCsvArrayChildIds !== undefined) {
                const csvArrayChildIds: ReadonlyArray<number> = maybeCsvArrayChildIds;

                for (const csvId of csvArrayChildIds) {
                    const maybeCsvChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(csvId);
                    if (maybeCsvChildIds !== undefined) {
                        const csvChildIds: ReadonlyArray<number> = maybeCsvChildIds;
                        result.push(NodeIdMap.expectXorNode(nodeIdMapCollection, csvChildIds[0]));
                    }
                }
            }

            return result;
        }

        default:
            throw isNever(root);
    }
}
