// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, ResultKind, Traverse, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { KeywordKind, TExpressionKeywords } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";
import { IInspectedNode } from "./node";
import { isPositionAfterXorNode, Position } from "./position";
import { KeywordInspected, KeywordState } from "./state";

import * as InspectionUtils from "./inspectionUtils";

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedTraverse<KeywordInspected> {
    const maybeRoot: Option<NodeIdMap.TXorNode> = maybeGetRoot(position, nodeIdMapCollection, leafNodeIds);
    if (maybeRoot === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultKeywordInspection,
        };
    }
    const state: TypeUtils.StripReadonly<KeywordState> = {
        position,
        nodeIdMapCollection,
        leafNodeIds,
        result: {
            allowedKeywords: [],
            maybeRequiredKeyword: undefined,
            keywordVisitedNodes: [],
        },
        isKeywordInspectionDone: false,
    };
    const root: NodeIdMap.TXorNode = maybeRoot;
    return Traverse.tryTraverseXor(
        state,
        nodeIdMapCollection,
        root,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        Traverse.maybeExpandXorParent,
        undefined,
    );
}

interface MaybeGetRootSearch {
    readonly rightMostNode: NodeIdMap.TXorNode;
    readonly nodeTokenRange: NodeIdMap.XorNodeTokenRange;
}

function maybeGetRoot(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    const nodeIds: ReadonlyArray<number> = [...nodeIdMapCollection.contextNodeById.keys(), ...leafNodeIds];
    let bestMatch: Option<MaybeGetRootSearch>;

    for (const xorNode of NodeIdMapUtils.expectXorNodes(nodeIdMapCollection, nodeIds)) {
        if (!isPositionAfterXorNode(position, nodeIdMapCollection, xorNode)) {
            if (bestMatch === undefined) {
                bestMatch = {
                    rightMostNode: xorNode,
                    nodeTokenRange: NodeIdMapUtils.xorNodeTokenRange(nodeIdMapCollection, xorNode),
                };
            } else {
                const potentialTokenRange: NodeIdMap.XorNodeTokenRange = NodeIdMapUtils.xorNodeTokenRange(
                    nodeIdMapCollection,
                    xorNode,
                );
                // Since we've already proven xorNode is on or before position
                // we can use token indexes to compare nodes.
                //
                // Check if xorNode ends more to the right (higher token end value),
                // If the end points tie pick the one with a smaller range (higher token start value).
                // If the ranges tie pick the one one with the higher.
                let updateBestMatch: boolean = false;
                if (potentialTokenRange.tokenIndexEnd >= bestMatch.nodeTokenRange.tokenIndexEnd) {
                    if (potentialTokenRange.tokenIndexStart < bestMatch.nodeTokenRange.tokenIndexStart) {
                        updateBestMatch = true;
                    } else if (
                        potentialTokenRange.tokenIndexStart === bestMatch.nodeTokenRange.tokenIndexStart &&
                        xorNode.node.id > bestMatch.rightMostNode.node.id
                    ) {
                        updateBestMatch = true;
                    }
                }

                if (updateBestMatch) {
                    bestMatch = {
                        rightMostNode: xorNode,
                        nodeTokenRange: potentialTokenRange,
                    };
                }
            }
        }
    }

    return bestMatch !== undefined ? bestMatch.rightMostNode : undefined;
}

function visitNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): void {
    const visitedNodes: IInspectedNode[] = state.result.keywordVisitedNodes as IInspectedNode[];
    visitedNodes.push(InspectionUtils.inspectedVisitedNodeFrom(xorNode));

    if (state.isKeywordInspectionDone) {
        return;
    } else if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        state.isKeywordInspectionDone = true;
        return;
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.kind) {
        case Ast.NodeKind.ErrorHandlingExpression:
            updateKeywordResult(state, contextNode, visitErrorHandlingExpression);
            break;

        case Ast.NodeKind.ErrorRaisingExpression:
            updateKeywordResult(state, contextNode, visitErrorRaisingExpression);
            break;

        case Ast.NodeKind.IfExpression:
            updateKeywordResult(state, contextNode, visitIfExpression);
            break;

        case Ast.NodeKind.OtherwiseExpression:
            updateKeywordResult(state, contextNode, visitOtherwiseExpression);
            break;

        default:
            break;
    }
}

