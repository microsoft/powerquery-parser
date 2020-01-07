// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { TriedTraverse } from "../common/traversal";
import { Ast, NodeIdMap, NodeIdMapUtils } from "../parser";
import { AutocompleteInspected, tryFrom as autocompleteInspectedTryFrom } from "./autocomplete";
import { IdentifierInspected, tryFrom as identifierInspectedTryFrom } from "./identifier";
import { ActiveNode, Position, PositionUtils, RelativePosition } from "./position";

// Inspection is designed to run sub-inspections,
// eg. one inspection for scope and one for keywords.
// Look in `state.ts` to see the traversal and return types for each sub-inspection.
// If any sub-inspection returns an Err, return the Err.
// If all sub-inspections succeed, return the union of all successful traversals.

export interface InspectedCommon {
    readonly maybeActiveNode: Option<ActiveNode>;
}
export type Inspected = InspectedCommon & IdentifierInspected & AutocompleteInspected;
export type TriedInspection = Result<Inspected, CommonError.CommonError>;

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const maybeActiveNode: Option<ActiveNode> = PositionUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );

    let maybePositionIdentifier: Option<Ast.Identifier | Ast.GeneralizedIdentifier>;
    if (maybeActiveNode) {
        maybeGetIdentifierUnderPostion(nodeIdMapCollection, maybeActiveNode);
    } else {
        maybePositionIdentifier = undefined;
    }

    const triedInspectedIdentifier: TriedTraverse<IdentifierInspected> = identifierInspectedTryFrom(
        maybeActiveNode,
        maybePositionIdentifier,
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
            maybeActiveNode,
            ...triedInspectedIdentifier.value,
            ...triedInspectedKeyword.value,
        },
    };
}

// Checks if:
//  * the node is some sort of identifier
//  * position is on the node
export function maybeGetIdentifierUnderPostion(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): Option<Ast.Identifier | Ast.GeneralizedIdentifier> {
    if (activeNode.root.kind !== NodeIdMap.XorNodeKind.Ast) {
        return undefined;
    }
    const root: Ast.TNode = activeNode.root.node;

    let identifier: Ast.Identifier | Ast.GeneralizedIdentifier;

    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (root.kind === Ast.NodeKind.Constant && root.literal === `@`) {
        const maybeParentId: Option<number> = nodeIdMapCollection.parentIdById.get(root.id);
        if (maybeParentId === undefined) {
            return undefined;
        }
        const parentId: number = maybeParentId;

        const parent: Ast.TNode = NodeIdMapUtils.expectAstNode(nodeIdMapCollection.astNodeById, parentId);
        if (parent.kind !== Ast.NodeKind.IdentifierExpression) {
            return undefined;
        }
        identifier = parent.identifier;
    } else if (root.kind === Ast.NodeKind.Identifier || root.kind === Ast.NodeKind.GeneralizedIdentifier) {
        identifier = root;
    } else {
        return undefined;
    }

    if (activeNode.relativePosition === RelativePosition.Under) {
        return identifier;
    } else {
        return undefined;
    }
}
