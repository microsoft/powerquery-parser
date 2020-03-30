import { CommonError } from "../common";
import { AncestryUtils, Ast, TXorNode } from "../parser";
import { ActiveNode } from "./activeNode";

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

    const maybeKeyValuePair: TXorNode | undefined = AncestryUtils.maybePreviousXorNode(
        state.activeNode.ancestry,
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
    const keyValuePair: TXorNode = maybeKeyValuePair;

    const ancestry: ReadonlyArray<TXorNode> = state.activeNode.ancestry;

    const keyValuePairAncestryIndex: number = ancestry.indexOf(keyValuePair);
    if (keyValuePairAncestryIndex === -1) {
        throw new CommonError.InvariantError("xorNode isn't in ancestry");
    }

    const maybeChild: TXorNode | undefined = ancestry[keyValuePairAncestryIndex - 1];
    if (maybeChild === undefined) {
        const details: {} = { keyValuePairId: keyValuePair.node.id };
        throw new CommonError.InvariantError("expected xorNode to have a child", details);
    }

    return maybeChild.node.maybeAttributeIndex === 2;
}
