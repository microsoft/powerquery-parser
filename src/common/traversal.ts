// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option, Result, ResultKind } from ".";
import { Ast, NodeIdMap, ParserContext } from "../parser";

export type TriedTraverse<ResultType> = Result<ResultType, CommonError.CommonError>;

export type TVisitNodeFn<State, ResultType, Node, Return> = (state: State & IState<ResultType>, node: Node) => Return;

export type TVisitChildNodeFn<State, ResultType, Node, Return> = (
    state: State & IState<ResultType>,
    parent: Node,
    node: Node,
) => Return;

export type TEarlyExitFn<State, ResultType, Node> = TVisitNodeFn<State, ResultType, Node, boolean>;

export type TExpandNodesFn<State, ResultType, Node, NodesById> = (
    state: State & IState<ResultType>,
    node: Node,
    collection: NodesById,
) => ReadonlyArray<Node>;

export const enum VisitNodeStrategy {
    BreadthFirst = "BreadthFirst",
    DepthFirst = "DepthFirst",
}

export interface IState<T> {
    result: T;
}

// sets Node and NodesById for tryTraverse
export function tryTraverseAst<State, ResultType>(
    state: State & IState<ResultType>,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: Ast.TNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Ast.TNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Ast.TNode, NodeIdMap.Collection>,
    maybeEarlyExitFn: Option<TEarlyExitFn<State, ResultType, Ast.TNode>>,
): TriedTraverse<ResultType> {
    return tryTraverse<State, ResultType, Ast.TNode, NodeIdMap.Collection>(
        state,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        maybeEarlyExitFn,
    );
}

// sets Node and NodesById for tryTraverse
export function tryTraverseXor<State, ResultType>(
    state: State & IState<ResultType>,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: NodeIdMap.TXorNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, NodeIdMap.TXorNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, NodeIdMap.TXorNode, NodeIdMap.Collection>,
    maybeEarlyExitFn: Option<TEarlyExitFn<State, ResultType, NodeIdMap.TXorNode>>,
): TriedTraverse<ResultType> {
    return tryTraverse<State, ResultType, NodeIdMap.TXorNode, NodeIdMap.Collection>(
        state,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        maybeEarlyExitFn,
    );
}

export function tryTraverse<State, ResultType, Node, NodesById>(
    state: State & IState<ResultType>,
    nodesById: NodesById,
    root: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    maybeEarlyExitFn: Option<TEarlyExitFn<State, ResultType, Node>>,
): TriedTraverse<ResultType> {
    try {
        traverseRecursion<State, ResultType, Node, NodesById>(
            state,
            nodesById,
            root,
            strategy,
            visitNodeFn,
            expandNodesFn,
            maybeEarlyExitFn,
        );
        return {
            kind: ResultKind.Ok,
            value: state.result,
        };
    } catch (e) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(e),
        };
    }
}

// a TExpandNodesFn usable by tryTraverseAst which visits all nodes.
export function expectExpandAllAstChildren<State, ResultType>(
    _state: State & IState<ResultType>,
    astNode: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<Ast.TNode> {
    const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(astNode.id);

    if (maybeChildIds) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        return childIds.map(nodeId => NodeIdMap.expectAstNode(nodeIdMapCollection.astNodeById, nodeId));
    } else {
        return [];
    }
}

// a TExpandNodesFn usable by tryTraverseXor which visits all nodes.
export function expectExpandAllXorChildren<State, ResultType>(
    _state: State & IState<ResultType>,
    xorNode: NodeIdMap.TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<NodeIdMap.TXorNode> {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const astNode: Ast.TNode = xorNode.node;
            return expectExpandAllAstChildren(_state, astNode, nodeIdMapCollection).map(childAstNode => {
                return {
                    kind: NodeIdMap.XorNodeKind.Ast,
                    node: childAstNode,
                };
            });
        }
        case NodeIdMap.XorNodeKind.Context: {
            const result: NodeIdMap.TXorNode[] = [];
            const contextNode: ParserContext.Node = xorNode.node;
            const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(contextNode.id);

            if (maybeChildIds !== undefined) {
                const childIds: ReadonlyArray<number> = maybeChildIds;
                for (const childId of childIds) {
                    const maybeAstChild: Option<Ast.TNode> = nodeIdMapCollection.astNodeById.get(childId);
                    if (maybeAstChild) {
                        const astChild: Ast.TNode = maybeAstChild;
                        result.push({
                            kind: NodeIdMap.XorNodeKind.Ast,
                            node: astChild,
                        });
                        continue;
                    }

                    const maybeContextChild: Option<ParserContext.Node> = nodeIdMapCollection.contextNodeById.get(
                        childId,
                    );
                    if (maybeContextChild) {
                        const contextChild: ParserContext.Node = maybeContextChild;
                        result.push({
                            kind: NodeIdMap.XorNodeKind.Context,
                            node: contextChild,
                        });
                        continue;
                    }

                    const details: {} = { nodeId: childId };
                    throw new CommonError.InvariantError(
                        `nodeId should be found in either astNodesById or contextNodesById`,
                        details,
                    );
                }
            }

            return result;
        }
        default:
            throw isNever(xorNode);
    }
}

function traverseRecursion<State, ResultType, Node, NodesById>(
    state: State & IState<ResultType>,
    nodesById: NodesById,
    node: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    maybeEarlyExitFn: Option<TEarlyExitFn<State, ResultType, Node>>,
): void {
    if (maybeEarlyExitFn && maybeEarlyExitFn(state, node)) {
        return;
    } else if (strategy === VisitNodeStrategy.BreadthFirst) {
        visitNodeFn(state, node);
    }

    for (const child of expandNodesFn(state, node, nodesById)) {
        traverseRecursion(state, nodesById, child, strategy, visitNodeFn, expandNodesFn, maybeEarlyExitFn);
    }

    if (strategy === VisitNodeStrategy.DepthFirst) {
        visitNodeFn(state, node);
    }
}
