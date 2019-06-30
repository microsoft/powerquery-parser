// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option } from "../common";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { maybeXorChildren, XorNodeKind } from "../parser/nodeIdMap";
import {
    addAstToScopeIfNew,
    addToScopeIfNew,
    csvArrayChildrenXorNodes,
    isParentOfNodeKind,
    isTokenPositionBeforePostiion,
    NodeKind,
    State,
} from "./common";
import * as inspectAst from "./inspectAstNodes";

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
            if (
                !isParentOfNodeKind(state.nodeIdMapCollection, node.id, Ast.NodeKind.IdentifierExpression) &&
                node.maybeAstNode
            ) {
                const identifier: Ast.Identifier = node.maybeAstNode as Ast.Identifier;
                addContextToScopeIfNew(state, identifier.literal, node);
            }
            break;

        case Ast.NodeKind.IdentifierExpression: {
            inspectIdentifierExpression(state, node);
            break;
        }

        case Ast.NodeKind.InvokeExpression: {
            inspectInvokeExpression(state, node);
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

            for (const key of keysFromRecord(state.nodeIdMapCollection, node.id)) {
                if (isTokenPositionBeforePostiion(key.tokenRange.positionEnd, state.position)) {
                    addAstToScopeIfNew(state, key.literal, key);
                }
            }

            break;
        }

        case Ast.NodeKind.RecursivePrimaryExpression:
            inspectRecursivePrimaryExpression(state, node);
            break;

        case Ast.NodeKind.Section: {
            inspectSection(state, node);
            break;
        }

        default:
            break;
    }
}

function addContextToScopeIfNew(state: State, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: XorNodeKind.Context,
        node: contextNode,
    });
}

function inspectIdentifierExpression(state: State, node: ParserContext.Node): void {
    let result: string = "";
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const maybeInclusiveConstant: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        node.id,
        0,
    );
    if (maybeInclusiveConstant !== undefined && maybeInclusiveConstant.kind === NodeIdMap.XorNodeKind.Ast) {
        const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
        result += inclusiveConstant.literal;
    }

    const maybeIdentifier: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        node.id,
        1,
    );
    if (maybeIdentifier !== undefined && maybeIdentifier.kind === NodeIdMap.XorNodeKind.Ast) {
        const identifier: Ast.Identifier = maybeIdentifier.node as Ast.Identifier;
        result += identifier.literal;
    }

    if (result.length) {
        addContextToScopeIfNew(state, result, node);
    }
}

function inspectInvokeExpression(state: State, node: ParserContext.Node): void {
    const maybeContentXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        node.id,
        1,
    );
    if (maybeContentXorNode === undefined) {
        return;
    }
    const contentXorNode: NodeIdMap.TXorNode = maybeContentXorNode;

    switch (contentXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            const contentAstNode: Ast.TNode = contentXorNode.node;
            if (contentAstNode.kind !== Ast.NodeKind.CsvArray) {
                const details: {} = { contentAstNode };
                throw new CommonError.InvariantError(
                    `expected contentAstNode.kind to be ${Ast.NodeKind.CsvArray}`,
                    details,
                );
            }

            inspectAst.inspectInvokeExpressionContent(state, contentAstNode as Ast.ICsvArray<Ast.TExpression>);
            break;

        case NodeIdMap.XorNodeKind.Context: {
            // Try to grab the 2nd child (a TCsvArray) from parent (where the 1st child is the constant '(').
            const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                state.nodeIdMapCollection,
                node.id,
                1,
            );
            // No TCsvArray child exists.
            if (maybeCsvArrayXorNode === undefined) {
                break;
            }
            const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

            for (const csvXorNode of csvArrayChildrenXorNodes(state.nodeIdMapCollection, csvArrayXorNode)) {
                if (csvXorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
                    continue;
                }

                switch (csvXorNode.kind) {
                    case NodeIdMap.XorNodeKind.Ast:
                        const arg: Ast.TNode = csvXorNode.node;
                        if (isTokenPositionBeforePostiion(arg.tokenRange.positionEnd, state.position)) {
                            inspectAst.inspectAstNode(state, arg);
                        }
                        break;

                    case NodeIdMap.XorNodeKind.Context:
                        inspectIdentifierExpression(state, csvXorNode.node);
                        break;

                    default:
                        throw isNever(csvXorNode);
                }
            }

            break;
        }

        default:
            throw isNever(contentXorNode);
    }
}

