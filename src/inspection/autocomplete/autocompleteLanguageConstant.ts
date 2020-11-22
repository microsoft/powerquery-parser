// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ResultUtils } from "../../common";
import { Ast, Constant } from "../../language";
import { LanguageConstantKind } from "../../language/constant/constant";
import { AncestryUtils, IParseState, TXorNode, XorNodeKind } from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";
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

function maybeAutocompleteNullable(activeNode: ActiveNode): LanguageConstantKind.Nullable | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        let maybeNullable: LanguageConstantKind.Nullable | undefined;
        switch (xorNode.node.kind) {
            case Ast.NodeKind.AsNullablePrimitiveType:
                maybeNullable = maybeAutocompleteNullableForAsNullablePrimitiveType(activeNode, index);
                break;

            case Ast.NodeKind.PrimitiveType:
                maybeNullable = maybeAutocompleteNullableForPrimitiveType(xorNode);
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
): LanguageConstantKind.Nullable | undefined {
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
    } else if (paired.node.kind === Ast.NodeKind.PrimitiveType) {
        return maybeAutocompleteNullableForPrimitiveType(paired);
    } else {
        return undefined;
    }
}

function maybeAutocompleteNullableForPrimitiveType(primitiveType: TXorNode): LanguageConstantKind.Nullable | undefined {
    return primitiveType.kind === XorNodeKind.Context ? Constant.LanguageConstantKind.Nullable : undefined;
}

function maybeAutocompleteOptional(activeNode: ActiveNode): LanguageConstantKind.Optional | undefined {
    const maybeFnExprAncestryIndex: number | undefined = AncestryUtils.maybeFirstIndexOfNodeKind(
        activeNode.ancestry,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybeFnExprAncestryIndex === undefined) {
        return undefined;
    }
    const fnExprAncestryIndex: number = maybeFnExprAncestryIndex;

    // FunctionExpression -> IParenthesisWrapped -> ParameterList -> Csv -> Parameter
    const maybeParameter: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
        activeNode.ancestry,
        fnExprAncestryIndex,
        4,
        [Ast.NodeKind.Parameter],
    );
    if (maybeParameter === undefined) {
        return undefined;
    }

    const maybeChildOfParameter: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
        activeNode.ancestry,
        fnExprAncestryIndex,
        5,
    );
    if (maybeChildOfParameter === undefined) {
        return Constant.LanguageConstantKind.Optional;
    }
    const childOfParameter: TXorNode = maybeChildOfParameter;

    switch (childOfParameter.node.maybeAttributeIndex) {
        // IParameter.maybeOptionalConstant
        case 0:
            return Constant.LanguageConstantKind.Optional;

        // IParameter.name
        case 1:
            switch (childOfParameter.kind) {
                case XorNodeKind.Ast: {
                    const nameAst: Ast.Identifier = childOfParameter.node as Ast.Identifier;
                    const name: string = nameAst.literal;

                    return Constant.LanguageConstantKind.Optional.startsWith(name) &&
                        name !== Constant.LanguageConstantKind.Optional &&
                        PositionUtils.isInAst(activeNode.position, nameAst, false, true)
                        ? Constant.LanguageConstantKind.Optional
                        : undefined;
                }

                case XorNodeKind.Context:
                    return Constant.LanguageConstantKind.Optional;

                default:
                    throw Assert.isNever(childOfParameter);
            }

        default:
            return undefined;
    }
}
