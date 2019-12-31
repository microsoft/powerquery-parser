// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, ResultKind } from "../common";
import { TriedTraverse } from "../common/traversal";
import { KeywordKind, TExpressionKeywords, TokenPosition } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";
import { Position, PositionUtils } from "./position";
import { TPositionIdentifier } from "./positionIdentifier";
import { AutocompleteInspected } from "./state";

export function tryFrom(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
    maybeIdentifierUnderPosition: Option<TPositionIdentifier>,
): TriedTraverse<AutocompleteInspected> {
    const maybeRoot: Option<NodeIdMap.TXorNode> = maybeAutocompleteRoot(position, nodeIdMapCollection, leafNodeIds);
    if (maybeRoot === undefined) {
        return {
            kind: ResultKind.Ok,
            value: ExpressionAutocomplete,
        };
    }
    const root: NodeIdMap.TXorNode = maybeRoot;
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = NodeIdMapUtils.expectAncestry(
        nodeIdMapCollection,
        root.node.id,
    );

    const maybeSearch: Option<AutocompleteFnSearch> = maybeAutocompleteFn(ancestry);
    if (maybeSearch === undefined) {
        return {
            kind: ResultKind.Ok,
            value: EmptyAutocomplete,
        };
    }
    const search: AutocompleteFnSearch = maybeSearch;

    const state: AutocompleteState = {
        nodeIdMapCollection,
        position,
        maybeIdentifierUnderPosition,
        ancestry,
        triggerAncestor: search.triggerAncestor,
        triggerAncestorIndex: search.triggerAncestorIndex,
    };
    try {
        return {
            kind: ResultKind.Ok,
            value: search.fn(state),
        };
    } catch (e) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(e),
        };
    }
}

type TAutocompleteFn = (state: AutocompleteState) => AutocompleteInspected;

interface AutocompleteFnSearch {
    readonly fn: TAutocompleteFn;
    readonly triggerAncestor: NodeIdMap.TXorNode;
    readonly triggerAncestorIndex: number;
}

interface AutocompleteState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly position: Position;
    readonly maybeIdentifierUnderPosition: Option<TPositionIdentifier>;
    readonly ancestry: ReadonlyArray<NodeIdMap.TXorNode>;
    readonly triggerAncestor: NodeIdMap.TXorNode;
    readonly triggerAncestorIndex: number;
}

interface RootSearch {
    readonly maybeAstNode: Option<Ast.TNode>;
    readonly maybeContextNode: Option<ParserContext.Node>;
}

const EmptyAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: [],
};

const ExpressionAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: TExpressionKeywords,
};

function maybeAutocompleteFn(ancestry: ReadonlyArray<NodeIdMap.TXorNode>): Option<AutocompleteFnSearch> {
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const ancestor: NodeIdMap.TXorNode = ancestry[index];
        switch (ancestor.node.kind) {
            case Ast.NodeKind.ErrorRaisingExpression:
                return {
                    fn: autocompleteErrorRaisingExpression,
                    triggerAncestor: ancestor,
                    triggerAncestorIndex: index,
                };

            case Ast.NodeKind.IfExpression:
                return {
                    fn: autocompleteIfExpression,
                    triggerAncestorIndex: index,
                    triggerAncestor: ancestor,
                };

            case Ast.NodeKind.ListExpression:
                return {
                    fn: autocompleteListExpression,
                    triggerAncestorIndex: index,
                    triggerAncestor: ancestor,
                };

            default:
                break;
        }
    }

    return undefined;
}

function autocompleteErrorRaisingExpression(state: AutocompleteState): AutocompleteInspected {
    const previousAncestor: NodeIdMap.TXorNode = expectPreviousAncestor(state);

    // '|if'
    if (
        previousAncestor.node.maybeAttributeIndex === 0 &&
        PositionUtils.isOnXorNodeStart(state.position, previousAncestor)
    ) {
        return createExpressionAutocomplete(state);
    }

    switch (previousAncestor.node.maybeAttributeIndex) {
        // 'error'
        case 0:
            return createRequiredAutcomplete(state, previousAncestor, Ast.ConstantKind.Error);

        // error-raising-expression
        case 1:
            return createExpressionAutocomplete(state);

        default:
            throw unknownAttributeIndex(state.triggerAncestor);
    }
}

