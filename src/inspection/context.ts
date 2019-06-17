// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option } from "../common";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { isParentOfNodeKind, NodeKind, State } from "./common";

export function inspectContextNode(state: State, node: ParserContext.Node): void {
    switch (node.kind) {
        case Ast.NodeKind.EachExpression: {
            if (!state.isEachEncountered) {
                state.isEachEncountered = true;
                state.result.scope.push("_");
            }

            state.result.nodes.push({
                kind: NodeKind.Each,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        case Ast.NodeKind.Identifier:
            if (!isParentOfNodeKind(state.nodeIdMapCollection, node.id, Ast.NodeKind.IdentifierExpression)) {
                const maybeAstNode: Option<Ast.Identifier> = maybeCastAsAstNode<
                    Ast.Identifier,
                    Ast.NodeKind.Identifier
                >(node, Ast.NodeKind.Identifier);
                if (maybeAstNode !== undefined) {
                    const astNode: Ast.Identifier = maybeAstNode;
                    state.result.scope.push(astNode.literal);
                }
            }
            break;

        case Ast.NodeKind.IdentifierExpression: {
            let identifier: string = "";
            const children: ReadonlyArray<NodeIdMap.TXorNode> = contextChildren(state.nodeIdMapCollection, node);

            if (children.length === 1 || children.length === 2) {
                const firstChild: NodeIdMap.TXorNode = children[0];
                if (firstChild.kind === NodeIdMap.XorNodeKind.Ast) {
                    switch (firstChild.node.kind) {
                        // inclusive constant `@`
                        case Ast.NodeKind.Constant:
                        // no inclusive constant
                        case Ast.NodeKind.Identifier:
                            identifier += firstChild.node.literal;
                            break;

                        default:
                            const details: {} = { nodeKind: firstChild.node.kind };
                            throw new CommonError.InvariantError(
                                `identifierExpression has invalid Ast.NodeKind`,
                                details,
                            );
                    }
                }
            }

            if (children.length === 2) {
                const secondChild: NodeIdMap.TXorNode = children[1];
                if (secondChild.kind === NodeIdMap.XorNodeKind.Ast) {
                    if (secondChild.node.kind !== Ast.NodeKind.Identifier) {
                        const details: {} = { nodeKind: secondChild.node.kind };
                        throw new CommonError.InvariantError(`identifierExpression has invalid Ast.NodeKind`, details);
                    }

                    identifier += secondChild.node.literal;
                }
            }

            if (identifier) {
                state.result.scope.push(identifier);
            }

            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral: {
            state.result.nodes.push({
                kind: NodeKind.List,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            state.result.nodes.push({
                kind: NodeKind.Record,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        default:
            break;
    }
}

function maybeCastAsAstNode<T, Kind>(
    contextNode: ParserContext.Node,
    nodeKind: Ast.NodeKind & Kind,
): Option<T & Ast.TNode> {
    if (contextNode.maybeAstNode === undefined) {
        return undefined;
    }
    const astNode: Ast.TNode = contextNode.maybeAstNode;

    if (astNode.kind === nodeKind) {
        return astNode as T & Ast.TNode;
    } else {
        return undefined;
    }
}

function contextChildren(
    nodeIdMapCollection: NodeIdMap.Collection,
    parent: ParserContext.Node,
): ReadonlyArray<NodeIdMap.TXorNode> {
    const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(parent.id);
    if (maybeChildIds === undefined) {
        return [];
    } else {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        return NodeIdMap.expectXorNodes(nodeIdMapCollection, childIds);
    }
}
