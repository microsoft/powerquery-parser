// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, isNever, Option, Result, ResultKind } from ".";
import { Ast, NodeIdMap, ParserContext } from "../parser";

export type TriedTraverse<StateType> = Result<StateType, CommonError.CommonError>;

// ParserContext keeps track of parent and children through a nodeId number,
// it does not directly map to the parent/children instances as their change over time from
// ParserContext.Node to Ast.TNode.
// TXorNode adds the typing needed for traversal.
export type TXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode> | IXorNode<XorNodeKind.Context, ParserContext.Node>;

export type TVisitNodeFn<Node, State, StateType, Return> = (node: Node, state: State & IState<StateType>) => Return;

export type TVisitChildNodeFn<Node, State, StateType, Return> = (
    parent: Node,
    node: Node,
    state: State & IState<StateType>,
) => Return;

export type TEarlyExitFn<Node, State, StateType> = TVisitNodeFn<Node, State, StateType, boolean>;

export type TExpandNodesFn<Node, NodesById, State, StateType> = (
    state: State & IState<StateType>,
    node: Node,
    collection: NodesById,
) => ReadonlyArray<Node>;

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export const enum VisitNodeStrategy {
    BreadthFirst = "BreadthFirst",
    DepthFirst = "DepthFirst",
}

export interface IState<T> {
    result: T;
}

export interface IXorNode<Kind, T> {
    readonly kind: Kind & XorNodeKind;
    readonly node: T;
}

export function tryTraverseAst<State, StateType>(
    root: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    state: State & IState<StateType>,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Ast.TNode, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<Ast.TNode, NodeIdMap.Collection, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Ast.TNode, State, StateType>>,
): Result<StateType, CommonError.CommonError> {
    try {
        uncheckedTraverse<Ast.TNode, NodeIdMap.Collection, State, StateType>(
            root,
            nodeIdMapCollection,
            state,
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

export function tryTraverseXor<State, StateType>(
    root: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    state: State & IState<StateType>,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<TXorNode, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<TXorNode, NodeIdMap.Collection, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<TXorNode, State, StateType>>,
): Result<StateType, CommonError.CommonError> {
    try {
        uncheckedTraverse<TXorNode, NodeIdMap.Collection, State, StateType>(
            root,
            nodeIdMapCollection,
            state,
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

// Errors are uncaught. Catch them yourself as needed.
export function uncheckedTraverse<Node, NodesById, State, StateType>(
    node: Node,
    nodesById: NodesById,
    state: State & IState<StateType>,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Node, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<Node, NodesById, State, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Node, State, StateType>>,
): void {
    if (maybeEarlyExitFn && maybeEarlyExitFn(node, state)) {
        return;
    } else if (strategy === VisitNodeStrategy.BreadthFirst) {
        visitNodeFn(node, state);
    }

    for (const child of expandNodesFn(state, node, nodesById)) {
        uncheckedTraverse(child, nodesById, state, strategy, visitNodeFn, expandNodesFn, maybeEarlyExitFn);
    }

    if (strategy === VisitNodeStrategy.DepthFirst) {
        visitNodeFn(node, state);
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
    xorNode: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<TXorNode> {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const astNode: Ast.TNode = xorNode.node;
            return expectExpandAllAstChildren(_state, astNode, nodeIdMapCollection).map(childAstNode => {
                return {
                    kind: XorNodeKind.Ast,
                    node: childAstNode,
                };
            });
        }
        case XorNodeKind.Context: {
            const result: TXorNode[] = [];
            const contextNode: ParserContext.Node = xorNode.node;
            const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(
                contextNode.nodeId,
            );

            if (maybeChildIds !== undefined) {
                const childIds: ReadonlyArray<number> = maybeChildIds;
                for (const childId of childIds) {
                    const maybeAstChild: Option<Ast.TNode> = nodeIdMapCollection.astNodeById.get(childId);
                    if (maybeAstChild) {
                        result.push({
                            kind: XorNodeKind.Ast,
                            node: maybeAstChild,
                        });
                        continue;
                    }

                    const maybeContextChild: Option<ParserContext.Node> = nodeIdMapCollection.contextNodeById.get(
                        childId,
                    );
                    if (maybeContextChild) {
                        result.push({
                            kind: XorNodeKind.Context,
                            node: maybeContextChild,
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
