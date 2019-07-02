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
                kind: NodeKind.EachExpression,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
            break;
        }

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, node);
            break;

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
            state.result.nodes.push({
                kind: NodeKind.InvokeExpression,
                maybePositionStart: node.maybeTokenStart !== undefined ? node.maybeTokenStart.positionStart : undefined,
                maybePositionEnd: undefined,
            });
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

function inspectFunctionExpression(state: State, node: ParserContext.Node): void {
    // Check if any part of the parameters were parsed.
    const maybeParametersXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        node.id,
        0,
        Ast.NodeKind.ParameterList,
    );
    if (maybeParametersXorNode === undefined) {
        return;
    }
    const parametersXorNode: NodeIdMap.TXorNode = maybeParametersXorNode;

    switch (parametersXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            inspectAst.inspectParameterList(state, parametersXorNode.node as Ast.TParameterList);
            break;

        case NodeIdMap.XorNodeKind.Context: {
            const maybeContentXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                state.nodeIdMapCollection,
                parametersXorNode.node.id,
                1,
                Ast.NodeKind.CsvArray,
            );
            // No TCsvArray child exists.
            if (maybeContentXorNode === undefined) {
                return;
            }
            const contentXorNode: NodeIdMap.TXorNode = maybeContentXorNode;

            switch (contentXorNode.kind) {
                case NodeIdMap.XorNodeKind.Ast:
                    const contentAstNode: Ast.FunctionExpression["parameters"]["content"] = contentXorNode.node as Ast.FunctionExpression["parameters"]["content"];
                    for (const csv of contentAstNode.elements) {
                        if (!inspectAst.inspectParameter(state, csv.node)) {
                            break;
                        }
                    }
                    break;

                case NodeIdMap.XorNodeKind.Context:
                    for (const paramterXorNode of csvArrayChildrenXorNodes(state.nodeIdMapCollection, contentXorNode)) {
                        switch (paramterXorNode.kind) {
                            case NodeIdMap.XorNodeKind.Ast:
                                const parameter: Ast.TParameter = NodeIdMap.expectCastToAstNode(
                                    paramterXorNode,
                                    Ast.NodeKind.Parameter,
                                );
                                inspectAst.inspectParameter(state, parameter);
                                break;

                            case NodeIdMap.XorNodeKind.Context:
                                inspectParameterContext(state, paramterXorNode.node);
                                break;

                            default:
                                throw isNever(paramterXorNode);
                        }
                    }

                    break;

                default:
                    throw isNever(contentXorNode);
            }
            break;
        }

        default:
            throw isNever(parametersXorNode);
    }
}

function inspectParameterContext(state: State, parameter: ParserContext.Node): void {
    const maybeNameXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        parameter.id,
        0,
        Ast.NodeKind.Parameter,
    );
    if (maybeNameXorNode === undefined) {
        return;
    }
    const nameXorNode: NodeIdMap.TXorNode = maybeNameXorNode;

    switch (nameXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const nameAstNode: Ast.Identifier = NodeIdMap.expectCastToAstNode(nameXorNode, Ast.NodeKind.Identifier);
            if (isTokenPositionBeforePostiion(nameAstNode.tokenRange.positionEnd, state.position)) {
                addAstToScopeIfNew(state, nameAstNode.literal, nameAstNode);
            }
            break;
        }

        case NodeIdMap.XorNodeKind.Context:
            break;

        default:
            throw isNever(nameXorNode);
    }
}

function inspectIdentifierExpression(state: State, node: ParserContext.Node): void {
    let result: string = "";
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    // Add the optional inclusive constant `@` if it was parsed.
    const maybeInclusiveConstant: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        node.id,
        0,
        Ast.NodeKind.Constant,
    );
    if (maybeInclusiveConstant !== undefined) {
        const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
        result += inclusiveConstant.literal;
    }

    const maybeIdentifier: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        nodeIdMapCollection,
        node.id,
        1,
        Ast.NodeKind.Identifier,
    );
    if (maybeIdentifier !== undefined) {
        const identifier: Ast.Identifier = maybeIdentifier.node as Ast.Identifier;
        result += identifier.literal;
    }

    if (result.length) {
        addContextToScopeIfNew(state, result, node);
    }
}

function inspectInvokeExpression(state: State, invokeExpression: ParserContext.Node): void {
    const maybeContentXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        invokeExpression.id,
        1,
        Ast.NodeKind.CsvArray,
    );
    if (maybeContentXorNode === undefined) {
        return;
    }
    const contentXorNode: NodeIdMap.TXorNode = maybeContentXorNode;

    for (const invokeArgumentXorNode of csvArrayChildrenXorNodes(state.nodeIdMapCollection, contentXorNode)) {
        switch (invokeArgumentXorNode.kind) {
            case NodeIdMap.XorNodeKind.Ast:
                const invokeArgumentAstNode: Ast.TNode = invokeArgumentXorNode.node;
                if (
                    invokeArgumentAstNode.kind === Ast.NodeKind.IdentifierExpression &&
                    isTokenPositionBeforePostiion(invokeArgumentAstNode.tokenRange.positionEnd, state.position)
                ) {
                    inspectAst.inspectIdentifierExpression(state, invokeArgumentAstNode);
                }
                break;

            case NodeIdMap.XorNodeKind.Context:
                {
                    const invokeArgumentContextNode: ParserContext.Node = invokeArgumentXorNode.node;
                    if (invokeArgumentContextNode.kind === Ast.NodeKind.Identifier) {
                        inspectIdentifierExpression(state, invokeArgumentContextNode);
                    }
                }
                break;

            default:
                throw isNever(invokeArgumentXorNode);
        }
    }
}

function inspectRecursivePrimaryExpression(state: State, node: ParserContext.Node): void {
    // Don't validate Ast.NodeKind as the head can be many kinds.
    const maybeHeadXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        node.id,
        0,
        undefined,
    );
    if (maybeHeadXorNode === undefined) {
        return;
    }
    const headXorNode: NodeIdMap.TXorNode = maybeHeadXorNode;

    if (headXorNode.kind === NodeIdMap.XorNodeKind.Ast && headXorNode.node.kind === Ast.NodeKind.IdentifierExpression) {
        const headAstNode: Ast.IdentifierExpression = headXorNode.node;
        inspectAst.inspectRecursivePrimaryExressionHead(state, headAstNode);
    }
}

function inspectSection(state: State, node: ParserContext.Node): void {
    const maybeSectionMemberArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
        state.nodeIdMapCollection,
        node.id,
        4,
        Ast.NodeKind.SectionMemberArray,
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
        Ast.NodeKind.CsvArray,
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
                    Ast.NodeKind.GeneralizedIdentifier,
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
