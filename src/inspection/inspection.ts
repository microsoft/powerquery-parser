// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { TriedTraverse } from "../common/traversal";
import { Ast, NodeIdMap, NodeIdMapUtils } from "../parser";
import { AutocompleteInspected, tryFrom as autocompleteInspectedTryFrom } from "./autocomplete";
import { IdentifierInspected, tryFrom as identifierInspectedTryFrom } from "./identifier";
import { Position, PositionUtils } from "./position";

// Inspection is designed to run sub-inspections,
// eg. one inspection for scope and one for keywords.
// Look in `state.ts` to see the traversal and return types for each sub-inspection.
// If any sub-inspection returns an Err, return the Err.
// If all sub-inspections succeed, return the union of all successful traversals.

export interface InspectedCommon {
    readonly travelPath: ReadonlyArray<NodeIdMap.TXorNode>;
}
export type Inspected = InspectedCommon & IdentifierInspected & AutocompleteInspected;
export type TriedInspection = Result<Inspected, CommonError.CommonError>;

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const maybeActiveXorNode: Option<NodeIdMap.TXorNode> = PositionUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    const travelPath: ReadonlyArray<NodeIdMap.TXorNode> =
        maybeActiveXorNode !== undefined
            ? NodeIdMapUtils.expectAncestry(nodeIdMapCollection, maybeActiveXorNode.node.id)
            : [];

    const maybePositionIdentifier: Option<Ast.Identifier | Ast.GeneralizedIdentifier> = maybeGetIdentifierUnderPostion(
        position,
        nodeIdMapCollection,
        travelPath[0],
    );

    const triedInspectedIdentifier: TriedTraverse<IdentifierInspected> = identifierInspectedTryFrom(
        travelPath,
        maybePositionIdentifier,
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (triedInspectedIdentifier.kind === ResultKind.Err) {
        return triedInspectedIdentifier;
    }

    const triedInspectedKeyword: TriedTraverse<AutocompleteInspected> = autocompleteInspectedTryFrom(
        nodeIdMapCollection,
        leafNodeIds,
        position,
        triedInspectedIdentifier.value.maybeIdentifierUnderPosition,
    );
    if (triedInspectedKeyword.kind === ResultKind.Err) {
        return triedInspectedKeyword;
    }

    return {
        kind: ResultKind.Ok,
        value: {
            ...triedInspectedIdentifier.value,
            ...triedInspectedKeyword.value,
            travelPath: travelPath,
        },
    };
}

// Checks if:
//  * the node is some sort of identifier
//  * position is on the node
export function maybeGetIdentifierUnderPostion(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeXorNode: Option<NodeIdMap.TXorNode>,
): Option<Ast.Identifier | Ast.GeneralizedIdentifier> {
    if (maybeXorNode === undefined || maybeXorNode.kind !== NodeIdMap.XorNodeKind.Ast) {
        return undefined;
    }
    const leaf: Ast.TNode = maybeXorNode.node;

    let identifier: Ast.Identifier | Ast.GeneralizedIdentifier;

    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (leaf.kind === Ast.NodeKind.Constant && leaf.literal === `@`) {
        const maybeParentId: Option<number> = nodeIdMapCollection.parentIdById.get(leaf.id);
        if (maybeParentId === undefined) {
            return undefined;
        }
        const parentId: number = maybeParentId;

        const parent: Ast.TNode = NodeIdMapUtils.expectAstNode(nodeIdMapCollection.astNodeById, parentId);
        if (parent.kind !== Ast.NodeKind.IdentifierExpression) {
            return undefined;
        }
        identifier = parent.identifier;
    } else if (leaf.kind === Ast.NodeKind.Identifier || leaf.kind === Ast.NodeKind.GeneralizedIdentifier) {
        identifier = leaf;
    } else {
        return undefined;
    }

    if (PositionUtils.isOnOrDirectlyAfterAstNode(position, identifier)) {
        return identifier;
    } else {
        return undefined;
    }
}
