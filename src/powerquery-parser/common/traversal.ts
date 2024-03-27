// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from ".";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../parser";
import { Ast } from "../language";
import { ResultUtils } from "./result";
import { Settings } from "..";
import { Trace } from "./trace";

export type TriedTraverse<ResultType> = Result<ResultType, CommonError.CommonError>;

export type TVisitNodeFn<State extends ITraversalState<ResultType>, ResultType, Node, Return> = (
    state: State,
    node: Node,
    correlationId: number | undefined,
) => Promise<Return>;

export type TEarlyExitFn<State extends ITraversalState<ResultType>, ResultType, Node> = TVisitNodeFn<
    State,
    ResultType,
    Node,
    boolean
>;

export type TExpandNodesFn<State extends ITraversalState<ResultType>, ResultType, Node, NodesById> = (
    state: State,
    node: Node,
    collection: NodesById,
) => Promise<ReadonlyArray<Node>>;

export enum VisitNodeStrategy {
    BreadthFirst = "BreadthFirst",
    DepthFirst = "DepthFirst",
}

export interface ITraversalState<T> extends Pick<Settings, "locale" | "cancellationToken" | "traceManager"> {
    readonly initialCorrelationId: number | undefined;
    result: T;
}

// Most commonly used by visiting all nodes (either Ast or TXorNode) with the visitNodeFn,
// It usually expands all children nodes but can expand the list of nodes to visit through other logic.
export function tryTraverse<State extends ITraversalState<ResultType>, ResultType, Node, NodesById>(
    state: State,
    nodesById: NodesById,
    root: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    earlyExitFn: TEarlyExitFn<State, ResultType, Node> | undefined,
): Promise<TriedTraverse<ResultType>> {
    return ResultUtils.ensureResultAsync(async () => {
        await traverseRecursion<State, ResultType, Node, NodesById>(
            state,
            nodesById,
            root,
            strategy,
            visitNodeFn,
            expandNodesFn,
            earlyExitFn,
            state.initialCorrelationId,
        );

        return state.result;
    }, state.locale);
}

// sets the tryTraverse type parameters: Node and NodesById
export function tryTraverseAst<State extends ITraversalState<ResultType>, ResultType>(
    state: State,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: Ast.TNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Ast.TNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Ast.TNode, NodeIdMap.Collection>,
    earlyExitFn: TEarlyExitFn<State, ResultType, Ast.TNode> | undefined,
): Promise<TriedTraverse<ResultType>> {
    return tryTraverse<State, ResultType, Ast.TNode, NodeIdMap.Collection>(
        state,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        earlyExitFn,
    );
}

// sets the tryTraverse type parameters: Node and NodesById
export function tryTraverseXor<State extends ITraversalState<ResultType>, ResultType>(
    state: State,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: TXorNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, TXorNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, TXorNode, NodeIdMap.Collection>,
    earlyExitFn: TEarlyExitFn<State, ResultType, TXorNode> | undefined,
): Promise<TriedTraverse<ResultType>> {
    return tryTraverse<State, ResultType, TXorNode, NodeIdMap.Collection>(
        state,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        earlyExitFn,
    );
}

// a TExpandNodesFn usable by tryTraverseAst which visits all Ast nodes.
// eslint-disable-next-line require-await
export async function assertGetAllAstChildren<State extends ITraversalState<ResultType>, ResultType>(
    _state: State,
    astNode: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<ReadonlyArray<Ast.TNode>> {
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(astNode.id);

    return childIds ? childIds.map((nodeId: number) => NodeIdMapUtils.assertAst(nodeIdMapCollection, nodeId)) : [];
}

// a TExpandNodesFn usable by tryTraverseXor which visits all nodes.
// eslint-disable-next-line require-await
export async function assertGetAllXorChildren<State extends ITraversalState<ResultType>, ResultType>(
    _state: State,
    xorNode: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<ReadonlyArray<TXorNode>> {
    return NodeIdMapIterator.assertIterChildrenXor(nodeIdMapCollection, xorNode.node.id);
}

// Returns the TXorNode's parent if one exists.
export function expandXorParent<T>(
    _state: T,
    xorNode: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<ReadonlyArray<TXorNode>> {
    const parent: TXorNode | undefined = NodeIdMapUtils.parentXor(nodeIdMapCollection, xorNode.node.id);

    return Promise.resolve(parent !== undefined ? [parent] : []);
}

const enum TraversalTraceConstant {
    Traversal = "Traversal",
}

// The core logic of a traversal.
async function traverseRecursion<State extends ITraversalState<ResultType>, ResultType, Node, NodesById>(
    state: State,
    nodesById: NodesById,
    node: Node,
    strategy: VisitNodeStrategy,
    visitNode: TVisitNodeFn<State, ResultType, Node, void>,
    visitOrderQueue: TExpandNodesFn<State, ResultType, Node, NodesById>,
    isEarlyExit: TEarlyExitFn<State, ResultType, Node> | undefined,
    correlationId: number | undefined,
): Promise<void> {
    const trace: Trace = state.traceManager.entry(
        TraversalTraceConstant.Traversal,
        traverseRecursion.name,
        correlationId,
    );

    state.cancellationToken?.throwIfCancelled();

    if (isEarlyExit && (await isEarlyExit(state, node, trace.id))) {
        return;
    } else if (strategy === VisitNodeStrategy.BreadthFirst) {
        await visitNode(state, node, trace.id);
    }

    for (const child of await visitOrderQueue(state, node, nodesById)) {
        // eslint-disable-next-line no-await-in-loop
        await traverseRecursion(state, nodesById, child, strategy, visitNode, visitOrderQueue, isEarlyExit, trace.id);
    }

    if (strategy === VisitNodeStrategy.DepthFirst) {
        await visitNode(state, node, trace.id);
    }

    trace.exit();
}
