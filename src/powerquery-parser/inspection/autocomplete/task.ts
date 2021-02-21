// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Token } from "../../language";
import { IParseState, NodeIdMap, ParseError } from "../../parser";
import { InspectionSettings } from "../../settings";
import { TMaybeActiveNode } from "../activeNode";
import { TypeCache } from "../typeCache";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
import { tryAutocompleteLanguageConstant } from "./autocompleteLanguageConstant";
import { tryAutocompletePrimitiveType } from "./autocompletePrimitiveType";
import { trailingTokenFactory } from "./common";
import {
    Autocomplete,
    TrailingToken,
    TriedAutocompleteFieldAccess,
    TriedAutocompleteKeyword,
    TriedAutocompleteLanguageConstant,
    TriedAutocompletePrimitiveType,
} from "./commonTypes";

export function autocomplete<S extends IParseState = IParseState>(
    settings: InspectionSettings,
    parseState: S,
    typeCache: TypeCache,
    maybeActiveNode: TMaybeActiveNode,
    maybeParseError: ParseError.ParseError<S> | undefined,
): Autocomplete {
    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseState.contextState.leafNodeIds;

    let maybeTrailingToken: TrailingToken | undefined;
    if (maybeParseError !== undefined) {
        const maybeParseErrorToken: Token.Token | undefined = ParseError.maybeTokenFrom(maybeParseError.innerError);
        if (maybeParseErrorToken !== undefined) {
            maybeTrailingToken = trailingTokenFactory(maybeActiveNode.position, maybeParseErrorToken);
        }
    }

    const triedFieldAccess: TriedAutocompleteFieldAccess = tryAutocompleteFieldAccess(
        settings,
        parseState,
        maybeActiveNode,
        typeCache,
    );

    const triedKeyword: TriedAutocompleteKeyword = tryAutocompleteKeyword(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        maybeActiveNode,
        maybeTrailingToken,
    );

    const triedLanguageConstant: TriedAutocompleteLanguageConstant = tryAutocompleteLanguageConstant(
        settings,
        maybeActiveNode,
    );

    const triedPrimitiveType: TriedAutocompletePrimitiveType = tryAutocompletePrimitiveType(
        settings,
        maybeActiveNode,
        maybeTrailingToken,
    );

    return {
        triedFieldAccess,
        triedKeyword,
        triedLanguageConstant,
        triedPrimitiveType,
    };
}
