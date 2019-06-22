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

export interface DrilldownStep {
    readonly childIndex: number;
    readonly allowedChildAstNodeKinds: ReadonlyArray<Ast.NodeKind>;
}

export function expectAstNode(astNodeById: AstNodeById, nodeId: number): Ast.TNode {
    return expectInMap<Ast.TNode>(astNodeById, nodeId, "astNodeById");
}

export function expectContextNode(contextNodeById: ContextNodeById, nodeId: number): ParserContext.Node {
    return expectInMap<ParserContext.Node>(contextNodeById, nodeId, "contextNodeById");
}

export function expectAstChildNodes(nodeIdMapCollection: Collection, parentId: number): ReadonlyArray<Ast.TNode> {
    const childIds: ReadonlyArray<number> = expectChildIds(nodeIdMapCollection.childIdsById, parentId);
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    return childIds.map(childId => expectAstNode(astNodeById, childId));
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

// A single step drilldown.
export function maybeXorNodeChildAtIndex(
    nodeIdMapCollection: Collection,
    parentId: number,
    childIndex: number,
    childNodeKind: Ast.NodeKind,
): Option<TXorNode> {
    return maybeXorNodeChildIndexDrilldown(nodeIdMapCollection, parentId, [
        {
            childIndex,
            allowedChildAstNodeKinds: [childNodeKind],
        },
    ]);
}

// Drills down the root's children, and the child's children to find a given XorNode.
//
// If the childIndex in a DrilldownStep doesn't exist on a node (eg. 5 was given but the node only parsed 3 children),
// then undefined is returned.
//
// If a child exists at that index, but its Ast.NodeKind doesn't match DrilldownStep.allowedChildAstNodeKinds,
// then undefined is returned.
export function maybeXorNodeChildIndexDrilldown(
    nodeIdMapCollection: Collection,
    rootId: number,
    drilldown: ReadonlyArray<DrilldownStep>,
): Option<TXorNode> {
    const childIdsById: ChildIdsById = nodeIdMapCollection.childIdsById;

    let maybeChildIds: Option<ReadonlyArray<number>> = childIdsById.get(rootId);
    let maybeLatestChildXorNode: Option<TXorNode>;
    for (const step of drilldown) {
        const childIndex: number = step.childIndex;

        if (maybeChildIds === undefined) {
            return undefined;
        }
        const childIds: ReadonlyArray<number> = maybeChildIds;

        if (childIndex >= childIds.length) {
            return undefined;
        }

        const childAtIndex: TXorNode = expectXorNode(nodeIdMapCollection, childIds[childIndex]);
        if (step.allowedChildAstNodeKinds.indexOf(childAtIndex.node.kind) === -1) {
            return undefined;
        }

        maybeChildIds = childIdsById.get(childAtIndex.node.id);
        maybeLatestChildXorNode = childAtIndex;
    }

    return maybeLatestChildXorNode;
}

export function expectXorNode(nodeIdMapCollection: Collection, nodeId: number): TXorNode {
    const maybeNode: Option<TXorNode> = maybeXorNode(nodeIdMapCollection, nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't a astNode nor contextNode`, details);
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

export function deepCopyCollection(nodeIdMapCollection: Collection): Collection {
    const contextNodeById: ContextNodeById = new Map<number, ParserContext.Node>();
    nodeIdMapCollection.contextNodeById.forEach((value: ParserContext.Node, key: number) => {
        contextNodeById.set(key, { ...value });
    });
    return {
        astNodeById: new Map(nodeIdMapCollection.astNodeById.entries()),
        contextNodeById: contextNodeById,
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
