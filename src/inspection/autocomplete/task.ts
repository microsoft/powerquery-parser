// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Keyword, Token } from "../../language";
import { IParserState, NodeIdMap, ParseError } from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { TypeCache } from "../type/commonTypes";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
import { ExpressionAutocomplete } from "./autocompleteKeyword/commonTypes";
import { tryAutocompletePrimitiveType } from "./autocompletePrimitiveType";
import { trailingTokenFactory } from "./common";
import {
    Autocomplete,
    TrailingToken,
    TriedAutocompleteFieldAccess,
    TriedAutocompleteKeyword,
    TriedAutocompletePrimitiveType,
} from "./commonTypes";

export function autocomplete<S extends IParserState = IParserState>(
    settings: CommonSettings,
    parserState: S,
    typeCache: TypeCache,
    maybeActiveNode: ActiveNode | undefined,
    maybeParseError: ParseError.ParseError<S> | undefined,
): Autocomplete {
    const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parserState.contextState.leafNodeIds;

    if (maybeActiveNode === undefined || maybeActiveNode.ancestry.length === 0) {
        return {
            triedFieldAccess: ResultUtils.okFactory(undefined),
            triedKeyword: ResultUtils.okFactory([...ExpressionAutocomplete, Keyword.KeywordKind.Section]),
            triedPrimitiveType: ResultUtils.okFactory([]),
        };
    }
    const activeNode: ActiveNode = maybeActiveNode;

    let maybeTrailingToken: TrailingToken | undefined;
    if (maybeParseError !== undefined) {
        const maybeParseErrorToken: Token.Token | undefined = ParseError.maybeTokenFrom(maybeParseError.innerError);
        if (maybeParseErrorToken !== undefined) {
            maybeTrailingToken = trailingTokenFactory(activeNode, maybeParseErrorToken);
        }
    }

    const triedFieldAccess: TriedAutocompleteFieldAccess = tryAutocompleteFieldAccess(
        settings,
        parserState,
        activeNode,
        typeCache,
        maybeParseError,
    );

    const triedKeyword: TriedAutocompleteKeyword = tryAutocompleteKeyword(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNode,
        maybeTrailingToken,
    );

    const triedPrimitiveType: TriedAutocompletePrimitiveType = tryAutocompletePrimitiveType(
        settings,
        activeNode,
        maybeTrailingToken,
    );

    return {
        triedFieldAccess,
        triedKeyword,
        triedPrimitiveType,
    };
}