function autocompleteIfExpression(state: AutocompleteState): AutocompleteInspected {
    const previousAncestor: NodeIdMap.TXorNode = expectPreviousAncestor(state);

    // '|if'
    if (
        previousAncestor.node.maybeAttributeIndex === 0 &&
        PositionUtils.isOnXorNodeStart(state.position, previousAncestor)
    ) {
        return createExpressionAutocomplete(state);
    }

    switch (previousAncestor.node.maybeAttributeIndex) {
        // 'if'
        case 0:
            return createRequiredAutcomplete(state, previousAncestor, Ast.ConstantKind.If);

        // condition-expression
        case 1:
            return createExpressionAutocomplete(state);

        // 'then'
        case 2:
            return createRequiredAutcomplete(state, previousAncestor, Ast.ConstantKind.Then);

        // true-expression
        case 3:
            return createExpressionAutocomplete(state);

        // 'else'
        case 4:
            return createRequiredAutcomplete(state, previousAncestor, Ast.ConstantKind.Else);

        // false-condition
        case 5:
            return createExpressionAutocomplete(state);

        default:
            throw unknownAttributeIndex(previousAncestor);
    }
}

function autocompleteListExpression(state: AutocompleteState): AutocompleteInspected {
    const previousAncestor: NodeIdMap.TXorNode = expectPreviousAncestor(state);
    const previousAttributeIndex: Option<number> = previousAncestor.node.maybeAttributeIndex;
    const position: Position = state.position;

    // '|{'
    if (previousAttributeIndex === 0 && PositionUtils.isOnXorNodeStart(position, previousAncestor)) {
        return createExpressionAutocomplete(state);
    }
    // '}|'
    if (previousAttributeIndex === 2 && PositionUtils.isOnXorNodeEnd(position, previousAncestor)) {
        return EmptyAutocomplete;
    }

    const arrayWrapper: NodeIdMap.TXorNode = previousAncestor;
    const csv: NodeIdMap.TXorNode = expectPreviousAncestor(state, 2);
    const csvNode: NodeIdMap.TXorNode = expectPreviousAncestor(state, 3);
    const numElements: number = state.nodeIdMapCollection.childIdsById.get(arrayWrapper.node.id)!.length;
    const isCsvLastElement: boolean = csv.node.maybeAttributeIndex === numElements - 1;

    throw new Error();
}

function unknownAttributeIndex(xorNode: NodeIdMap.TXorNode): CommonError.InvariantError {
    const details: {} = {
        id: xorNode.node.id,
        kind: xorNode.node.kind,
        maybeAttributeIndex: xorNode.node.maybeAttributeIndex,
    };
    return new CommonError.InvariantError(`node has an attribute index that we don't know how to handle`, details);
}

function maybePreviousAncestor(state: AutocompleteState, nth: number = 1): Option<NodeIdMap.TXorNode> {
    return state.ancestry[state.triggerAncestorIndex - nth];
}

function expectPreviousAncestor(state: AutocompleteState, nth: number = 1): NodeIdMap.TXorNode {
    const maybeAncestor: Option<NodeIdMap.TXorNode> = maybePreviousAncestor(state, nth);
    if (maybeAncestor === undefined) {
        const details: {} = { triggerAncestorIndex: state.triggerAncestorIndex };
        throw new CommonError.InvariantError("expected to find the trigger ancestor", details);
    }
    return maybeAncestor;
}

function createAutocomplete(
    _state: AutocompleteState,
    allowedKeywords: ReadonlyArray<KeywordKind>,
    maybeRequired: Option<string> = undefined,
): AutocompleteInspected {
    return {
        allowedAutocompleteKeywords: allowedKeywords,
        maybeRequiredAutocomplete: maybeRequired,
    };
}

function createRequiredAutcomplete(
    state: AutocompleteState,
    requiredNode: NodeIdMap.TXorNode,
    required: string,
): AutocompleteInspected {
    const maybeRequiredAutocomplete: Option<string> = PositionUtils.isOnXorNodeEnd(state.position, requiredNode)
        ? undefined
        : required;

    return {
        allowedAutocompleteKeywords: [],
        maybeRequiredAutocomplete,
    };
}

function createExpressionAutocomplete(state: AutocompleteState): AutocompleteInspected {
    return createAutocomplete(state, TExpressionKeywords, undefined);
}

