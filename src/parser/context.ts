import { Option } from "../common";
import { Ast } from "./ast";

export namespace ParserContext {
    export interface State {
        readonly root: Node,
        readonly nodesById: { [nodeId: number]: Node; },
        nodeIdCounter: number,
    }

    export interface Node {
        readonly nodeId: number,
        readonly codeUnitStart: number,
        maybeCodeUnitEnd: Option<number>,
        maybeParentId: Option<number>,
        childrenIds: number[],
        maybeAstNode: Option<Ast.TNode>,
    }

    export function empty(): State {
        const root: Node = {
            nodeId: 0,
            codeUnitStart: 0,
            maybeCodeUnitEnd: undefined,
            maybeParentId: undefined,
            childrenIds: [],
            maybeAstNode: undefined,
        };

        return {
            root,
            nodesById: {0: root},
            nodeIdCounter: 0,
        }
    }

    // assumes parent is in state
    export function addNode(state: State, parent: Node, codeUnitStart: number): Node {
        state.nodeIdCounter += 1;

        const child: Node = {
            nodeId: state.nodeIdCounter,
            codeUnitStart,
            maybeCodeUnitEnd: undefined,
            maybeParentId: parent.nodeId,
            childrenIds: [],
            maybeAstNode: undefined,
        }

        state.nodesById[child.nodeId] = child;

        return child;
    }
}