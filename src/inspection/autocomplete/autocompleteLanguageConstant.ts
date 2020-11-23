// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Ast, Constant } from "../../language";
import { AncestryUtils, IParseState, TXorNode, XorNodeKind } from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { AutocompleteLanguageConstant, TriedAutocompleteLanguageConstant } from "./commonTypes";

export function tryAutocompleteLanguageConstant<S extends IParseState = IParseState>(
    parseSettings: ParseSettings<S>,
    maybeActiveNode: TMaybeActiveNode,
): TriedAutocompleteLanguageConstant {
    return ResultUtils.ensureResult(parseSettings.locale, () => {
        return autocompleteLanguageConstant(maybeActiveNode);
    });
}

// Currently only checks "optional" constant in FunctionExpression.
function autocompleteLanguageConstant(maybeActiveNode: TMaybeActiveNode): AutocompleteLanguageConstant | undefined {
    if (ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        const maybeFunctionExpressionAncestryIndex: number | undefined = AncestryUtils.maybeFirstIndexOfNodeKind(
            maybeActiveNode.ancestry,
            Ast.NodeKind.FunctionExpression,
        );
        if (maybeFunctionExpressionAncestryIndex !== undefined) {
            return inspectFunctionExpression(maybeActiveNode, maybeFunctionExpressionAncestryIndex);
        }
    }

    return undefined;
}

function inspectFunctionExpression(
    activeNode: ActiveNode,
    functionExpressionAncestryIndex: number,
): AutocompleteLanguageConstant | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const functionExpressionChild: TXorNode = AncestryUtils.assertGetPreviousXor(
        ancestry,
        functionExpressionAncestryIndex,
        [Ast.NodeKind.ParameterList, Ast.NodeKind.AsNullablePrimitiveType, Ast.NodeKind.Constant],
    );
    if (functionExpressionChild.node.kind !== Ast.NodeKind.ParameterList) {
        return undefined;
    }

    const maybeParameter: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
        ancestry,
        functionExpressionAncestryIndex,
        4,
    );
    if (maybeParameter === undefined || maybeParameter.node.kind !== Ast.NodeKind.Parameter) {
        return undefined;
    }
    const childOfParameter: TXorNode = AncestryUtils.assertGetNthPreviousXor(
        ancestry,
        functionExpressionAncestryIndex,
        5,
    );
    if (
        // If position is in an already parsed `optional` constant.
        // `(optional foo as 1|
        childOfParameter.node.maybeAttributeIndex === 0 ||
        // If position is in AsNullablePrimitiveType
        // `(foo as |`
        childOfParameter.node.maybeAttributeIndex === 2
    ) {
        return undefined;
    }
    const name: TXorNode = childOfParameter;
    if (name.kind === XorNodeKind.Context) {
        return [Constant.LanguageConstantKind.Optional];
    }

    const nameAst: Ast.Identifier = childOfParameter.node as Ast.Identifier;
    const nameLiteral: string = nameAst.literal;
    if (
        PositionUtils.isInAst(activeNode.position, nameAst, false, true) &&
        Constant.LanguageConstantKind.Optional.startsWith(nameLiteral) &&
        Constant.LanguageConstantKind.Optional.length !== nameLiteral.length
    ) {
        return [Constant.LanguageConstantKind.Optional];
    }

    return undefined;
}
