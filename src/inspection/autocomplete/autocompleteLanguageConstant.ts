// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ResultUtils } from "../../common";
import { Ast, Token, Type } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { LocalizationUtils } from "../../localization";
import {
    IParser,
    IParserState,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    ParseError,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
    AncestryUtils,
} from "../../parser";
import { ParseSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../type/commonTypes";
import {
    AutocompleteFieldAccess,
    AutocompleteItem,
    InspectedFieldAccess,
    ParsedFieldAccess,
    TriedAutocompleteFieldAccess,
    TriedAutocompleteLanguageConstant,
    AutocompleteLanguageConstant,
} from "./commonTypes";

export function tryAutocompleteLanguageConstant<S extends IParserState = IParserState>(
    parserState: S,
    activeNode: ActiveNode,
    maybeParseError: ParseError.ParseError | undefined,
): TriedAutocompleteLanguageConstant {
    return ResultUtils.ensureResult(parserState.localizationTemplates, () => {
        return autocompleteLanguageConstant(parserState, activeNode, maybeParseError);
    });
}

function autocompleteLanguageConstant<S extends IParserState = IParserState>(
    parserState: S,
    activeNode: ActiveNode,
    maybeParseError: ParseError.ParseError | undefined,
): AutocompleteLanguageConstant | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const maybePair: [TXorNode, number] | undefined = AncestryUtils.maybeFirstXorAndIndexOfNodeKind(
        ancestry,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybePair === undefined) {
        return undefined;
    }
    const [functionExpression, functionExpressionIndex] = maybePair;

    const functionExpressionChild: TXorNode = AncestryUtils.assertGetPreviousXor(ancestry, functionExpressionIndex, [
        Ast.NodeKind.ParameterList,
        Ast.NodeKind.AsNullablePrimitiveType,
        Ast.NodeKind.Constant,
    ]);
    if (functionExpressionChild.node.kind !== Ast.NodeKind.ParameterList) {
        return undefined;
    }

    throw new Error("");
}
