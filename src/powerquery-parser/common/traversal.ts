// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, Result } from ".";
import { NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind, XorNodeUtils } from "../parser";
import { Ast } from "../language";
import { ResultUtils } from "./result";
import { Settings } from "..";
import { Trace } from "./trace";

export type TriedTraverse<ResultType> = Result<ResultType, CommonError.CommonError>;

export type TVisitNodeFn<State extends ITraversalState<ResultType>, ResultType, Node, Return> = (
    state: State,
    node: Node,
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

export const enum VisitNodeStrategy {
    BreadthFirst = "BreadthFirst",
    DepthFirst = "DepthFirst",
}

export interface ITraversalState<T> extends Pick<Settings, "locale" | "maybeCancellationToken" | "traceManager"> {
    result: T;
}

// sets Node and NodesById for tryTraverse
export function tryTraverseAst<State extends ITraversalState<ResultType>, ResultType>(
    state: State,
    maybeCorrelationId: number | undefined,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: Ast.TNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Ast.TNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Ast.TNode, NodeIdMap.Collection>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, Ast.TNode> | undefined,
): Promise<TriedTraverse<ResultType>> {
    return tryTraverse<State, ResultType, Ast.TNode, NodeIdMap.Collection>(
        state,
        maybeCorrelationId,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        maybeEarlyExitFn,
    );
}

// sets Node and NodesById for tryTraverse
export function tryTraverseXor<State extends ITraversalState<ResultType>, ResultType>(
    state: State,
    maybeCorrelationId: number | undefined,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: TXorNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, TXorNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, TXorNode, NodeIdMap.Collection>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, TXorNode> | undefined,
): Promise<TriedTraverse<ResultType>> {
    return tryTraverse<State, ResultType, TXorNode, NodeIdMap.Collection>(
        state,
        maybeCorrelationId,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        maybeEarlyExitFn,
    );
}

export function tryTraverse<State extends ITraversalState<ResultType>, ResultType, Node, NodesById>(
    state: State,
    maybeCorrelationId: number | undefined,
    nodesById: NodesById,
    root: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, Node> | undefined,
): Promise<TriedTraverse<ResultType>> {
    return ResultUtils.ensureResultAsync(state.locale, async () => {
        await traverseRecursion<State, ResultType, Node, NodesById>(
            state,
            maybeCorrelationId,
            nodesById,
            root,
            strategy,
            visitNodeFn,
            expandNodesFn,
            maybeEarlyExitFn,
        );

        return state.result;
    });
}

// a TExpandNodesFn usable by tryTraverseAst which visits all nodes.
// eslint-disable-next-line require-await
export async function assertGetAllAstChildren<State extends ITraversalState<ResultType>, ResultType>(
    _state: State,
    astNode: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<ReadonlyArray<Ast.TNode>> {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(astNode.id);

    if (maybeChildIds) {
        const childIds: ReadonlyArray<number> = maybeChildIds;

        return childIds.map((nodeId: number) => NodeIdMapUtils.assertUnboxAst(nodeIdMapCollection.astNodeById, nodeId));
    } else {
        return [];
    }
}

// a TExpandNodesFn usable by tryTraverseXor which visits all nodes.
// eslint-disable-next-line require-await
export async function assertGetAllXorChildren<State extends ITraversalState<ResultType>, ResultType>(
    _state: State,
    xorNode: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<ReadonlyArray<TXorNode>> {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const astNode: Ast.TNode = xorNode.node;

            const children: ReadonlyArray<Ast.TNode> = await assertGetAllAstChildren(
                _state,
                astNode,
                nodeIdMapCollection,
            );

            return ArrayUtils.mapAsync(children, (value: Ast.TNode) => Promise.resolve(XorNodeUtils.boxAst(value)));
        }

        case XorNodeKind.Context: {
            const result: TXorNode[] = [];
            const contextNode: ParseContext.TNode = xorNode.node;

            const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(
                contextNode.id,
            );

            if (maybeChildIds !== undefined) {
                const childIds: ReadonlyArray<number> = maybeChildIds;

                for (const childId of childIds) {
                    result.push(NodeIdMapUtils.assertGetXor(nodeIdMapCollection, childId));
                }
            }

            return result;
        }

        default:
            throw Assert.isNever(xorNode);
    }
}

// Returns the TXorNode's parent if one exists.
export function maybeExpandXorParent<T>(
    _state: T,
    xorNode: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<ReadonlyArray<TXorNode>> {
    const maybeParent: TXorNode | undefined = NodeIdMapUtils.maybeParentXor(nodeIdMapCollection, xorNode.node.id);

    return Promise.resolve(maybeParent !== undefined ? [maybeParent] : []);
}

async function traverseRecursion<State extends ITraversalState<ResultType>, ResultType, Node, NodesById>(
    state: State,
    maybeCorrelationId: number | undefined,
    nodesById: NodesById,
    node: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, Node> | undefined,
): Promise<void> {
    const trace: Trace = state.traceManager.entry(maybeCorrelationId, "Traversal", traverseRecursion.name);
    state.maybeCancellationToken?.throwIfCancelled();

    if (maybeEarlyExitFn && (await maybeEarlyExitFn(state, node))) {
        return;
    } else if (strategy === VisitNodeStrategy.BreadthFirst) {
        await visitNodeFn(state, node);
    }

    for (const child of await expandNodesFn(state, node, nodesById)) {
        // eslint-disable-next-line no-await-in-loop
        await traverseRecursion(
            state,
            trace.id,
            nodesById,
            child,
            strategy,
            visitNodeFn,
            expandNodesFn,
            maybeEarlyExitFn,
        );
    }

    if (strategy === VisitNodeStrategy.DepthFirst) {
        await visitNodeFn(state, node);
    }

    trace.exit();
}
