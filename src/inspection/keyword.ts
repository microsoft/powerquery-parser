// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option, ResultKind, Traverse, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { KeywordKind, TExpressionKeywords } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";
import { IInspectedNode } from "./node";
import { isPositionAfterXorNode, Position, isPositionAfterAstNode } from "./position";
import { KeywordInspected, KeywordState } from "./state";

import * as InspectionUtils from "./inspectionUtils";

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedTraverse<KeywordInspected> {
    // TODO: add root to nodeIdMapCollection
    const maybeRoot: Option<Ast.TNode> = NodeIdMapUtils.maybeRightMostLeafWhere(
        nodeIdMapCollection,
        Math.min(...nodeIdMapCollection.contextNodeById.keys(), ...nodeIdMapCollection.astNodeById.keys()),
        undefined,
    );
    if (maybeRoot === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultKeywordInspection,
        };
    }
    const root: Ast.TNode = translateRoot(nodeIdMapCollection, maybeRoot);

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
    // const root: NodeIdMap.TXorNode = maybeRoot;
    // return Traverse.tryTraverseXor(
    //     state,
    //     nodeIdMapCollection,
    //     root,
    //     Traverse.VisitNodeStrategy.BreadthFirst,
    //     visitNode,
    //     Traverse.maybeExpandXorParent,
    //     earlyExit,
    // );
}

interface MaybeRightMostXorNodeSearch {
    readonly rightMostNode: NodeIdMap.TXorNode;
    readonly nodeTokenRange: NodeIdMap.XorNodeTokenRange;
}

interface WrappedArrayBacktrack {
    // TCsv
    readonly csv: NodeIdMap.TXorNode;
    // TCsv.node
    readonly csvNode: NodeIdMap.TXorNode;
    // TCsv
    readonly maybeSibling: Option<NodeIdMap.TXorNode>;
}

const DefaultKeywordInspection: KeywordInspected = {
    keywordVisitedNodes: [],
    allowedKeywords: TExpressionKeywords,
    maybeRequiredKeyword: undefined,
};

interface Origin {
    readonly root: NodeIdMap.TXorNode;
    readonly originalRoot: Ast.TNode;
}

function translateRoot(nodeIdMapCollection: NodeIdMap.Collection, root: Ast.TNode): Origin {
    if (root.kind === Ast.NodeKind.Constant) {
        switch (root.literal) {
            case Ast.ConstantKind.Comma:
                return translateComma(nodeIdMapCollection, root);

            case Ast.ConstantKind.Equal:
                return translateEqual(nodeIdMapCollection, root);

            default:
                return {
                    root: {
                        kind: NodeIdMap.XorNodeKind.Ast,
                        node: root,
                    },
                    originalRoot: root,
                };
        }
    } else {
        return {
            root: {
                kind: NodeIdMap.XorNodeKind.Ast,
                node: root,
            },
            originalRoot: root,
        };
    }
}

function translateEqual(nodeIdMapCollection: NodeIdMap.Collection, originalRoot: Ast.TNode): Origin {
    const parent: NodeIdMap.TXorNode = NodeIdMapUtils.expectParentXorNode(nodeIdMapCollection, originalRoot.id);
    switch (parent.node.kind) {
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression: {
            const root: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
                nodeIdMapCollection,
                parent.node.id,
                originalRoot.maybeAttributeIndex! + 1,
                undefined,
            );
            return {
                root,
                originalRoot,
            };
        }

        default:
            throw invalidRootTranslate(translateEqual.name, originalRoot);
    }
}

function translateComma(nodeIdMapCollection: NodeIdMap.Collection, originalRoot: Ast.TNode): Origin {
    const parent: NodeIdMap.TXorNode = NodeIdMapUtils.expectParentXorNode(nodeIdMapCollection, originalRoot.id);
    if (parent.node.kind !== Ast.NodeKind.Csv) {
        throw invalidRootTranslate(translateComma.name, originalRoot);
    }

    const arrayWrapper: NodeIdMap.TXorNode = NodeIdMapUtils.expectParentXorNode(nodeIdMapCollection, parent.node.id);
    const siblingCsv: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
        nodeIdMapCollection,
        arrayWrapper.node.id,
        parent.node.maybeAttributeIndex! + 1,
        undefined,
    );
    const root: NodeIdMap.TXorNode = NodeIdMapUtils.leftMostXorNode(nodeIdMapCollection, siblingCsv.node.id);

    return {
        root,
        originalRoot,
    };
}

function visitNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): void {
    // Immediately add the visitedNode so that if it errors out we have a better trace.
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

        case Ast.NodeKind.InvokeExpression:
            updateKeywordResult(state, xorNode, visitWrappedExpressionArray);
            break;

        case Ast.NodeKind.ListExpression:
            updateKeywordResult(state, xorNode, visitWrappedExpressionArray);
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
        if (isPositionAfterXorNode(position, nodeIdMapCollection, xorNode)) {
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

function visitIfExpression(state: KeywordState, xorNode: NodeIdMap.TXorNode): [ReadonlyArray<string>, Option<string>] {
    if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
        return [[], undefined];
    }

    const previousInspected: IInspectedNode = previousInspectedNode(state);
    switch (previousInspected.maybeAttributeIndex) {
        // 'if'
        case 0:
            return [[], KeywordKind.If];
        // 'then'
        case 2:
            return [[], KeywordKind.Then];
        // 'else'
        case 4:
            return [[], KeywordKind.Else];

        case 1:
        case 3:
        case 5:
            return [TExpressionKeywords, undefined];

        default:
            throw invalidPreviousInspected(previousInspected);
    }
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

function visitWrappedExpressionArray(
    state: KeywordState,
    xorNode: NodeIdMap.TXorNode,
): [ReadonlyArray<string>, Option<string>] {
    const inspectedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;
    const maybePreviousInspected: Option<IInspectedNode> = inspectedNodes[inspectedNodes.length - 2];
    if (maybePreviousInspected === undefined) {
        const details: {} = { xorNodeId: xorNode.node.id };
        throw new CommonError.InvariantError(
            `should've had a child of either ${Ast.NodeKind.Constant} (open/close constant) or ${Ast.NodeKind.ArrayWrapper}.`,
            details,
        );
    }
    const previousInspected: IInspectedNode = maybePreviousInspected;
    const previousXorNode: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(
        state.nodeIdMapCollection,
        previousInspected.id,
    );
    // Open wrapper constant, first case
    if (previousXorNode.node.maybeAttributeIndex === 0) {
        return [TExpressionKeywords, undefined];
    }

    const maybeBacktrack: Option<WrappedArrayBacktrack> = maybeWrappedArrayBacktrack(state, xorNode);
    // Close wrapper constant
    if (maybeBacktrack === undefined) {
        return [[], undefined];
    }
    const backtrack: WrappedArrayBacktrack = maybeBacktrack;
    const csv: Option<NodeIdMap.TXorNode> = backtrack.csv;
    const maybeSibling: Option<NodeIdMap.TXorNode> = backtrack.maybeSibling;

    // Open wrapper constant, second case
    if (csv.node.maybeAttributeIndex === 0 && csv.kind === NodeIdMap.XorNodeKind.Context) {
        return [TExpressionKeywords, undefined];
    }

    if (maybeSibling === undefined) {
        switch (csv.kind) {
            // No next sibling, fully parsed.
            // Eg. '{1,|' or '{1|'
            case NodeIdMap.XorNodeKind.Ast: {
                const csvAstNode: Ast.TCsv = csv.node as Ast.TCsv;
                if (csvAstNode.maybeCommaConstant) {
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
                throw isNever(csv);
        }
    }
    // Has next sibling
    else {
        // case: Ast + Ast
        // '{1|,2' or '{1,|2'

        // case: Ast + Context
        // '{1,|' or '{1|,2 3' or '{1,|2 3'
        return [TExpressionKeywords, undefined];
    }
}

function maybeWrappedArrayBacktrack(state: KeywordState, xorNode: NodeIdMap.TXorNode): Option<WrappedArrayBacktrack> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const visitedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;

    const maybeArrayWrapper: Option<IInspectedNode> = visitedNodes[visitedNodes.length - 2];
    if (maybeArrayWrapper.kind !== Ast.NodeKind.ArrayWrapper) {
        return undefined;
    }
    const arrayWrapper: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, maybeArrayWrapper.id);

    const maybeInspectedCsv: Option<IInspectedNode> = visitedNodes[visitedNodes.length - 3];
    if (maybeInspectedCsv === undefined || maybeInspectedCsv.kind !== Ast.NodeKind.Csv) {
        const details: {} = { originalNodeId: xorNode.node.id };
        throw new CommonError.InvariantError(
            `shouldn't be able to reach here as ${Ast.NodeKind.Csv} should be closer to the root than ${Ast.NodeKind.ArrayWrapper}.`,
            details,
        );
    }
    const csv: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, maybeInspectedCsv.id);

    const maybeInspectedCsvNode: Option<IInspectedNode> = visitedNodes[visitedNodes.length - 4];
    if (maybeInspectedCsvNode === undefined) {
        const details: {} = { originalNodeId: xorNode.node.id };
        throw new CommonError.InvariantError(
            `shouldn't be able to reach here as ${Ast.NodeKind.Csv} should've been visited after its child.`,
            details,
        );
    }
    const csvNode: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, maybeInspectedCsvNode.id);

    return {
        csv,
        csvNode,
        maybeSibling: NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            arrayWrapper.node.id,
            csv.node.maybeAttributeIndex! + 1,
            undefined,
        ),
    };
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

function invalidPreviousInspected(previousInspected: IInspectedNode): CommonError.InvariantError {
    const details: {} = {
        id: previousInspected.id,
        kind: previousInspected.kind,
        attributeCounter: previousInspected.maybeAttributeIndex,
    };
    return new CommonError.InvariantError(`Unable to continue based on the previously inspected node`, details);
}

function invalidRootTranslate(fnName: string, originalRoot: Ast.TNode): CommonError.InvariantError {
    const details: {} = {
        nodeId: originalRoot.id,
        nodeKind: originalRoot.kind,
    };
    return new CommonError.InvariantError(`Unknown nodeKind for ${fnName}`, details);
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

function maybePreviousInspectedNode(state: KeywordState): Option<IInspectedNode> {
    const inspectedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;
    return inspectedNodes[inspectedNodes.length - 2];
}

function previousInspectedNode(state: KeywordState): IInspectedNode {
    const maybeInspected: Option<IInspectedNode> = maybePreviousInspectedNode(state);
    if (maybeInspected === undefined) {
        throw new CommonError.InvariantError("must have at least 2 inspected nodes");
    }
    return maybeInspected;
}