const DefaultKeywordInspection: KeywordInspected = {
    keywordVisitedNodes: [],
    allowedKeywords: TExpressionKeywords,
    maybeRequiredKeyword: undefined,
};

function updateKeywordResult(
    state: KeywordState,
    contextNode: ParserContext.Node,
    fn: (state: KeywordState, contextNode: ParserContext.Node) => [ReadonlyArray<string>, Option<string>],
): void {
    const [allowedKeywords, maybeRequiredKeyword] = fn(state, contextNode);
    const result: TypeUtils.StripReadonly<KeywordInspected> = state.result;
    result.allowedKeywords = allowedKeywords;
    result.maybeRequiredKeyword = maybeRequiredKeyword;

    if (maybeRequiredKeyword !== undefined) {
        state.isKeywordInspectionDone = true;
    }
}

function visitErrorHandlingExpression(
    _state: KeywordState,
    contextNode: ParserContext.Node,
): [ReadonlyArray<string>, Option<string>] {
    switch (contextNode.attributeCounter) {
        // `try`
        case 0:
        case 1:
            return [[], KeywordKind.Try];

        // protectedExpression
        case 2:
            return [TExpressionKeywords, undefined];

        // `maybeOtherwiseExpression`
        default:
            throw expectedEarlierAssignment(contextNode);
    }
}

function visitErrorRaisingExpression(
    _state: KeywordState,
    contextNode: ParserContext.Node,
): [ReadonlyArray<string>, Option<string>] {
    switch (contextNode.attributeCounter) {
        // `error`
        case 0:
        case 1:
            return [[], KeywordKind.Error];

        // protectedExpression
        case 2:
            return [TExpressionKeywords, undefined];

        // `maybeOtherwiseExpression`
        default:
            throw expectedEarlierAssignment(contextNode);
    }
}

function visitIfExpression(
    _state: KeywordState,
    contextNode: ParserContext.Node,
): [ReadonlyArray<string>, Option<string>] {
    switch (contextNode.attributeCounter) {
        // `if`
        case 0:
        case 1:
            return [[], KeywordKind.If];

        // condition
        case 2:
            return [TExpressionKeywords, undefined];

        // `then`
        case 3:
            return [[], KeywordKind.Then];

        // trueExpression
        case 4:
            return [TExpressionKeywords, undefined];

        // `else`
        case 5:
            return [[], KeywordKind.Else];

        // falseExpression
        case 6:
            return [TExpressionKeywords, undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitOtherwiseExpression(
    _state: KeywordState,
    contextNode: ParserContext.Node,
): [ReadonlyArray<string>, Option<string>] {
    switch (contextNode.attributeCounter) {
        // `otherwise`
        case 0:
        case 1:
            return [[], KeywordKind.Otherwise];

        // paired
        case 2:
            return [TExpressionKeywords, undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function expectedEarlierAssignment(contextNode: ParserContext.Node): CommonError.InvariantError {
    const details: {} = {
        id: contextNode.id,
        kind: contextNode.kind,
        attributeCounter: contextNode.attributeCounter,
    };
    return new CommonError.InvariantError(`expected an earlier visitNode to set isKeywordInspectionDone`, details);
}

function invalidAttributeCount(contextNode: ParserContext.Node): CommonError.InvariantError {
    const details: {} = {
        id: contextNode.id,
        kind: contextNode.kind,
        attributeCounter: contextNode.attributeCounter,
    };
    return new CommonError.InvariantError(
        `ParserContext.Node should never have reached the found attribute index`,
        details,
    );
}
