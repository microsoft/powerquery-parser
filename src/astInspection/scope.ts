import { CommonError, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, TokenRange, ParserContext } from "../parser";

/* tslint:disable */

interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

const enum InspectionMode {
    Ast = "Ast",
    Context = "Context",
}

interface InspectionState {
    // values returned in an instance of Inspection
    scope: string[];
    isIdentifier: boolean;
    isLeftHandAssignment: boolean;
    inRecord: boolean;
    inEach: boolean;
    inFunction: boolean;
    tokenRangeStart: number;
    tokenRangeEnd: number;

    // used by inspection functions
    mode: InspectionMode;
    astNodesById: Map<number, Ast.TNode>;
    contextNodesById: Map<number, ParserContext.Node>;
}

function inspectContextState(contextState: ParserContext.State) {}

function inspectionStateFactory(
    position: Position,
    astNodesById: Map<number, Ast.TNode>,
    contextNodesById: Map<number, ParserContext.Node>,
): InspectionState {}

// function inspectParseOk(parseOk: ParseOk, position: Position) {
//     const terminalNode: Ast.TNode = expectAstTerminalNode(parseOk.nodesById, parseOk.terminalNodeIds, position);
// }

// function inspectAstNode(inspectionState: InspectionState, node: Ast.TNode, nodesById: Map<number, ParserContext.Node>) {
//     let maybeNode: Option<Ast.TNode> = node;

//     while (maybeNode) {
//         const node: Ast.TNode = maybeNode;

//         switch (node.kind) {
//             case Ast.NodeKind.EachExpression:
//                 if (!inspectionState.inEach) {
//                     inspectionState.scope.push("_");
//                 }
//                 inspectionState.inEach = true;
//                 break;

//             case Ast.NodeKind.GeneralizedIdentifier:
//                 inspectionState.scope.push(node.literal);
//                 break;

//             case Ast.NodeKind.Identifier:
//                 inspectionState.scope.push(node.literal);
//                 break;
//         }

//         if (node.maybeParentId === undefined) {
//             maybeNode = undefined;
//         } else {
//             const parentId: number = node.maybeParentId;
//             maybeNode = nodesById.get(parentId);
//         }
//     }
// }

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
        if (isInRange(position, tokenRange)) {
            return node;
        }
    }

    return undefined;

    // throw new CommonError.InvariantError(
    //     `Could not find a terminal node at given position: position=${JSON.stringify(position)}`,
    // );
}

function expectTerminalNode(
    astNodesById: Map<number, Ast.TNode>,
    contextNodesById: Map<number, ParserContext.Node>,
    terminalNodeIds: ReadonlyArray<number>,
    position: Position,
): Ast.TNode {
    for (const nodeId of terminalNodeIds) {
        if (contextNodesById.has(nodeId)) {
            const contextNode: ParserContext.Node = contextNodesById.get(nodeId) as ParserContext.Node;
            if (contextNode.maybeAstNode === undefined) {
                throw new CommonError.InvariantError(
                    `maybeAstNode should be truthy. The nodeId=${nodeId} should've been placed in terminalNodeIds as the context was ending.`,
                );
            }
    
            const astNode: Ast.TNode = contextNode.maybeAstNode;
            const tokenRange: TokenRange = astNode.tokenRange;
            if (isInRange(position, tokenRange)) {
                return astNode;
            }
        }

    }

    return undefined;

    // throw new CommonError.InvariantError(
    //     `Could not find a terminal node at given position: position=${JSON.stringify(position)}`,
    // );
}

function isInRange(position: Position, tokenRange: TokenRange): boolean {
    const positionStart: TokenPosition = tokenRange.positionStart;
    const positionEnd: TokenPosition = tokenRange.positionEnd;

    return (
        positionStart.lineNumber >= position.lineNumber &&
        positionEnd.lineNumber <= position.lineNumber &&
        positionStart.lineCodeUnit >= position.lineCodeUnit &&
        positionEnd.lineCodeUnit >= position.lineCodeUnit
    );
}
