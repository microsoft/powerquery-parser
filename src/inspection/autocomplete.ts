// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option, Result, ResultKind } from "../common";
import { KeywordKind, TExpressionKeywords } from "../lexer";
import { Ast, NodeIdMap } from "../parser";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
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

            // If a node is in a context state then it should be up to the parent to autocomplete.
            // Continue to let a later iteration handle autocomplete.
            if (
                parent.kind === NodeIdMap.XorNodeKind.Context &&
                PositionUtils.isOnContextNodeStart(activeNode.position, parent.node)
            ) {
                continue;
            }
            const autocompleteKey: string = createAutocompleteKey(parent.node.kind, child.node.maybeAttributeIndex);

            const maybeEdgeCaseFn: Option<TAutocompleteFn> = AutocompleteEdgeCaseMap.get(autocompleteKey);
            if (maybeEdgeCaseFn) {
                maybeInspected = maybeEdgeCaseFn(activeNode, index);
            } else {
                maybeInspected = AutocompleteMap.get(autocompleteKey);
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

const AutocompleteEdgeCaseMap: Map<string, TAutocompleteFn> = new Map([
    [createAutocompleteKey(Ast.NodeKind.InvokeExpression, 1), autocompleteInvokeExpression],
]);

const AutocompleteMap: Map<string, AutocompleteInspected> = new Map([
    // Ast.NodeKind.ErrorHandlingExpression
    [createAutocompleteKey(Ast.NodeKind.ErrorHandlingExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.Try)],
    [createAutocompleteKey(Ast.NodeKind.ErrorHandlingExpression, 1), ExpressionAutocomplete],
    [createAutocompleteKey(Ast.NodeKind.ErrorHandlingExpression, 2), ErrorHandlingExpressionAutocomplete],

    // Ast.NodeKind.ErrorRaisingExpression
    [
        createAutocompleteKey(Ast.NodeKind.ErrorRaisingExpression, 0),
        autocompleteConstantFactory(Ast.ConstantKind.Error),
    ],
    [createAutocompleteKey(Ast.NodeKind.ErrorRaisingExpression, 1), ExpressionAutocomplete],

    // Ast.NodeKind.IfExpression
    [createAutocompleteKey(Ast.NodeKind.IfExpression, 0), autocompleteConstantFactory(Ast.ConstantKind.If)],
    [createAutocompleteKey(Ast.NodeKind.IfExpression, 1), ExpressionAutocomplete],
    [createAutocompleteKey(Ast.NodeKind.IfExpression, 2), autocompleteConstantFactory(Ast.ConstantKind.Then)],
    [createAutocompleteKey(Ast.NodeKind.IfExpression, 3), ExpressionAutocomplete],
    [createAutocompleteKey(Ast.NodeKind.IfExpression, 4), autocompleteConstantFactory(Ast.ConstantKind.Else)],
    [createAutocompleteKey(Ast.NodeKind.IfExpression, 5), ExpressionAutocomplete],
]);

// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createAutocompleteKey(nodeKind: Ast.NodeKind, maybeAttributeIndex: Option<number>): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}

function autocompleteConstantFactory(constantKind: Ast.ConstantKind): AutocompleteInspected {
    return {
        allowedAutocompleteKeywords: [],
        maybeRequiredAutocomplete: constantKind,
    };
}

function autocompleteInvokeExpression(activeNode: ActiveNode, currentIndex: number): Option<AutocompleteInspected> {
    // Ignore the open and close brackets.
    if (ActiveNodeUtils.expectPreviousXorNode(activeNode, currentIndex).node.maybeAttributeIndex !== 1) {
        return undefined;
    }

    // InvokeExpression -> ArrayWrapper -> Csv -> node
    const innerNode: NodeIdMap.TXorNode = ActiveNodeUtils.expectPreviousXorNode(activeNode, currentIndex, 3, undefined);

    // Don't autocomplete if you're to the right of a Csv's comma constant.
    if (innerNode.node.maybeAttributeIndex === 1) {
        return undefined;
    }

    return ExpressionAutocomplete;
}
