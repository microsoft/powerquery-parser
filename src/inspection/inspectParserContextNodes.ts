// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, NotYetImplementedError, Option } from "../common";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { TXorNode, XorNodeKind } from "../parser/nodeIdMap";
import { addToScopeIfNew, isParentOfNodeKind, NodeKind, State } from "./common";
import { inspectRecordContent } from "./inspectAstNodes";

export function inspectContextNode(state: State, node: ParserContext.Node): void {
    switch (node.kind) {
        case Ast.NodeKind.EachExpression: {
            addContextToScopeIfNew(state, "_", node);
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
                    addContextToScopeIfNew(state, astNode.literal, node);
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
                addContextToScopeIfNew(state, identifier, node);
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

            const maybeChildIds: Option<ReadonlyArray<number>> = state.nodeIdMapCollection.childIdsById.get(node.id);
            if (maybeChildIds === undefined) {
                break;
            }
            // IWrapped.content (key value pair Csvs) haven't been read
            const childIds: ReadonlyArray<number> = maybeChildIds;
            if (childIds.length <= 1) {
                break;
            }

            // const content: TXorNode = NodeIdMap.expectXorNode(state.nodeIdMapCollection, node.id);
            // switch (content.kind) {
            //     case XorNodeKind.Ast:
            //         switch (content.node.kind) {
            //             case Ast.NodeKind.RecordExpression:
            //             case Ast.NodeKind.RecordLiteral:
            //                 inspectRecordContent(
            //                     state,
            //                     {
            //                         kind: XorNodeKind.Context,
            //                         node,
            //                     },
            //                     content.node.content,
            //                 );
            //                 break;

            //             default: {
            //                 const details: {} = { node };
            //                 throw new CommonError.InvariantError(
            //                     `nodeKind should be RecordExpression or RecordLiteral`,
            //                     details,
            //                 );
            //             }
            //         }
            //         break;

            //     case XorNodeKind.Context:
            //         break;

            //     default:
            //         throw isNever(content);
            // }

            throw new NotYetImplementedError(``);
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

function addContextToScopeIfNew(state: State, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: XorNodeKind.Context,
        node: contextNode,
    });
}
