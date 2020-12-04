// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { InspectTypeState, maybeDereferencedIdentifierType } from "./common";

export function inspectTypeIdentifier(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.Identifier);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType ?? Type.UnknownInstance;
}
