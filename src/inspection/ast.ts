// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../parser";
import { isInTokenRange, isParentOfNodeKind, isPositionOnTokenPosition, NodeKind, Position, State } from "./common";

export function inspectAstNode(state: State, node: Ast.TNode): void {
    switch (node.kind) {
        case Ast.NodeKind.EachExpression: {
            if (!state.isEachEncountered) {
                state.isEachEncountered = true;
                state.result.scope.push("_");
            }

            const tokenRange: Ast.TokenRange = node.tokenRange;
            state.result.nodes.push({
                kind: NodeKind.Each,
                maybePositionStart: tokenRange.positionStart,
                maybePositionEnd: tokenRange.positionEnd,
            });
            break;
        }

        case Ast.NodeKind.Identifier:
            if (!isParentOfNodeKind(state.nodeIdMapCollection, node.id, Ast.NodeKind.IdentifierExpression)) {
                state.result.scope.push(node.literal);
            }
            break;

        case Ast.NodeKind.IdentifierExpression: {
            let identifier: string = node.identifier.literal;
            if (node.maybeInclusiveConstant) {
                const inclusiveConstant: Ast.Constant = node.maybeInclusiveConstant;
                identifier = inclusiveConstant.literal + identifier;
            }
            state.result.scope.push(identifier);
            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral: {
            // Check if position is on closeWrapperConstant, eg. '}'
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = node.tokenRange;
            if (
                isInTokenRange(position, tokenRange) &&
                !isPositionOnTokenPosition(position, node.closeWrapperConstant.tokenRange.positionStart)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.List,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });
            }
            break;
        }

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            // Check if position is on closeWrapperConstant, eg. ']'
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = node.tokenRange;
            if (
                isInTokenRange(position, tokenRange) &&
                !isPositionOnTokenPosition(position, node.closeWrapperConstant.tokenRange.positionStart)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.Record,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });
            }
            break;
        }

        default:
            break;
    }
}