function maybeAutocompleteRoot(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    const search: RootSearch = rootSearch(position, nodeIdMapCollection, leafNodeIds);
    if (search.maybeAstNode !== undefined) {
        if (search.maybeContextNode !== undefined) {
            const astNode: Ast.TNode = search.maybeAstNode;
            const astPositionEnd: TokenPosition = astNode.tokenRange.positionEnd;
            if (
                astPositionEnd.lineNumber === position.lineNumber &&
                astPositionEnd.lineCodeUnit === position.lineCodeUnit
            ) {
                return NodeIdMapUtils.xorNodeFromAst(astNode);
            } else {
                return NodeIdMapUtils.xorNodeFromContext(search.maybeContextNode);
            }
        } else {
            return NodeIdMapUtils.xorNodeFromAst(search.maybeAstNode);
        }
    } else {
        if (search.maybeContextNode !== undefined) {
            return NodeIdMapUtils.xorNodeFromContext(search.maybeContextNode);
        } else {
            return undefined;
        }
    }
}

function rootSearch(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): RootSearch {
    let maybeBestAstNode: Option<Ast.TNode>;
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        if (PositionUtils.isAfterAstNode(position, candidate)) {
            if (maybeBestAstNode === undefined) {
                maybeBestAstNode = candidate;
            }
            const bestAstNode: Ast.TNode = maybeBestAstNode;
            const bestTokenIndexStart: number = bestAstNode.tokenRange.tokenIndexStart;
            const candidateTokenIndexStart: number = candidate.tokenRange.tokenIndexStart;

            if (
                candidateTokenIndexStart > bestTokenIndexStart ||
                (candidateTokenIndexStart === bestTokenIndexStart && candidate.id < bestAstNode.id)
            ) {
                maybeBestAstNode = candidate;
            }
        }
    }

    let maybeBestContextNode: Option<ParserContext.Node>;
    const contextNodeById: NodeIdMap.ContextNodeById = nodeIdMapCollection.contextNodeById;
    for (const candidate of contextNodeById.values()) {
        if (
            PositionUtils.isAfterContextNode(position, nodeIdMapCollection, candidate) ||
            PositionUtils.isOnContextNodeStart(position, candidate)
        ) {
            if (maybeBestContextNode === undefined) {
                maybeBestContextNode = candidate;
                continue;
            }
            const bestContextNode: ParserContext.Node = maybeBestContextNode;
            const bestTokenIndexStart: number = bestContextNode.tokenIndexStart;
            const candidateTokenIndexStart: number = candidate.tokenIndexStart;

            if (
                candidateTokenIndexStart > bestTokenIndexStart ||
                (candidateTokenIndexStart === bestTokenIndexStart && candidate.id > bestContextNode.id)
            ) {
                maybeBestContextNode = candidate;
            }
        }
    }

    return {
        maybeAstNode: maybeBestAstNode,
        maybeContextNode: maybeBestContextNode,
    };
}

// function translateKeyValuePair(
//     nodeIdMapCollection: NodeIdMap.Collection,
//     ancestry: ReadonlyArray<NodeIdMap.TXorNode>,
//     offendingIndex: number,
// ): Option<NodeIdMap.TXorNode> {
//     const previous: NodeIdMap.TXorNode = ancestry[offendingIndex - 1];
//     // If the trigger wasn't a '=' constant then no translation should take place.
//     if (previous.node.maybeAttributeIndex !== 1) {
//         return undefined;
//     }

//     const keyValuePair: NodeIdMap.TXorNode = ancestry[offendingIndex];
//     switch (keyValuePair.node.kind) {
//         case Ast.NodeKind.EqualityExpression:
//         case Ast.NodeKind.FieldTypeSpecification:
//         case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
//         case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
//         case Ast.NodeKind.IdentifierExpressionPairedExpression:
//         case Ast.NodeKind.IdentifierPairedExpression: {
//             // Value portion of key-value-pair
//             return NodeIdMapUtils.expectXorChildByAttributeIndex(
//                 nodeIdMapCollection,
//                 keyValuePair.node.id,
//                 2,
//                 undefined,
//             );
//         }

//         default:
//             throw invalidRootTranslate(translateKeyValuePair.name, keyValuePair);
//     }
// }

// function translateCsv(
//     nodeIdMapCollection: NodeIdMap.Collection,
//     ancestry: ReadonlyArray<NodeIdMap.TXorNode>,
//     offendingIndex: number,
// ): Option<NodeIdMap.TXorNode> {
//     const maybeCommaConstant: Option<NodeIdMap.TXorNode> = ancestry[offendingIndex - 1];
//     if (maybeCommaConstant === undefined || maybeCommaConstant.node.maybeAttributeIndex !== 1) {
//         return undefined;
//     }

