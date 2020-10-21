// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ResultUtils } from "../../common";
import { Ast, Constant } from "../../language";
import {
    AncestryUtils,
    IParserState,
    ParseContext,
    ParseError,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { AdditionalParse, AutocompleteLanguageConstant, TriedAutocompleteLanguageConstant } from "./commonTypes";

export function tryAutocompleteLanguageConstant<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    maybeActiveNode: TMaybeActiveNode,
    maybeParseError: ParseError.ParseError | undefined,
): TriedAutocompleteLanguageConstant {
    if (!ActiveNodeUtils.isSome(maybeActiveNode)) {
        return ResultUtils.okFactory([]);
    }

    return ResultUtils.ensureResult(parserState.localizationTemplates, () => {
        return autocompleteLanguageConstant(parseSettings, parserState, maybeActiveNode, maybeParseError);
    });
}

// Currently only checks "optional" constant in FunctionExpression.
function autocompleteLanguageConstant<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    activeNode: ActiveNode,
    maybeParseError: ParseError.ParseError | undefined,
): AutocompleteLanguageConstant | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const maybeFunctionExpressionAncestryIndex: number | undefined = AncestryUtils.maybeFirstIndexOfNodeKind(
        ancestry,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybeFunctionExpressionAncestryIndex === undefined) {
        if (maybeParseError?.innerError instanceof ParseError.UnterminatedSequence) {
            return parseAndInspectFunctionExpression(parseSettings, parserState, activeNode);
        } else {
            return undefined;
        }
    } else {
        return inspectFunctionExpression(activeNode, maybeFunctionExpressionAncestryIndex);
    }
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
        return [Constant.IdentifierConstantKind.Optional];
    }

    const nameAst: Ast.Identifier = childOfParameter.node as Ast.Identifier;
    const nameLiteral: string = nameAst.literal;
    if (
        PositionUtils.isInAst(activeNode.position, nameAst, false, true) &&
        Constant.IdentifierConstantKind.Optional.startsWith(nameLiteral) &&
        Constant.IdentifierConstantKind.Optional.length !== nameLiteral.length
    ) {
        return [Constant.IdentifierConstantKind.Optional];
    }

    return undefined;
}

function parseAndInspectFunctionExpression<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    originalActiveNode: ActiveNode,
): AutocompleteLanguageConstant | undefined {
    const parsed: AdditionalParse<S> = parseFunctionExpression(parseSettings, parserState);
    const contextState: ParseContext.State = parsed.parserState.contextState;
    const maybeNewActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        originalActiveNode.position,
    );
    if (!ActiveNodeUtils.isSome(maybeNewActiveNode)) {
        return undefined;
    }

    const newActiveNode: TMaybeActiveNode = maybeNewActiveNode;
    const ancestry: ReadonlyArray<TXorNode> = newActiveNode.ancestry;
    const functionExpressionAncestryIndex: number | undefined = AncestryUtils.maybeFirstIndexOfNodeKind(
        ancestry,
        Ast.NodeKind.FunctionExpression,
    );
    if (functionExpressionAncestryIndex === undefined) {
        return undefined;
    }

    return inspectFunctionExpression(newActiveNode, functionExpressionAncestryIndex);
}

function parseFunctionExpression<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
): AdditionalParse<S> {
    const newState: S = parseSettings.parserStateFactory(
        parseSettings.maybeCancellationToken,
        parserState.lexerSnapshot,
        parserState.tokenIndex,
        parseSettings.locale,
    );

    try {
        return {
            root: XorNodeUtils.astFactory(parseSettings.parser.readFunctionExpression(newState, parseSettings.parser)),
            parserState: newState,
            maybeParseError: undefined,
        };
    } catch (error) {
        if (CommonError.isTInnerCommonError(error)) {
            throw error;
        } else if (!ParseError.isTInnerParseError(error)) {
            throw new CommonError.InvariantError(`unknown error was thrown`, { error });
        } else {
            return {
                root: XorNodeUtils.contextFactory(Assert.asDefined(newState.contextState.maybeRoot)),
                parserState: newState,
                maybeParseError: new ParseError.ParseError(error, newState),
            };
        }
    }
}
