// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Constant, Keyword, Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { getLocalizationTemplates } from "../../localization";
import { IParserState, NodeIdMap, ParseError } from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { TypeCache } from "../type/commonTypes";
import { autocompleteField } from "./autocompleteField";
import { autocompleteKeyword } from "./autocompleteKeyword";
import { ExpressionAutocomplete } from "./autocompleteKeyword/commonTypes";
import { autocompletePrimitiveType } from "./autocompletePrimitiveType";
import { trailingTokenFactory } from "./common";
import { TrailingToken, TriedAutocomplete } from "./commonTypes";

export function tryAutocomplete<S extends IParserState = IParserState>(
    settings: CommonSettings,
    lexerSnapshot: LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    typeCache: TypeCache,
    maybeActiveNode: ActiveNode | undefined,
    maybeParseError: ParseError.ParseError<S> | undefined,
): TriedAutocomplete {
    if (maybeActiveNode === undefined || maybeActiveNode.ancestry.length === 0) {
        return ResultUtils.okFactory([...ExpressionAutocomplete, Keyword.KeywordKind.Section]);
    }
    const activeNode: ActiveNode = maybeActiveNode;

    let maybeTrailingToken: TrailingToken | undefined;
    if (maybeParseError !== undefined) {
        const maybeParseErrorToken: Token.Token | undefined = ParseError.maybeTokenFrom(maybeParseError.innerError);
        if (maybeParseErrorToken !== undefined) {
            maybeTrailingToken = trailingTokenFactory(activeNode, maybeParseErrorToken);
        }
    }

    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => {
        const primitiveTypes: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = autocompletePrimitiveType(
            activeNode,
            maybeTrailingToken,
        );
        const keywords: ReadonlyArray<Keyword.KeywordKind> = autocompleteKeyword(
            nodeIdMapCollection,
            leafNodeIds,
            activeNode,
            maybeTrailingToken,
        );
        const fieldSelection: ReadonlyArray<string> = autocompleteField(
            settings,
            lexerSnapshot,
            nodeIdMapCollection,
            leafNodeIds,
            activeNode,
            typeCache,
            maybeParseError,
        );

        return [...primitiveTypes, ...keywords, ...fieldSelection];
    });
}
