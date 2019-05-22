// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Option, CommonError } from "../common";
import { Ast } from "./ast";

export namespace ParserContext {
    export interface State {
        readonly root: Node,
        readonly nodesById: Node[],
        readonly terminalNodeIds: number[],
        nodeIdCounter: number,
    }

    export interface Node {
        readonly nodeId: number,
        readonly codeUnitStart: number,
        readonly parentId: number,
        readonly childNodeIds: number[],
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
            nodesById: [root],
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

        state.nodesById[child.nodeId] = child;

        return child;
    }

    export function endContext(
        state: State,
        oldNode: Node,
        astNode: Ast.TNode,
    ): Node {
        const parentId: number = oldNode.parentId;
        if (parentId < 0) {
            throw new CommonError.InvariantError("AssertFailed: parentId >= 0");
        }

        if (astNode.terminalNode) {
            state.terminalNodeIds.push(oldNode.nodeId);
        }

        oldNode.maybeAstNode = astNode;
        return state.nodesById[parentId];
    }

    export function deepCopy(state: State): State {
        const nodesById: Node[] = state.nodesById.map(deepCopyNode);

        return {
            root: nodesById[0],
            nodesById: state.nodesById.slice(),
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
}