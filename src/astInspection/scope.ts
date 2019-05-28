import { CommonError, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, TokenRange } from "../parser";

/* tslint:disable */

interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

interface State {
    scope: string[];
    isIdentifier: boolean;
    isLeftHandAssignment: boolean;
    inRecord: boolean;
    inEach: boolean;
    inFunction: boolean;
    tokenRange: TokenRange;
}

function inspectAstNode(state: State, node: Ast.TNode, nodesById: Map<number, Ast.TNode>) {
    let maybeNode: Option<Ast.TNode> = node;

    while (maybeNode) {
        const node: Ast.TNode = maybeNode;

        switch (node.kind) {
            case Ast.NodeKind.EachExpression:
                if (!state.inEach) {
                    state.scope.push("_");
                }
                state.inEach = true;
                break;

            case Ast.NodeKind.GeneralizedIdentifier:
                state.scope.push(node.literal);
                break;

            case Ast.NodeKind.Identifier:
                state.scope.push(node.literal);
                break;
        }

        if (node.maybeParentId === undefined) {
            maybeNode = undefined;
        }
        else {
            const parentId: number = node.maybeParentId;
            maybeNode = nodesById.get(parentId);
        }        
    }
}

function expectAstTerminalNode(
    nodesById: Map<number, Ast.TNode>,
    terminalNodeIds: ReadonlyArray<number>,
    position: Position,
): Ast.TNode {
    for (const nodeId of terminalNodeIds) {
        const maybeNode: Option<Ast.TNode> = nodesById.get(nodeId);
        if (maybeNode === undefined) {
            throw new CommonError.InvariantError(
                `All terminalNodeIds should be in nodesById. Missing nodeId: ${nodeId}`,
            );
        }
        const node: Ast.TNode = maybeNode;
        const tokenRange: TokenRange = node.tokenRange;
        const positionStart: TokenPosition = tokenRange.positionStart;
        const positionEnd: TokenPosition = tokenRange.positionEnd;

        const isMatch: boolean =
            positionStart.lineNumber >= position.lineNumber &&
            positionEnd.lineNumber <= position.lineNumber &&
            positionStart.lineCodeUnit >= position.lineCodeUnit &&
            positionEnd.lineCodeUnit >= position.lineCodeUnit;
        if (isMatch) {
            return node;
        }
    }

    throw new CommonError.InvariantError(
        `Could not find a terminal node at given position: position=${JSON.stringify(position)}`,
    );
}