//     const csv: NodeIdMap.TXorNode = ancestry[offendingIndex];
//     const arrayWrapper: NodeIdMap.TXorNode = NodeIdMapUtils.expectParentXorNode(nodeIdMapCollection, csv.node.id);
//     if (arrayWrapper.node.kind !== Ast.NodeKind.ArrayWrapper) {
//         throw invalidRootTranslate(translateCsv.name, csv);
//     }

//     // Sibling Csv
//     return NodeIdMapUtils.expectXorChildByAttributeIndex(
//         nodeIdMapCollection,
//         arrayWrapper.node.id,
//         csv.node.maybeAttributeIndex! + 1,
//         undefined,
//     );
// }

// function visitNode(state: KeywordState, xorNode: NodeIdMap.TXorNode): void {
//     // Immediately add the visitedNode so that if it errors out we have a better trace.
//     const visitedNodes: IInspectedNode[] = state.result.keywordVisitedNodes as IInspectedNode[];
//     visitedNodes.push(InspectionUtils.inspectedVisitedNodeFrom(xorNode));

//     switch (xorNode.node.kind) {
//         case Ast.NodeKind.ErrorHandlingExpression:
//             updateKeywordResult(state, xorNode, visitErrorHandlingExpression);
//             break;

//         case Ast.NodeKind.ErrorRaisingExpression:
//             updateKeywordResult(state, xorNode, visitErrorRaisingExpression);
//             break;

//         case Ast.NodeKind.IdentifierPairedExpression:
//             updateKeywordResult(state, xorNode, visitIdentifierPairedExpression);
//             break;

//         case Ast.NodeKind.IfExpression:
//             updateKeywordResult(state, xorNode, visitIfExpression);
//             break;

//         case Ast.NodeKind.InvokeExpression:
//             updateKeywordResult(state, xorNode, visitWrappedExpressionArray);
//             break;

//         case Ast.NodeKind.ListExpression:
//             updateKeywordResult(state, xorNode, visitWrappedExpressionArray);
//             break;

//         case Ast.NodeKind.OtherwiseExpression:
//             updateKeywordResult(state, xorNode, visitOtherwiseExpression);
//             break;

//         case Ast.NodeKind.ParenthesizedExpression:
//             updateKeywordResult(state, xorNode, visitParenthesizedExpression);
//             break;

//         case Ast.NodeKind.RangeExpression:
//             updateKeywordResult(state, xorNode, visitRangeExpression);
//             break;

//         case Ast.NodeKind.SectionMember:
//             updateKeywordResult(state, xorNode, visitSectionMember);
//             break;

//         default:
//             break;
//     }
// }

// function updateKeywordResult(
//     state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
//     fn: (state: KeywordState, xorNode: NodeIdMap.TXorNode) => [ReadonlyArray<string>, Option<string>],
// ): void {
//     const [allowedKeywords, maybeRequiredKeyword]: [ReadonlyArray<string>, Option<string>] = fn(state, xorNode);
//     const result: TypeUtils.StripReadonly<KeywordInspected> = state.result;
//     result.allowedKeywords = allowedKeywords;
//     result.maybeRequiredKeyword = maybeRequiredKeyword;

//     if (maybeRequiredKeyword !== undefined) {
//         state.isKeywordInspectionDone = true;
//     }
// }

// function visitErrorHandlingExpression(
//     state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[KeywordKind.Otherwise], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // `try`
//         case 0:
//         case 1:
//             return [[], KeywordKind.Try];

//         // protectedExpression
//         case 2:
//             return [TExpressionKeywords, undefined];

//         // maybeOtherwiseExpression
//         case 3:
//             return [state.result.allowedKeywords, state.result.maybeRequiredKeyword];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitErrorRaisingExpression(
//     _state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // `error`
//         case 0:
//         case 1:
//             return [[], KeywordKind.Error];

//         // protectedExpression
//         case 2:
//             return [TExpressionKeywords, undefined];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitIdentifierPairedExpression(
//     _state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // key
//         case 0:
//         case 1:
//             return [[], undefined];

//         // '='
//         case 2:
//             return [[], undefined];

//         // value
//         case 3:
//             return [TExpressionKeywords, undefined];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitIfExpression(state: KeywordState, xorNode: NodeIdMap.TXorNode): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }

//     const previousInspected: IInspectedNode = previousInspectedNode(state);
//     switch (previousInspected.maybeAttributeIndex) {
//         // 'if'
//         case 0:
//             return [[], KeywordKind.If];
//         // 'then'
//         case 2:
//             return [[], KeywordKind.Then];
//         // 'else'
//         case 4:
//             return [[], KeywordKind.Else];

