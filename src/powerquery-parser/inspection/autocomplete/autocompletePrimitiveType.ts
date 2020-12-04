// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Ast, Constant } from "../../language";
import { AncestryUtils, TXorNode, XorNodeKind } from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { AutocompletePrimitiveType, TrailingToken, TriedAutocompletePrimitiveType } from "./commonTypes";

export function tryAutocompletePrimitiveType(
    settings: CommonSettings,
    maybeActiveNode: TMaybeActiveNode,
    maybeTrailingToken: TrailingToken | undefined,
): TriedAutocompletePrimitiveType {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return ResultUtils.okFactory([]);
    }

    return ResultUtils.ensureResult(settings.locale, () => {
        return autocompletePrimitiveType(maybeActiveNode, maybeTrailingToken);
    });
}

function autocompletePrimitiveType(
    activeNode: ActiveNode,
    maybeTrailingToken: TrailingToken | undefined,
): AutocompletePrimitiveType {
    return filterRecommendations(traverseAncestors(activeNode), maybeTrailingToken);
}

function filterRecommendations(
    inspected: AutocompletePrimitiveType,
    maybeTrailingToken: TrailingToken | undefined,
): AutocompletePrimitiveType {
    if (maybeTrailingToken === undefined) {
        return inspected;
    }
    const trailingData: string = maybeTrailingToken.data;

    return inspected.filter((primitiveTypeConstantKind: Constant.PrimitiveTypeConstantKind) =>
        primitiveTypeConstantKind.startsWith(trailingData),
    );
}

function traverseAncestors(activeNode: ActiveNode): AutocompletePrimitiveType {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const numAncestors: number = activeNode.ancestry.length;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const parent: TXorNode = ancestry[index];
        const maybeChild: TXorNode | undefined = ancestry[index - 1];

        // If the node is a context PrimitiveType node,
        // which is created only when a primitive type was expected but there was nothing to parse.
        // `x as |`
        if (parent.kind === XorNodeKind.Context && parent.node.kind === Ast.NodeKind.PrimitiveType) {
            return Constant.PrimitiveTypeConstantKinds;
        }
        // If on the second attribute for TypePrimaryType.
        // `type |`
        else if (parent.node.kind === Ast.NodeKind.TypePrimaryType) {
            if (maybeChild === undefined) {
                return Constant.PrimitiveTypeConstantKinds;
            } else if (
                maybeChild.node.maybeAttributeIndex === 0 &&
                maybeChild.kind === XorNodeKind.Ast &&
                PositionUtils.isAfterAst(activeNode.position, maybeChild.node as Ast.TNode, true)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            }
        }
        // If on a FunctionExpression parameter.
        else if (
            parent.node.kind === Ast.NodeKind.Parameter &&
            AncestryUtils.maybeNthNextXor(ancestry, index, 4, [Ast.NodeKind.FunctionExpression]) !== undefined
        ) {
            // Things get messy when testing if it's on a nullable primitive type OR a primitive type.
            const maybeGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
                ancestry,
                index,
                2,
                undefined,
            );
            if (maybeGrandchild === undefined) {
                continue;
            }
            // On primitive type.
            // `(x as |) => 0`
            else if (
                maybeGrandchild.kind === XorNodeKind.Ast &&
                maybeGrandchild.node.kind === Ast.NodeKind.Constant &&
                maybeGrandchild.node.constantKind === Constant.KeywordConstantKind.As &&
                PositionUtils.isAfterAst(activeNode.position, maybeGrandchild.node, true)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            }
            // On nullable primitive type
            // `(x as nullable |) => 0`
            else if (maybeGrandchild.node.kind === Ast.NodeKind.NullablePrimitiveType) {
                const maybeGreatGreatGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
                    ancestry,
                    index,
                    3,
                    undefined,
                );
                if (maybeGreatGreatGrandchild?.node.kind === Ast.NodeKind.PrimitiveType) {
                    return Constant.PrimitiveTypeConstantKinds;
                }
            }
        }
    }

    return [];
}
