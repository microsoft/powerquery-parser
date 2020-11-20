// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Ast, Constant } from "../../language";
import { AncestryUtils, IParseState, TXorNode, XorNodeKind } from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { PositionUtils, Position } from "../position";
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
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return undefined;
    }

    return maybeAutocompleteNullable(maybeActiveNode) || maybeAutocompleteOptional(maybeActiveNode);
}

function maybeAutocompleteNullable(activeNode: ActiveNode): AutocompleteLanguageConstant | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        let maybeNullable: AutocompleteLanguageConstant | undefined;
        switch (xorNode.node.kind) {
            case Ast.NodeKind.AsNullablePrimitiveType:
                maybeNullable = maybeAutocompleteNullableForAsNullablePrimitiveType(activeNode, index);
                break;

            case Ast.NodeKind.FunctionExpression:
                maybeNullable = maybeAutocompleteNullableForParameter(activeNode, xorNode);
                break;

            case Ast.NodeKind.PrimitiveType:
                maybeNullable = maybeAutocompleteNullableForPrimitiveType(activeNode, xorNode);
                break;

            default:
                maybeNullable = undefined;
        }

        if (maybeNullable !== undefined) {
            return maybeNullable;
        }
    }

    return undefined;
}

function maybeAutocompleteNullableForAsNullablePrimitiveType(
    activeNode: ActiveNode,
    ancestryIndex: number,
): AutocompleteLanguageConstant | undefined {
    const maybeChild: TXorNode | undefined = AncestryUtils.maybePreviousXor(activeNode.ancestry, ancestryIndex);
    if (maybeChild?.node.maybeAttributeIndex !== 1) {
        return undefined;
    }
    // Ast.AsNullablePrimitiveType.paired: Ast.TNullablePrimitiveType
    const paired: TXorNode = maybeChild;
    const position: Position = activeNode.position;

    // Ast.PrimitiveType
    if (paired.node.kind === Ast.NodeKind.PrimitiveType && PositionUtils.isBeforeXor(position, paired, false)) {
        return Constant.LanguageConstantKind.Nullable;
    }
    // Ast.NullablePrimitiveType
    else if (paired.node.kind === Ast.NodeKind.NullablePrimitiveType) {
        const maybeGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
            activeNode.ancestry,
            ancestryIndex,
            2,
        );
        if (maybeGrandchild === undefined) {
            return undefined;
        }
        // Ast.Constant || Ast.PrimitiveType
        const grandchild: TXorNode = maybeGrandchild;

        if (
            // Ast.Constant
            grandchild.node.kind === Ast.NodeKind.Constant ||
            // before Ast.PrimitiveType
            PositionUtils.isBeforeXor(position, grandchild, false)
        ) {
            return Constant.LanguageConstantKind.Nullable;
        } else {
            return undefined;
        }
    } else {
        return undefined;
    }
}

// function maybeAutocompleteNullableForParameter(
//     activeNode: ActiveNode,
//     functionExpression: TXorNode,
// ): AutocompleteLanguageConstant | undefined {
//     throw new Error();
// }

// function maybeAutocompleteNullableForPrimitiveType(
//     activeNode: ActiveNode,
//     primitiveType: TXorNode,
// ): AutocompleteLanguageConstant | undefined {
//     throw new Error();
// }

function maybeAutocompleteOptional(activeNode: ActiveNode): AutocompleteLanguageConstant | undefined {
    const maybeFnExprIndex: number | undefined = AncestryUtils.maybeFirstIndexOfNodeKind(
        activeNode.ancestry,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybeFnExprIndex === undefined) {
        return undefined;
    }
    const fnExprIndex: number = maybeFnExprIndex;

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const maybeParameter: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(ancestry, fnExprIndex, 4);
    if (maybeParameter === undefined || maybeParameter.node.kind !== Ast.NodeKind.Parameter) {
        return undefined;
    }
    const childOfParameter: TXorNode = AncestryUtils.assertGetNthPreviousXor(ancestry, fnExprIndex, 5);
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
        return Constant.LanguageConstantKind.Optional;
    }

    const nameAst: Ast.Identifier = childOfParameter.node as Ast.Identifier;
    const nameLiteral: string = nameAst.literal;
    if (
        PositionUtils.isInAst(activeNode.position, nameAst, false, true) &&
        Constant.LanguageConstantKind.Optional.startsWith(nameLiteral) &&
        Constant.LanguageConstantKind.Optional.length !== nameLiteral.length
    ) {
        return Constant.LanguageConstantKind.Optional;
    }

    return undefined;
}
