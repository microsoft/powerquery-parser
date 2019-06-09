// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError } from ".";
import { Ast, ParserContext } from "../parser";
import { isNever } from "./assert";
import { Option } from "./option";
import { Result, ResultKind } from "./result";

export const enum XorNodeKind {
    Ast = "Ast",
    Context = "Context",
}

export const enum VisitNodeStrategy {
    BreadthFirst = "BreadthFirst",
    DepthFirst = "DepthFirst",
}

export type TXorNode = IXorNode<XorNodeKind.Ast, Ast.TNode> | IXorNode<XorNodeKind.Context, ParserContext.Node>;

export type TVisitNodeFn<Node, State, StateType, Return> = (node: Node, state: State & IState<StateType>) => Return;
export type TVisitChildNodeFn<Node, State, StateType, Return> = (
    parent: Node,
    node: Node,
    state: State & IState<StateType>,
) => Return;
export type TEarlyExitFn<Node, State, StateType> = TVisitNodeFn<Node, State, StateType, boolean>;
export type TExpandNodesFn<Node, NodesById, StateType> = (
    state: IState<StateType>,
    node: Node,
    collection: NodesById,
) => ReadonlyArray<Node>;

export interface IState<T> {
    result: T;
}

export interface IXorNode<Kind, T> {
    readonly kind: Kind & XorNodeKind;
    readonly node: T;
}

export function tryTraverseAst<State, StateType>(
    root: Ast.TNode,
    nodeIdMaps: ParserContext.NodeIdMaps,
    state: State & IState<StateType>,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Ast.TNode, State, StateType, void>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Ast.TNode, State, StateType>>,
): Result<StateType, CommonError.CommonError> {
    try {
        traverse<Ast.TNode, ParserContext.NodeIdMaps, State, StateType>(
            root,
            nodeIdMaps,
            state,
            strategy,
            visitNodeFn,
            expectAllAstChildren,
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
    nodeIdMaps: ParserContext.NodeIdMaps,
    state: State & IState<StateType>,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<TXorNode, State, StateType, void>,
    maybeEarlyExitFn: Option<TEarlyExitFn<TXorNode, State, StateType>>,
): Result<StateType, CommonError.CommonError> {
    try {
        traverse<TXorNode, ParserContext.NodeIdMaps, State, StateType>(
            root,
            nodeIdMaps,
            state,
            strategy,
            visitNodeFn,
            expectAllXorChildren,
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

export function traverse<Node, NodesById, State, StateType>(
    node: Node,
    nodesById: NodesById,
    state: State & IState<StateType>,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<Node, State, StateType, void>,
    expandNodesFn: TExpandNodesFn<Node, NodesById, StateType>,
    maybeEarlyExitFn: Option<TEarlyExitFn<Node, State, StateType>>,
): void {
    if (maybeEarlyExitFn && maybeEarlyExitFn(node, state)) {
        return;
    } else if (strategy === VisitNodeStrategy.BreadthFirst) {
        visitNodeFn(node, state);
    }

    for (const child of expandNodesFn(state, node, nodesById)) {
        traverse(child, nodesById, state, strategy, visitNodeFn, expandNodesFn, maybeEarlyExitFn);
    }

    if (strategy === VisitNodeStrategy.DepthFirst) {
        visitNodeFn(node, state);
    }
}

export function expectAllAstChildren<State, StateType>(
    _state: State & IState<StateType>,
    astNode: Ast.TNode,
    nodeIdMaps: ParserContext.NodeIdMaps,
): ReadonlyArray<Ast.TNode> {
    const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMaps.childIdsById.get(astNode.id);

    if (maybeChildIds) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        return childIds.map(nodeId => ParserContext.expectAstNode(nodeIdMaps.astNodeById, nodeId));
    } else {
        return [];
    }
}

export function expectAllXorChildren<State, StateType>(
    _state: State & IState<StateType>,
    xorNode: TXorNode,
    nodeIdMaps: ParserContext.NodeIdMaps,
): ReadonlyArray<TXorNode> {
    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            const astNode: Ast.TNode = xorNode.node;
            return expectAllAstChildren(_state, astNode, nodeIdMaps).map(childAstNode => {
                return {
                    kind: XorNodeKind.Ast,
                    node: childAstNode,
                };
            });
        }
        case XorNodeKind.Context: {
            const result: TXorNode[] = [];
            const contextNode: ParserContext.Node = xorNode.node;
            const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMaps.childIdsById.get(contextNode.nodeId);

            if (maybeChildIds !== undefined) {
                const childIds: ReadonlyArray<number> = maybeChildIds;
                for (const childId of childIds) {
                    const maybeAstChild: Option<Ast.TNode> = nodeIdMaps.astNodeById.get(childId);
                    if (maybeAstChild) {
                        result.push({
                            kind: XorNodeKind.Ast,
                            node: maybeAstChild,
                        });
                        continue;
                    }

                    const maybeContextChild: Option<ParserContext.Node> = nodeIdMaps.contextNodeById.get(childId);
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
