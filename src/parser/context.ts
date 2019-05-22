// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Option, CommonError } from "../common";
import { Ast } from "./ast";

export namespace ParserContext {

    export type NodeMap = Map<number, Node>;

    export interface State {
        readonly root: Node,
        readonly nodesById: NodeMap,
        terminalNodeIds: number[],
        nodeIdCounter: number,
    }

    export interface Node {
        readonly nodeId: number,
        readonly codeUnitStart: number,
        readonly parentId: number,
        childNodeIds: number[],
        maybeAstNode: Option<Ast.TNode>,
    }

    export function empty(): State {
        const root: Node = {
            nodeId: 0,
            codeUnitStart: 0,
            parentId: -1,
            childNodeIds: [],
            maybeAstNode: undefined,
        };

        return {
            root,
            nodesById: new Map<number, Node>([[0, root]]),
            terminalNodeIds: [],
            nodeIdCounter: 0,
        }
    }

    // assumes parent is in state
    export function addChild(state: State, parent: Node, codeUnitStart: number): Node {
        state.nodeIdCounter += 1;

        const child: Node = {
            nodeId: state.nodeIdCounter,
            codeUnitStart,
            parentId: parent.nodeId,
            childNodeIds: [],
            maybeAstNode: undefined,
        }

        state.nodesById.set(child.nodeId, child);

        return child;
    }

    export function endContext(
        state: State,
        oldNode: Node,
        astNode: Ast.TNode,
    ): Node {
        const parentId: number = oldNode.parentId;
        if (parentId < 0) {
            throw new CommonError.InvariantError(`parentId < 0: ${parentId}.`);
        }

        if (astNode.terminalNode) {
            state.terminalNodeIds.push(oldNode.nodeId);
        }

        oldNode.maybeAstNode = astNode;
        return expectNode(state.nodesById, parentId);
    }

    export function deleteContext(
        state: State,
        node: Node,
    ): Node {
        const nodesById: NodeMap = state.nodesById;
        const terminalNodeIds: number[] = state.terminalNodeIds;

        const parentId: number = node.parentId;
        const nodeId: number = node.nodeId;

        if (!nodesById.has(nodeId)) {
            throw new CommonError.InvariantError(`node.nodeId not in state: ${nodeId}.`);
        }
        nodesById.delete(nodeId);

        const maybeTerminalIndex = terminalNodeIds.indexOf(nodeId);
        if (maybeTerminalIndex) {
            const terminalIndex: number = maybeTerminalIndex;
            state.terminalNodeIds = [
                ...terminalNodeIds.slice(0, terminalIndex),
                ...terminalNodeIds.slice(terminalIndex + 1),
            ]
        }

        if (parentId === -1) {
            throw new CommonError.InvariantError(`cannot delete root context.`);
        }

        const parent: Node = expectNode(state.nodesById, parentId);
        const childNodeIds: number[] = parent.childNodeIds;
        const childNodeIndex: number = childNodeIds.indexOf(nodeId);

        if (childNodeIndex === -1) {
            throw new CommonError.InvariantError(`nodeId ${nodeId} considers ${parentId} to be a parent, but isn't listed as a child of the parent.`)
        }

        parent.childNodeIds = [
            ...childNodeIds.slice(0, childNodeIndex),
            ...childNodeIds.slice(childNodeIndex + 1),
        ];

        return parent;
    }

    export function deepCopy(state: State): State {
        const nodesById: NodeMap = new Map<number, Node>();
        state.nodesById.forEach((value: Node, key: number) => {
            nodesById.set(key, deepCopyNode(value));
        });

        return {
            root: expectNode(nodesById, 0),
            nodesById: nodesById,
            terminalNodeIds: state.terminalNodeIds.slice(),
            nodeIdCounter: state.nodeIdCounter,
        }
    }

    function deepCopyNode(node: Node): Node {
        return {
            ...node,
            maybeAstNode: node.maybeAstNode !== undefined
                ? { ...node.maybeAstNode }
                : undefined
        }
    }

    function expectNode(nodesById: NodeMap, nodeId: number): Node {
        const maybeNode: Option<Node> = nodesById.get(nodeId);
        if (maybeNode === undefined) {
            throw new CommonError.InvariantError(`nodeId (${nodeId}) wasn't in State.`);
        }
        const node: Node = maybeNode;

        return node;
    }
}