function inspectRecursivePrimaryExpression(state: State, node: ParserContext.Node): void {
    const maybeHeadXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        node.id,
        0,
    );
    if (maybeHeadXorNode === undefined) {
        return;
    }
    const headXorNode: NodeIdMap.TXorNode = maybeHeadXorNode;
    switch (headXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            if (headXorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
                return;
            }
            const headAstNode: Ast.IdentifierExpression = headXorNode.node;
            inspectAst.inspectRecursivePrimaryExressionHead(state, headAstNode);
            break;

        case NodeIdMap.XorNodeKind.Context:
        default:
            break;
    }
}

function inspectSection(state: State, node: ParserContext.Node): void {
    const maybeSectionMemberArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        node.id,
        4,
    );
    if (maybeSectionMemberArrayXorNode === undefined) {
        return;
    }
    const sectionMemberArrayXorNode: NodeIdMap.TXorNode = maybeSectionMemberArrayXorNode;

    switch (sectionMemberArrayXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            inspectAst.inspectSectionMemberArray(state, sectionMemberArrayXorNode.node as Ast.SectionMemberArray);
            break;

        case NodeIdMap.XorNodeKind.Context: {
            const maybeChildren: Option<ReadonlyArray<NodeIdMap.TXorNode>> = maybeXorChildren(
                state.nodeIdMapCollection,
                node.id,
            );
            if (maybeChildren === undefined) {
                break;
            }
            const children: ReadonlyArray<NodeIdMap.TXorNode> = maybeChildren;
            for (const sectionMemberXorNode of children) {
                switch (sectionMemberXorNode.kind) {
                    case NodeIdMap.XorNodeKind.Ast:
                        inspectAst.inspectSectionMember(state, sectionMemberXorNode.node as Ast.SectionMember);
                        break;

                    case NodeIdMap.XorNodeKind.Context:
                        break;

                    default:
                        throw isNever(sectionMemberXorNode);
                }
            }
            break;
        }

        default:
            throw isNever(sectionMemberArrayXorNode);
    }
}

// Returns all record keys (GeneralizedIdentifier) from a Record TXorNode.
function keysFromRecord(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.GeneralizedIdentifier> {
    // Try to grab the 2nd child (a TCsvArray) from parent (where the 1st child is the constant '[').
    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        1,
    );
    // No TCsvArray child exists.
    if (maybeCsvArrayXorNode === undefined) {
        return [];
    }

    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;
    const keys: Ast.GeneralizedIdentifier[] = [];

    // Iterate over all Ast.ICsv<_>.node
    for (const csvXorNode of csvArrayChildrenXorNodes(nodeIdMapCollection, csvArrayXorNode)) {
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
                            `csvXorNode can should only be either ${
                                Ast.NodeKind.GeneralizedIdentifierPairedExpression
                            } or ${Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral}`,
                            details,
                        );
                }
                break;
            }

            // The child is a ParserContext.Node, so more hack-y navigation.
            case NodeIdMap.XorNodeKind.Context: {
                // Starting from the Csv, try to perform a drilldown on the following path:
                //  * GeneralizedIdentifierPairedAnyLiteral or GeneralizedIdentifierPairedExpression
                //  * GeneralizedIdentifier
                const maybeKeyXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                    nodeIdMapCollection,
                    csvXorNode.node.id,
                    0,
                );

                // The GeneralizedIdentifier TXorNode doesn't exist because it wasn't parsed.
                if (maybeKeyXorNode === undefined || maybeKeyXorNode.node.kind !== Ast.NodeKind.GeneralizedIdentifier) {
                    break;
                }
                const keyXorNode: NodeIdMap.TXorNode = maybeKeyXorNode;

                // maybeChildByAttributeIndex returns a TXorNode, but we only care about the Ast.TNode case.
                if (keyXorNode.kind === NodeIdMap.XorNodeKind.Ast) {
                    // We've already checked that it's a GeneralizedIdentifier
                    keys.push(keyXorNode.node as Ast.GeneralizedIdentifier);
                }

                break;
            }

            default:
                throw isNever(csvXorNode);
        }
    }

    return keys;
}
