// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, ResultKind, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { KeywordKind } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import * as InspectionUtils from "./inspectionUtils";
import { IInspectedVisitedNode } from "./node";
import { Position } from "./position";
import { KeywordInspected, KeywordState } from "./state";

// if   no parent: exit
// elif parent is ast: exit
// else examing parent's child where child attribute is n+1

interface ExaminableNodes {
    readonly initial: Ast.TNode;
    readonly parent: ParserContext.Node;
    readonly sibling: ParserContext.Node;
}

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedTraverse<KeywordInspected> {
    const maybeExaminableNodes: Option<ExaminableNodes> = maybeGetExaminableNodes(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (maybeExaminableNodes === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultKeywordInspection,
        };
    }
    const examinableNodes: ExaminableNodes = maybeExaminableNodes;

    return {
        kind: ResultKind.Ok,
        value: DefaultKeywordInspection,
    };
}

// Grab the closest leaf next position then try to find the leaf's sibling.
// If the sibling is a ParserContext.Node instance then return { leaf, parent, sibling},
// otherwise return undefined;
function maybeGetExaminableNodes(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<ExaminableNodes> {
    const maybeLeafAstNode: Option<Ast.TNode> = InspectionUtils.maybeClosestAstNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (maybeLeafAstNode === undefined) {
        return undefined;
    }
    const leafAstNode: Ast.TNode = maybeLeafAstNode;

    if (leafAstNode.maybeAttributeIndex === undefined) {
        return undefined;
    }

    const maybeParentContextNode: Option<ParserContext.Node> = NodeIdMap.maybeParentContextNode(
        nodeIdMapCollection,
        leafAstNode.id,
    );
    if (maybeParentContextNode === undefined) {
        return undefined;
    }
    const parentContextNode: ParserContext.Node = maybeParentContextNode;

    NodeIdMap.maybeContextChildByAttributeIndex(
        nodeIdMapCollection,
        parentContextNode.id,
        leafAstNode.maybeAttributeIndex + 1,
        undefined,
    );

    const maybeSibling: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeNextSiblingXorNode(
        nodeIdMapCollection,
        leafAstNode.id,
    );
    if (maybeSibling === undefined || maybeSibling.kind === NodeIdMap.XorNodeKind.Ast) {
        return undefined;
    }

    return {
        initial: leafAstNode,
        parent: parentContextNode,
        sibling: maybeSibling.node,
    };
}

function visitNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): void {
    const visitedNodes: IInspectedVisitedNode[] = state.result.keywordVisitedNodes as IInspectedVisitedNode[];
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
    allowedKeywords: [],
    maybeRequiredKeyword: undefined,
};

const TExpressionKeywords: ReadonlyArray<KeywordKind> = [
    KeywordKind.Each,
    KeywordKind.Error,
    KeywordKind.False,
    KeywordKind.HashBinary,
    KeywordKind.HashDate,
    KeywordKind.HashDateTime,
    KeywordKind.HashDateTimeZone,
    KeywordKind.HashDuration,
    KeywordKind.HashInfinity,
    KeywordKind.HashNan,
    KeywordKind.HashTable,
    KeywordKind.HashTime,
    KeywordKind.If,
    KeywordKind.Let,
    KeywordKind.True,
    KeywordKind.Try,
];

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
