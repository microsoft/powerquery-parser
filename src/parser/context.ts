import { Option } from "../common";
import { Ast } from "./ast";

export namespace ParserContext {
    export interface State {
        readonly root: Node,
        readonly nodesById: Node[],
        nodeIdCounter: number,
    }

    export interface Node {
        readonly nodeId: number,
        readonly codeUnitStart: number,
        codeUnitEnd: number,
        parentId: number,
        childrenIds: number[],
        maybeAstNode: Option<Ast.TNode>,
    }

    export function empty(): State {
        const root: Node = {
            nodeId: 0,
            codeUnitStart: 0,
            codeUnitEnd: -1,
            parentId: -1,
            childrenIds: [],
            maybeAstNode: undefined,
        };

        return {
            root,
            nodesById: [root],
            nodeIdCounter: 0,
        }
    }

    // assumes parent is in state
    export function addChild(state: State, parent: Node, codeUnitStart: number): Node {
        state.nodeIdCounter += 1;

        const child: Node = {
            nodeId: state.nodeIdCounter,
            codeUnitStart,
            codeUnitEnd: -1,
            parentId: parent.nodeId,
            childrenIds: [],
            maybeAstNode: undefined,
        }

        state.nodesById[child.nodeId] = child;

        return child;
    }

    export function deepCopy(state: State): State {
        const nodesById: Node[] = state.nodesById.map(deepCopyNode);

        return {
            root: nodesById[0],
            nodesById,
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