//         case 1:
//         case 3:
//         case 5:
//             return [TExpressionKeywords, undefined];

//         default:
//             throw invalidPreviousInspected(previousInspected);
//     }
// }

// function visitOtherwiseExpression(
//     _state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // `otherwise`
//         case 0:
//         case 1:
//             return [[], KeywordKind.Otherwise];

//         // paired
//         case 2:
//             return [TExpressionKeywords, undefined];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitParenthesizedExpression(
//     _state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // `(`
//         case 0:
//         case 1:
//             return [[], undefined];

//         // content
//         case 2:
//             return [TExpressionKeywords, undefined];

//         // ')'
//         case 3:
//             return [[], undefined];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitRangeExpression(
//     _state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // left
//         case 0:
//         case 1:
//             return [TExpressionKeywords, undefined];

//         // '..'
//         case 2:
//             return [[], undefined];

//         // right
//         case 3:
//             return [TExpressionKeywords, undefined];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitSectionMember(state: KeywordState, xorNode: NodeIdMap.TXorNode): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;

//     switch (contextNode.attributeCounter) {
//         // maybeLiteralAttributes
//         case 0:
//         case 1:
//             return [[], undefined];

//         // maybeSharedConstant
//         case 2:
//             return [[KeywordKind.Shared], undefined];

//         // namePairedExpression
//         case 3: {
//             const xorAttributeChild: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
//                 state.nodeIdMapCollection,
//                 contextNode.id,
//                 2,
//                 [Ast.NodeKind.IdentifierPairedExpression],
//             );
//             return visitSectionMemberIdentifierPairedExpression(state, xorAttributeChild);
//         }

//         // ';'
//         case 4:
//             return [[], undefined];

//         default:
//             throw invalidAttributeCount(contextNode);
//     }
// }

// function visitWrappedExpressionArray(
//     state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     const inspectedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;
//     const maybePreviousInspected: Option<IInspectedNode> = inspectedNodes[inspectedNodes.length - 2];
//     if (maybePreviousInspected === undefined) {
//         const details: {} = { xorNodeId: xorNode.node.id };
//         throw new CommonError.InvariantError(
//             `should've had a child of either ${Ast.NodeKind.Constant} (open/close constant) or ${Ast.NodeKind.ArrayWrapper}.`,
//             details,
//         );
//     }
//     const previousInspected: IInspectedNode = maybePreviousInspected;
//     const previousXorNode: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(
//         state.nodeIdMapCollection,
//         previousInspected.id,
//     );
//     // Open wrapper constant, first case
//     if (previousXorNode.node.maybeAttributeIndex === 0) {
//         return [TExpressionKeywords, undefined];
//     }

//     const maybeBacktrack: Option<WrappedArrayBacktrack> = maybeWrappedArrayBacktrack(state, xorNode);
//     // Close wrapper constant
//     if (maybeBacktrack === undefined) {
//         return [[], undefined];
//     }
//     const backtrack: WrappedArrayBacktrack = maybeBacktrack;
//     const csv: Option<NodeIdMap.TXorNode> = backtrack.csv;
//     const maybeSibling: Option<NodeIdMap.TXorNode> = backtrack.maybeSibling;

//     // Open wrapper constant, second case
//     if (csv.node.maybeAttributeIndex === 0 && csv.kind === NodeIdMap.XorNodeKind.Context) {
//         return [TExpressionKeywords, undefined];
//     }

//     if (maybeSibling === undefined) {
//         switch (csv.kind) {
//             // No next sibling, fully parsed.
//             // Eg. '{1,|' or '{1|'
//             case NodeIdMap.XorNodeKind.Ast: {
//                 const csvAstNode: Ast.TCsv = csv.node as Ast.TCsv;
//                 if (csvAstNode.maybeCommaConstant) {
//                     return [TExpressionKeywords, undefined];
//                 } else {
//                     return [[], undefined];
//                 }
//             }

//             // No next sibling, failed to parse.
//             // Eg. '{|' or '{1| x'
//             case NodeIdMap.XorNodeKind.Context:
//                 return [TExpressionKeywords, undefined];

//             default:
//                 throw isNever(csv);
//         }
//     }
//     // Has next sibling
//     else {
//         // case: Ast + Ast
//         // '{1|,2' or '{1,|2'

//         // case: Ast + Context
//         // '{1,|' or '{1|,2 3' or '{1,|2 3'
//         return [TExpressionKeywords, undefined];
//     }
// }

