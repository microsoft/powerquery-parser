// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option, Result, ResultKind } from ".";
import { Ast, NodeIdMap, ParserContext } from "../parser";

export type TriedTraverse<StateType> = Result<StateType, CommonError.CommonError>;

export type TVisitNodeFn<Node, State, StateType, Return> = (state: State & IState<StateType>, node: Node) => Return;

export type TVisitChildNodeFn<Node, State, StateType, Return> = (
    state: State & IState<StateType>,
    parent: Node,
    node: Node,
) => Return;

export type TEarlyExitFn<Node, State, StateType> = TVisitNodeFn<Node, State, StateType, boolean>;

export type TExpandNodesFn<Node, NodesById, State, StateType> = (
    state: State & IState<StateType>,
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
export function tryTraverseAst<State, StateType>(
    state: State & IState<StateType>,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: Ast.TNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Ast.TNode, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<Ast.TNode, NodeIdMap.Collection, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Ast.TNode, State, StateType>>,
): TriedTraverse<StateType> {
    return tryTraverse<Ast.TNode, NodeIdMap.Collection, State, StateType>(
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
export function tryTraverseXor<State, StateType>(
    state: State & IState<StateType>,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: NodeIdMap.TXorNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<NodeIdMap.TXorNode, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<NodeIdMap.TXorNode, NodeIdMap.Collection, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<NodeIdMap.TXorNode, State, StateType>>,
): TriedTraverse<StateType> {
    return tryTraverse<NodeIdMap.TXorNode, NodeIdMap.Collection, State, StateType>(
        state,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        maybeEarlyExitFn,
    );
}

export function tryTraverse<Node, NodesById, State, StateType>(
    state: State & IState<StateType>,
    nodesById: NodesById,
    root: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Node, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<Node, NodesById, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Node, State, StateType>>,
): TriedTraverse<StateType> {
    try {
        traverseRecursion<Node, NodesById, State, StateType>(
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
export function expectExpandAllAstChildren<State, StateType>(
    _state: State & IState<StateType>,
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
export function expectExpandAllXorChildren<State, StateType>(
    _state: State & IState<StateType>,
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

function traverseRecursion<Node, NodesById, State, StateType>(
    state: State & IState<StateType>,
    nodesById: NodesById,
    node: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Node, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<Node, NodesById, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Node, State, StateType>>,
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
