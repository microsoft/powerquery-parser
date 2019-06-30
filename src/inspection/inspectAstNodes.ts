// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../parser";
import {
    addAstToScopeIfNew,
    inspectSectionMemberArray,
    isInTokenRange,
    isParentOfNodeKind,
    isTokenPositionBeforePostiion,
    isTokenPositionOnPosition,
    NodeKind,
    Position,
    State,
} from "./common";

export function inspectAstNode(state: State, node: Ast.TNode): void {
    switch (node.kind) {
        case Ast.NodeKind.EachExpression: {
            addAstToScopeIfNew(state, "_", node);
            const tokenRange: Ast.TokenRange = node.tokenRange;
            state.result.nodes.push({
                kind: NodeKind.Each,
                maybePositionStart: tokenRange.positionStart,
                maybePositionEnd: tokenRange.positionEnd,
            });
            break;
        }

        case Ast.NodeKind.GeneralizedIdentifier: {
            addAstToScopeIfNew(state, node.literal, node);
            break;
        }

        case Ast.NodeKind.Identifier:
            if (!isParentOfNodeKind(state.nodeIdMapCollection, node.id, Ast.NodeKind.IdentifierExpression)) {
                addAstToScopeIfNew(state, node.literal, node);
            }
            break;

        case Ast.NodeKind.IdentifierExpression: {
            let identifier: string = node.identifier.literal;
            if (node.maybeInclusiveConstant) {
                const inclusiveConstant: Ast.Constant = node.maybeInclusiveConstant;
                identifier = inclusiveConstant.literal + identifier;
            }

            addAstToScopeIfNew(state, identifier, node);
            break;
        }

        case Ast.NodeKind.InvokeExpression: {
            const args: Ast.ICsvArray<Ast.TExpression> = node.content;

            for (const csv of args.elements) {
                const arg: Ast.TExpression = csv.node;
                if (
                    arg.kind === Ast.NodeKind.IdentifierExpression &&
                    isTokenPositionBeforePostiion(arg.tokenRange.positionEnd, state.position)
                ) {
                    inspectAstNode(state, arg);
                }
            }

            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral: {
            // Check if position is on closeWrapperConstant, eg. '}'
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = node.tokenRange;

            if (
                isInTokenRange(position, tokenRange) &&
                !isTokenPositionOnPosition(node.closeWrapperConstant.tokenRange.positionStart, position)
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
                !isTokenPositionOnPosition(node.closeWrapperConstant.tokenRange.positionStart, position)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.Record,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });

                for (const csv of node.content.elements) {
                    const key: Ast.GeneralizedIdentifier = csv.node.key;
                    if (isTokenPositionBeforePostiion(key.tokenRange.positionEnd, state.position)) {
                        addAstToScopeIfNew(state, key.literal, key);
                    }
                }
            }

            break;
        }

        case Ast.NodeKind.RecursivePrimaryExpression: {
            const head: Ast.TPrimaryExpression = node.head;
            if (
                head.kind === Ast.NodeKind.IdentifierExpression &&
                isTokenPositionBeforePostiion(head.tokenRange.positionEnd, state.position)
            ) {
                inspectAstNode(state, head);
            }
            break;
        }

        case Ast.NodeKind.Section:
            inspectSectionMemberArray(state, node.sectionMembers);
            break;

        default:
            break;
    }
}
