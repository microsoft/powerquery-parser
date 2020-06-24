// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result } from ".";
import { Ast } from "../language";
import { ILocalizationTemplates } from "../localization";
import { NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../parser";
import { ResultUtils } from "./result";

export type TriedTraverse<ResultType> = Result<ResultType, CommonError.CommonError>;

export type TVisitNodeFn<State extends IState<ResultType>, ResultType, Node, Return> = (
    state: State,
    node: Node,
) => Return;

export type TVisitChildNodeFn<State extends IState<ResultType>, ResultType, Node, Return> = (
    state: State,
    parent: Node,
    node: Node,
) => Return;

export type TEarlyExitFn<State extends IState<ResultType>, ResultType, Node> = TVisitNodeFn<
    State,
    ResultType,
    Node,
    boolean
>;

export type TExpandNodesFn<State extends IState<ResultType>, ResultType, Node, NodesById> = (
    state: State,
    node: Node,
    collection: NodesById,
) => ReadonlyArray<Node>;

export const enum VisitNodeStrategy {
    BreadthFirst = "BreadthFirst",
    DepthFirst = "DepthFirst",
}

export interface IState<T> {
    readonly localizationTemplates: ILocalizationTemplates;
    result: T;
}

// sets Node and NodesById for tryTraverse
export function tryTraverseAst<State extends IState<ResultType>, ResultType>(
    state: State,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: Ast.TNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Ast.TNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Ast.TNode, NodeIdMap.Collection>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, Ast.TNode> | undefined,
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
export function tryTraverseXor<State extends IState<ResultType>, ResultType>(
    state: State,
    nodeIdMapCollection: NodeIdMap.Collection,
    root: TXorNode,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, TXorNode, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, TXorNode, NodeIdMap.Collection>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, TXorNode> | undefined,
): TriedTraverse<ResultType> {
    return tryTraverse<State, ResultType, TXorNode, NodeIdMap.Collection>(
        state,
        nodeIdMapCollection,
        root,
        strategy,
        visitNodeFn,
        expandNodesFn,
        maybeEarlyExitFn,
    );
}

export function tryTraverse<State extends IState<ResultType>, ResultType, Node, NodesById>(
    state: State,
    nodesById: NodesById,
    root: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, Node> | undefined,
): TriedTraverse<ResultType> {
    return ResultUtils.ensureResult(state.localizationTemplates, () => {
        traverseRecursion<State, ResultType, Node, NodesById>(
            state,
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
export function expectExpandAllAstChildren<State extends IState<ResultType>, ResultType>(
    _state: State,
    astNode: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<Ast.TNode> {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(astNode.id);

    if (maybeChildIds) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        return childIds.map(nodeId => NodeIdMapUtils.expectAstNode(nodeIdMapCollection.astNodeById, nodeId));
    } else {
        return [];
    }
}

// a TExpandNodesFn usable by tryTraverseXor which visits all nodes.
export function expectExpandAllXorChildren<State extends IState<ResultType>, ResultType>(
    _state: State,
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
            const contextNode: ParseContext.Node = xorNode.node;
            const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(
                contextNode.id,
            );

            if (maybeChildIds !== undefined) {
                const childIds: ReadonlyArray<number> = maybeChildIds;
                for (const childId of childIds) {
                    const maybeAstChild: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(childId);
                    if (maybeAstChild) {
                        const astChild: Ast.TNode = maybeAstChild;
                        result.push({
                            kind: XorNodeKind.Ast,
                            node: astChild,
                        });
                        continue;
                    }

                    const maybeContextChild: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(
                        childId,
                    );
                    if (maybeContextChild) {
                        const contextChild: ParseContext.Node = maybeContextChild;
                        result.push({
                            kind: XorNodeKind.Context,
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
            throw Assert.isNever(xorNode);
    }
}

// Returns the TXorNode's parent if one exists.
export function maybeExpandXorParent<T>(
    _state: T,
    xorNode: TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<TXorNode> {
    const maybeParent: TXorNode | undefined = NodeIdMapUtils.maybeParentXorNode(nodeIdMapCollection, xorNode.node.id);
    return maybeParent !== undefined ? [maybeParent] : [];
}

function traverseRecursion<State extends IState<ResultType>, ResultType, Node, NodesById>(
    state: State,
    nodesById: NodesById,
    node: Node,
    strategy: VisitNodeStrategy,
    visitNodeFn: TVisitNodeFn<State, ResultType, Node, void>,
    expandNodesFn: TExpandNodesFn<State, ResultType, Node, NodesById>,
    maybeEarlyExitFn: TEarlyExitFn<State, ResultType, Node> | undefined,
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