// function maybeWrappedArrayBacktrack(state: KeywordState, xorNode: NodeIdMap.TXorNode): Option<WrappedArrayBacktrack> {
//     const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
//     const visitedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;

//     const maybeArrayWrapper: Option<IInspectedNode> = visitedNodes[visitedNodes.length - 2];
//     if (maybeArrayWrapper.kind !== Ast.NodeKind.ArrayWrapper) {
//         return undefined;
//     }
//     const arrayWrapper: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, maybeArrayWrapper.id);

//     const maybeInspectedCsv: Option<IInspectedNode> = visitedNodes[visitedNodes.length - 3];
//     if (maybeInspectedCsv === undefined || maybeInspectedCsv.kind !== Ast.NodeKind.Csv) {
//         const details: {} = { originalNodeId: xorNode.node.id };
//         throw new CommonError.InvariantError(
//             `shouldn't be able to reach here as ${Ast.NodeKind.Csv} should be closer to the root than ${Ast.NodeKind.ArrayWrapper}.`,
//             details,
//         );
//     }
//     const csv: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, maybeInspectedCsv.id);

//     const maybeInspectedCsvNode: Option<IInspectedNode> = visitedNodes[visitedNodes.length - 4];
//     if (maybeInspectedCsvNode === undefined) {
//         const details: {} = { originalNodeId: xorNode.node.id };
//         throw new CommonError.InvariantError(
//             `shouldn't be able to reach here as ${Ast.NodeKind.Csv} should've been visited after its child.`,
//             details,
//         );
//     }
//     const csvNode: NodeIdMap.TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, maybeInspectedCsvNode.id);

//     return {
//         csv,
//         csvNode,
//         maybeSibling: NodeIdMapUtils.maybeXorChildByAttributeIndex(
//             nodeIdMapCollection,
//             arrayWrapper.node.id,
//             csv.node.maybeAttributeIndex! + 1,
//             undefined,
//         ),
//     };
// }

// function visitSectionMemberIdentifierPairedExpression(
//     _state: KeywordState,
//     xorNode: NodeIdMap.TXorNode,
// ): [ReadonlyArray<string>, Option<string>] {
//     if (xorNode.kind === NodeIdMap.XorNodeKind.Ast) {
//         return [[], undefined];
//     }
//     const contextNode: ParserContext.Node = xorNode.node;
//     const attributeCounter: number = contextNode.attributeCounter;
//     // Failed to parse an identifier, meaning the optional 'shared' constant is available.
//     if (attributeCounter === 0 || attributeCounter === 1) {
//         return [[KeywordKind.Shared], undefined];
//     } else {
//         return visitIdentifierPairedExpression(_state, xorNode);
//     }
// }

// function invalidPreviousInspected(previousInspected: IInspectedNode): CommonError.InvariantError {
//     const details: {} = {
//         id: previousInspected.id,
//         kind: previousInspected.kind,
//         attributeCounter: previousInspected.maybeAttributeIndex,
//     };
//     return new CommonError.InvariantError(`Unable to continue based on the previously inspected node`, details);
// }

// function invalidRootTranslate(fnName: string, originalRoot: NodeIdMap.TXorNode): CommonError.InvariantError {
//     const details: {} = {
//         nodeId: originalRoot.node.id,
//         nodeKind: originalRoot.node.kind,
//     };
//     return new CommonError.InvariantError(`Unknown nodeKind for ${fnName}`, details);
// }

// function invalidAttributeCount(contextNode: ParserContext.Node): CommonError.InvariantError {
//     const details: {} = {
//         id: contextNode.id,
//         kind: contextNode.kind,
//         attributeCounter: contextNode.attributeCounter,
//     };
//     return new CommonError.InvariantError(
//         `ParserContext.Node should never have reached the found attribute index`,
//         details,
//     );
// }

// function maybePreviousInspectedNode(state: KeywordState): Option<IInspectedNode> {
//     const inspectedNodes: ReadonlyArray<IInspectedNode> = state.result.keywordVisitedNodes;
//     return inspectedNodes[inspectedNodes.length - 2];
// }

// function previousInspectedNode(state: KeywordState): IInspectedNode {
//     const maybeInspected: Option<IInspectedNode> = maybePreviousInspectedNode(state);
//     if (maybeInspected === undefined) {
//         throw new CommonError.InvariantError("must have at least 2 inspected nodes");
//     }
//     return maybeInspected;
// }
