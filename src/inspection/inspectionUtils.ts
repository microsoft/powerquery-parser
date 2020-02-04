import { CommonError } from "../common";
import { Ast, NodeIdMap } from "../parser";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";

export interface InspectionState {
    readonly nodeIndex: number;
    readonly activeNode: ActiveNode;
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

    const maybeKeyValuePair: NodeIdMap.TXorNode | undefined = ActiveNodeUtils.maybePreviousXorNode(
        state.activeNode,
        state.nodeIndex,
        n,
        [
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.IdentifierExpressionPairedExpression,
        ],
    );
    if (maybeKeyValuePair === undefined) {
        return false;
    }
    const keyValuePair: NodeIdMap.TXorNode = maybeKeyValuePair;

    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = state.activeNode.ancestry;

    const keyValuePairAncestryIndex: number = ancestry.indexOf(keyValuePair);
    if (keyValuePairAncestryIndex === -1) {
        throw new CommonError.InvariantError("xorNode isn't in ancestry");
    }

    const maybeChild: NodeIdMap.TXorNode | undefined = ancestry[keyValuePairAncestryIndex - 1];
    if (maybeChild === undefined) {
        const details: {} = { keyValuePairId: keyValuePair.node.id };
        throw new CommonError.InvariantError("expected xorNode to have a child", details);
    }

    return maybeChild.node.maybeAttributeIndex === 2;
}
