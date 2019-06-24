// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option } from "../common";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { XorNodeKind } from "../parser/nodeIdMap";
import {
    addToScopeIfNew,
    csvContainerChildXorNodes,
    isParentOfNodeKind,
    isTokenPositionBeforePostiion,
    NodeKind,
    State,
} from "./common";
import { addAstToScopeIfNew } from "./inspectAstNodes";

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

            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
            const maybeCsvContainerXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNodeChildAtIndex(
                state.nodeIdMapCollection,
                node.id,
                1,
                Ast.NodeKind.CsvContainer,
            );
            if (maybeCsvContainerXorNode !== undefined) {
                const csvContainerXorNode: NodeIdMap.TXorNode = maybeCsvContainerXorNode;
                for (const key of keysFromRecord(nodeIdMapCollection, csvContainerXorNode)) {
                    if (isTokenPositionBeforePostiion(key.tokenRange.positionEnd, state.position)) {
                        addAstToScopeIfNew(state, key.literal, key);
                    }
                }
            }

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

function addContextToScopeIfNew(state: State, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: XorNodeKind.Context,
        node: contextNode,
    });
}

// Returns all record keys from a TXorNode
function keysFromRecord(
    nodeIdMapCollection: NodeIdMap.Collection,
    csvContainerXorNode: NodeIdMap.TXorNode,
): ReadonlyArray<Ast.GeneralizedIdentifier> {
    const keys: Ast.GeneralizedIdentifier[] = [];

    // Iterate over all Ast.ICsv<_>.node
    for (const csvXorNode of csvContainerChildXorNodes(nodeIdMapCollection, csvContainerXorNode)) {
        switch (csvXorNode.kind) {
            // The child node is an Ast.TNode, which makes things way easier to logic out.
            case NodeIdMap.XorNodeKind.Ast: {
                const csvAstNode: Ast.TNode = csvXorNode.node;

                // Sanity check that we're matching the expected Ast.NodeKind.
                switch (csvAstNode.kind) {
                    case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
                    case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
                        keys.push(csvAstNode.key);
                        break;

                    default:
                        const details: {} = { csvXorNode };
                        throw new CommonError.InvariantError(
                            `csvXorNode can should only be either GeneralizedIdentifierPairedExpression or GeneralizedIdentifierPairedAnyLiteral`,
                            details,
                        );
                }
                break;
            }

            // The child is a ParserContext.Node, so more hack-y navigation.
            case NodeIdMap.XorNodeKind.Context: {
                // Drill down starting at the ParserContext for ICsv<_>.node to grab the TXorNode for the
                // GeneralizedIdentifier used by the RecordLiteral/RecordExpression key-value-pair if it exists.
                const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNodeChildIndexDrilldown(
                    nodeIdMapCollection,
                    csvXorNode.node.id,
                    [
                        {
                            childIndex: 0,
                            allowedChildAstNodeKinds: [
                                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                                Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                            ],
                        },
                        {
                            childIndex: 0,
                            allowedChildAstNodeKinds: [Ast.NodeKind.GeneralizedIdentifier],
                        },
                    ],
                );

                // The GeneralizedIdentifier doesn't exist because it wasn't parsed yet.
                if (maybeKeyXorNode === undefined) {
                    break;
                }
                const keyXorNode: NodeIdMap.TXorNode = maybeKeyXorNode;

                // The drill down returns a TXorNode.
                // Since GeneralizedIdentifiers are atomicly parsed nothing can be done if it's not an Ast.TNode.
                if (keyXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
                    const keyAstNode: Ast.TNode = keyXorNode.node;
                    if (keyAstNode.kind !== Ast.NodeKind.GeneralizedIdentifier) {
                        const details: {} = { keyXorNode };
                        throw new CommonError.InvariantError(
                            `keyXorNode can only be of kind GeneralizedIdentifier`,
                            details,
                        );
                    }
                    keys.push(keyAstNode);
                }

                break;
            }

            default:
                throw isNever(csvXorNode);
        }
    }

    return keys;
}
