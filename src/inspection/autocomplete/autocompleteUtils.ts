// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "../../common";
import { Autocomplete, IAutocompleteItem } from "./commonTypes";

export function keys(autocomplete: Autocomplete): ReadonlyArray<string> {
    let result: string[] = [];

    if (ResultUtils.isOk(autocomplete.triedFieldAccess) && autocomplete.triedFieldAccess.value !== undefined) {
        result = result.concat(
            autocomplete.triedFieldAccess.value.autocompleteItems.map(
                (autocompleteItem: IAutocompleteItem) => autocompleteItem.key,
            ),
        );
    }

    if (ResultUtils.isOk(autocomplete.triedKeyword)) {
        result = result.concat(autocomplete.triedKeyword.value);
    }

    if (ResultUtils.isOk(autocomplete.triedPrimitiveType)) {
        result = result.concat(autocomplete.triedPrimitiveType.value);
    }

    return result;
}
