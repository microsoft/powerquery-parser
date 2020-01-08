import { CommonError, Option } from "../common";
import { Ast, NodeIdMap } from "../parser";
import { ActiveNode } from "./activeNode";

export interface InspectionState {
    readonly nodeIndex: number;
    readonly activeNode: ActiveNode;
}

export function maybePreviousXorNode(
    state: InspectionState,
    n: number = 1,
    maybeNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): Option<NodeIdMap.TXorNode> {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = state.activeNode.ancestry[state.nodeIndex - n];
    if (maybeXorNode !== undefined && maybeNodeKinds !== undefined) {
        return maybeNodeKinds.indexOf(maybeXorNode.node.kind) !== -1 ? maybeXorNode : undefined;
    } else {
        return maybeXorNode;
    }
}

export function maybeNextXorNode(state: InspectionState, n: number = 1): Option<NodeIdMap.TXorNode> {
    return state.activeNode.ancestry[state.nodeIndex + n];
}

export function expectPreviousXorNode(
    state: InspectionState,
    n: number = 1,
    maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): NodeIdMap.TXorNode {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybePreviousXorNode(state, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no previous node");
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(xorNode.node.kind) === -1) {
        const details: {} = {
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`incorrect node kind for previous xorNode`, details);
    }

    return maybeXorNode;
}

export function expectNextXorNode(
    state: InspectionState,
    n: number = 1,
    maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): NodeIdMap.TXorNode {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybeNextXorNode(state, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no next node");
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(xorNode.node.kind) === -1) {
        const details: {} = {
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`incorrect node kind for attribute`, details);
    }

    return maybeXorNode;
}

// Should only be called: RecordLiteral, RecordExpression, SectionMember
export function isInKeyValuePairAssignment(state: InspectionState): boolean {
    // How far back do we look to find a paired expression?
    //
    // For SectionMember it's a single indirection, eg:
    // 'X -> KeyValuePair'
    //
    // For everything else it's 3, where the extra 2 come from an array of Csvs, eg:
    // 'Current -> ArrayWrapper -> Csv -> KeyValuePair'
    let n: number;
    if (state.activeNode.ancestry[state.nodeIndex].node.kind === Ast.NodeKind.SectionMember) {
        n = 1;
    } else {
        n = 3;
    }

    const maybeKeyValuePair: Option<NodeIdMap.TXorNode> = maybePreviousXorNode(state, n, [
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.IdentifierPairedExpression,
        Ast.NodeKind.IdentifierExpressionPairedExpression,
    ]);
    if (maybeKeyValuePair === undefined) {
        return false;
    }
    const keyValuePair: NodeIdMap.TXorNode = maybeKeyValuePair;

    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = state.activeNode.ancestry;

    const keyValuePairAncestryIndex: number = ancestry.indexOf(keyValuePair);
    if (keyValuePairAncestryIndex === -1) {
        throw new CommonError.InvariantError("xorNode isn't in ancestry");
    }

    const maybeChild: Option<NodeIdMap.TXorNode> = ancestry[keyValuePairAncestryIndex - 1];
    if (maybeChild === undefined) {
        const details: {} = { keyValuePairId: keyValuePair.node.id };
        throw new CommonError.InvariantError("expected xorNode to have a child", details);
    }

    return maybeChild.node.maybeAttributeIndex === 2;
}
