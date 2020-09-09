// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Constant, Keyword } from "../../language";
import { getLocalizationTemplates } from "../../localization";
import { IParserState, NodeIdMap, ParseError } from "../../parser";
import { CommonSettings } from "../../settings";
import { ActiveNode } from "../activeNode";
import { autocompleteKeyword } from "./autocompleteKeyword";
import { ExpressionAutocomplete } from "./autocompleteKeyword/commonTypes";
import { autocompletePrimitiveType } from "./autocompletePrimitiveType";
import { TriedAutocomplete } from "./commonTypes";

export function tryAutocomplete<S extends IParserState = IParserState>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeActiveNode: ActiveNode | undefined,
    maybeParseError: ParseError.ParseError<S> | undefined,
): TriedAutocomplete {
    if (maybeActiveNode === undefined || maybeActiveNode.ancestry.length === 0) {
        return ResultUtils.okFactory([...ExpressionAutocomplete, Keyword.KeywordKind.Section]);
    }

    return ResultUtils.ensureResult(getLocalizationTemplates(settings.locale), () => {
        const primitiveTypes: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = autocompletePrimitiveType(
            nodeIdMapCollection,
            maybeActiveNode,
        );
        const keywords: ReadonlyArray<Keyword.KeywordKind> = autocompleteKeyword(
            nodeIdMapCollection,
            leafNodeIds,
            maybeActiveNode,
            maybeParseError !== undefined ? ParseError.maybeTokenFrom(maybeParseError.innerError) : undefined,
        );

        return [...primitiveTypes, ...keywords];
    });
}
