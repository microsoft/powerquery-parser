// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { KeywordKind, TExpressionKeywords } from "../lexer";
import { Ast, NodeIdMap } from "../parser";
import { ActiveNode } from "./activeNode";
import { PositionUtils } from "./position";

export interface AutocompleteInspected {
    readonly maybeRequiredAutocomplete: Option<string>;
    readonly allowedAutocompleteKeywords: ReadonlyArray<KeywordKind>;
}

export function tryFrom(maybeActiveNode: Option<ActiveNode>): Result<AutocompleteInspected, CommonError.CommonError> {
    if (maybeActiveNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: ExpressionAutocomplete,
        };
    }

    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    const numNodes: number = ancestry.length;
    let maybeInspected: Option<AutocompleteInspected>;

    try {
        for (let index: number = 1; index < numNodes; index += 1) {
            const child: NodeIdMap.TXorNode = ancestry[index - 1];
            const parent: NodeIdMap.TXorNode = ancestry[index];
            const mapKey: string = createMapKey(parent.node.kind, child.node.maybeAttributeIndex);

            // If a node is in a context state then it should be up to the parent to autocomplete.
            // Continue to let a later iteration handle autocomplete.
            if (
                parent.kind === NodeIdMap.XorNodeKind.Context &&
                PositionUtils.isOnContextNodeStart(activeNode.position, parent.node)
            ) {
                continue;
            }

            const maybeEdgeCaseFn: Option<TAutocompleteFn> = AutocompleteEdgeCaseMap.get(mapKey);
            if (maybeEdgeCaseFn) {
                maybeInspected = maybeEdgeCaseFn(activeNode, index);
            } else {
                maybeInspected = AutocompleteMap.get(mapKey);
            }

            if (maybeInspected !== undefined) {
                break;
            }
        }
    } catch (err) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(err),
        };
    }

    return {
        kind: ResultKind.Ok,
        value: maybeInspected !== undefined ? maybeInspected : EmptyAutocomplete,
    };
}

type TAutocompleteFn = (activeNode: ActiveNode, currentIndex: number) => Option<AutocompleteInspected>;

const EmptyAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: [],
};

const ErrorHandlingExpressionAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: [...TExpressionKeywords, KeywordKind.Otherwise],
};

const ExpressionAutocomplete: AutocompleteInspected = {
    maybeRequiredAutocomplete: undefined,
    allowedAutocompleteKeywords: TExpressionKeywords,
};

const AutocompleteEdgeCaseMap: Map<string, TAutocompleteFn> = new Map([]);

const AutocompleteMap: Map<string, AutocompleteInspected> = new Map([
    // Ast.NodeKind.ErrorHandlingExpression
    [createMapKey(Ast.NodeKind.ErrorHandlingExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.Try)],
    [createMapKey(Ast.NodeKind.ErrorHandlingExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.ErrorHandlingExpression, 2), ErrorHandlingExpressionAutocomplete],

    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.Error)],
    [createMapKey(Ast.NodeKind.ErrorRaisingExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.GeneralizedIdentifierPairedExpression
    [createMapKey(Ast.NodeKind.GeneralizedIdentifierPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IdentifierPairedExpression
    [createMapKey(Ast.NodeKind.IdentifierPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IdentifierExpressionPairedExpression
    [createMapKey(Ast.NodeKind.IdentifierExpressionPairedExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.IfExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.If)],
    [createMapKey(Ast.NodeKind.IfExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.IfExpression, 2), autocompleteConstantFactory(Ast.ConstantKind.Then)],
    [createMapKey(Ast.NodeKind.IfExpression, 3), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.IfExpression, 4), autocompleteConstantFactory(Ast.ConstantKind.Else)],
    [createMapKey(Ast.NodeKind.IfExpression, 5), ExpressionAutocomplete],

    // Ast.NodeKind.InvokeExpression
    [createMapKey(Ast.NodeKind.InvokeExpression, 0), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.InvokeExpression, 1), ExpressionAutocomplete],
    [createMapKey(Ast.NodeKind.InvokeExpression, 2), ExpressionAutocomplete],

    // Ast.NodeKind.IfExpression
    [createMapKey(Ast.NodeKind.ListExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.ParenthesizedExpression
    [createMapKey(Ast.NodeKind.ParenthesizedExpression, 1), ExpressionAutocomplete],
]);

// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: Option<number>): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}

function autocompleteConstantFactory(constantKind: Ast.ConstantKind): AutocompleteInspected {
    return {
        maybeRequiredAutocomplete: constantKind,
        allowedAutocompleteKeywords: [],
    };
}
