// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, /*isNever,*/ Option, ResultKind, Traverse, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { KeywordKind, TExpressionKeywords } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";
import { IInspectedNode } from "./node";
import { isPositionBeforeXorNode, Position } from "./position";
import { KeywordInspected, KeywordState } from "./state";

import * as InspectionUtils from "./inspectionUtils";

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedTraverse<KeywordInspected> {
    const maybeRoot: Option<NodeIdMap.TXorNode> = maybeRightMostXorNode(position, nodeIdMapCollection, leafNodeIds);
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
        earlyExit,
    );
}

interface MaybeRightMostXorNodeSearch {
    readonly rightMostNode: NodeIdMap.TXorNode;
    readonly nodeTokenRange: NodeIdMap.XorNodeTokenRange;
}

const DefaultKeywordInspection: KeywordInspected = {
    keywordVisitedNodes: [],
    allowedKeywords: TExpressionKeywords,
    maybeRequiredKeyword: undefined,
};

function visitNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): void {
    const visitedNodes: IInspectedNode[] = state.result.keywordVisitedNodes as IInspectedNode[];
    visitedNodes.push(InspectionUtils.inspectedVisitedNodeFrom(xorNode));

    switch (xorNode.node.kind) {
        case Ast.NodeKind.ErrorHandlingExpression:
            updateKeywordResult(state, xorNode, visitErrorHandlingExpression);
            break;

        case Ast.NodeKind.ErrorRaisingExpression:
            updateKeywordResult(state, xorNode, visitErrorRaisingExpression);
            break;

        case Ast.NodeKind.IdentifierPairedExpression:
            updateKeywordResult(state, xorNode, visitIdentifierPairedExpression);
            break;

        case Ast.NodeKind.IfExpression:
            updateKeywordResult(state, xorNode, visitIfExpression);
            break;

        case Ast.NodeKind.ListExpression:
            updateKeywordResult(state, xorNode, visitListExpression);
            break;

        case Ast.NodeKind.OtherwiseExpression:
            updateKeywordResult(state, xorNode, visitOtherwiseExpression);
            break;

        case Ast.NodeKind.ParenthesizedExpression:
            updateKeywordResult(state, xorNode, visitParenthesizedExpression);
            break;

        case Ast.NodeKind.RangeExpression:
            updateKeywordResult(state, xorNode, visitRangeExpression);
            break;

        case Ast.NodeKind.SectionMember:
            updateKeywordResult(state, xorNode, visitSectionMember);
            break;

        default:
            break;
    }
}

function earlyExit(state: KeywordState, _xorNode: NodeIdMap.TXorNode): boolean {
    return state.isKeywordInspectionDone;
}

function maybeRightMostXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    const nodeIds: ReadonlyArray<number> = [...nodeIdMapCollection.contextNodeById.keys(), ...leafNodeIds];
    let bestMatch: Option<MaybeRightMostXorNodeSearch>;

    for (const xorNode of NodeIdMapUtils.expectXorNodes(nodeIdMapCollection, nodeIds)) {
        if (!isPositionBeforeXorNode(position, xorNode)) {
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
                // If the ranges tie pick the one one with the larger node id as it was more recently created.
                let updateBestMatch: boolean = false;
                if (potentialTokenRange.tokenIndexEnd >= bestMatch.nodeTokenRange.tokenIndexEnd) {
                    if (potentialTokenRange.tokenIndexStart > bestMatch.nodeTokenRange.tokenIndexStart) {
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

function updateKeywordResult(
    state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
    fn: (state: KeywordState, xorNode: NodeIdMap.TXorNode) => [ReadonlyArray<string>, Option<string>],
): void {
    const [allowedKeywords, maybeRequiredKeyword]: [ReadonlyArray<string>, Option<string>] = fn(state, xorNode);
    const result: TypeUtils.StripReadonly<KeywordInspected> = state.result;
    result.allowedKeywords = allowedKeywords;
    result.maybeRequiredKeyword = maybeRequiredKeyword;

    if (maybeRequiredKeyword !== undefined) {
        state.isKeywordInspectionDone = true;
    }
}

function visitErrorHandlingExpression(
    state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[KeywordKind.Otherwise], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.attributeCounter) {
        // `try`
        case 0:
        case 1:
            return [[], KeywordKind.Try];

        // protectedExpression
        case 2:
            return [TExpressionKeywords, undefined];

        // maybeOtherwiseExpression
        case 3:
            return [state.result.allowedKeywords, state.result.maybeRequiredKeyword];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitErrorRaisingExpression(
    _state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.attributeCounter) {
        // `error`
        case 0:
        case 1:
            return [[], KeywordKind.Error];

        // protectedExpression
        case 2:
            return [TExpressionKeywords, undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitIdentifierPairedExpression(
    _state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.attributeCounter) {
        // key
        case 0:
        case 1:
            return [[], undefined];

        // '='
        case 2:
            return [[], undefined];

        // value
        case 3:
            return [TExpressionKeywords, undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitIfExpression(_state: KeywordState, xorNode: NodeIdMap.TXorNode): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

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

function visitListExpression(
    state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const maybeSourceCsv: Option<NodeIdMap.TXorNode> = maybePreviousCsvXorNode(state, xorNode);
    if (maybeSourceCsv === undefined) {
        return [[], undefined];
    }
    const sourceCsvXorNode: NodeIdMap.TXorNode = maybeSourceCsv;

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeCsvArrayXorNode: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeCsvArrayXorNode === undefined) {
        return [[], undefined];
    }
    const csvArrayXorNode: NodeIdMap.TXorNode = maybeCsvArrayXorNode;

    const maybeNextCsv: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        csvArrayXorNode.node.id,
        sourceCsvXorNode.node.maybeAttributeIndex! + 1,
        [Ast.NodeKind.Csv],
    );

    // It might not exist because
    if (maybeNextCsv === undefined) {
        switch (sourceCsvXorNode.kind) {
            // No next sibling, fully parsed.
            // Eg. '{1,|' or '{1|'
            case NodeIdMap.XorNodeKind.Ast: {
                const csv: Ast.TCsv = sourceCsvXorNode.node as Ast.TCsv;
                if (csv.maybeCommaConstant) {
                    return [TExpressionKeywords, undefined];
                } else {
                    return [[], undefined];
                }
            }

            // No next sibling, failed to parse.
            // Eg. '{|' or '{1| x'
            case NodeIdMap.XorNodeKind.Context:
                return [TExpressionKeywords, undefined];

            default:
                break;
        }
    }
    // Has next sibling
    else {
        const nextCsv: NodeIdMap.TXorNode = maybeNextCsv;
        const sourceCsvNode: Ast.TCsv = sourceCsvXorNode.node as Ast.TCsv;
    }
}

function maybePreviousCsvXorNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): Option<NodeIdMap.TXorNode> {
    const visitedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;
    const numVisitedNodes: number = visitedNodes.length;
    if (numVisitedNodes < 2) {
        return undefined;
    }

    for (let index: number = 0; index >= 0; index = numVisitedNodes - 2) {
        const potentialSource = visitedNodes[index];
        if (potentialSource.kind === Ast.NodeKind.Csv) {
            return NodeIdMapUtils.expectXorNode(state.nodeIdMapCollection, potentialSource.id);
        }
    }

    return undefined;

    // if (xorNode.node.kind !== Ast.NodeKind.Csv) {
    //     const details: {} = {
    //         nodeKind: xorNode.node.kind,
    //         nodeId: xorNode.node.id,
    //     };
    //     throw new CommonError.InvariantError(`expected ${Ast.NodeKind.Csv} but got something else`, details);
    // }
}

function visitOtherwiseExpression(
    _state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

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

function visitParenthesizedExpression(
    _state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.attributeCounter) {
        // `(`
        case 0:
        case 1:
            return [[], undefined];

        // content
        case 2:
            return [TExpressionKeywords, undefined];

        // ')'
        case 3:
            return [[], undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitRangeExpression(
    _state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.attributeCounter) {
        // left
        case 0:
        case 1:
            return [TExpressionKeywords, undefined];

        // '..'
        case 2:
            return [[], undefined];

        // right
        case 3:
            return [TExpressionKeywords, undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitSectionMember(state: KeywordState, xorNode: NodeIdMap.TXorNode): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;

    switch (contextNode.attributeCounter) {
        // maybeLiteralAttributes
        case 0:
        case 1:
            return [[], undefined];

        // maybeSharedConstant
        case 2:
            return [[KeywordKind.Shared], undefined];

        // namePairedExpression
        case 3: {
            const xorAttributeChild: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
                state.nodeIdMapCollection,
                contextNode.id,
                2,
                [Ast.NodeKind.IdentifierPairedExpression],
            );
            return visitSectionMemberIdentifierPairedExpression(state, xorAttributeChild);
        }

        // ';'
        case 4:
            return [[], undefined];

        default:
            throw invalidAttributeCount(contextNode);
    }
}

function visitSectionMemberIdentifierPairedExpression(
    _state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }
    const contextNode: ParserContext.Node = xorNode.node;
    const attributeCounter: number = contextNode.attributeCounter;
    // Failed to parse an identifier, meaning the optional 'shared' constant is available.
    if (attributeCounter === 0 || attributeCounter === 1) {
        return [[KeywordKind.Shared], undefined];
    } else {
        return visitIdentifierPairedExpression(_state, xorNode);
    }
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
