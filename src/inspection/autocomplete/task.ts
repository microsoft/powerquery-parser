// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Token } from "../../language";
import { IParserState, NodeIdMap, ParseError } from "../../parser";
import { ParseSettings } from "../../settings";
import { TMaybeActiveNode } from "../activeNode";
import { TypeCache } from "../type/commonTypes";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
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
    parseSettings: ParseSettings<S>,
    parserState: S,
    typeCache: TypeCache,
    maybeActiveNode: TMaybeActiveNode,
    maybeParseError: ParseError.ParseError<S> | undefined,
): Autocomplete {
    const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parserState.contextState.leafNodeIds;

    let maybeTrailingToken: TrailingToken | undefined;
    if (maybeParseError !== undefined) {
        const maybeParseErrorToken: Token.Token | undefined = ParseError.maybeTokenFrom(maybeParseError.innerError);
        if (maybeParseErrorToken !== undefined) {
            maybeTrailingToken = trailingTokenFactory(maybeActiveNode.position, maybeParseErrorToken);
        }
    }

    const triedFieldAccess: TriedAutocompleteFieldAccess = tryAutocompleteFieldAccess(
        parseSettings,
        parserState,
        maybeActiveNode,
        typeCache,
        maybeParseError,
    );

    const triedKeyword: TriedAutocompleteKeyword = tryAutocompleteKeyword(
        parseSettings,
        nodeIdMapCollection,
        leafNodeIds,
        maybeActiveNode,
        maybeTrailingToken,
    );

    const triedPrimitiveType: TriedAutocompletePrimitiveType = tryAutocompletePrimitiveType(
        parseSettings,
        maybeActiveNode,
        maybeTrailingToken,
    );

    return {
        triedFieldAccess,
        triedKeyword,
        triedPrimitiveType,
    };
}
