// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { maybeDereferencedIdentifierType, TypeInspectionState } from "./common";

export function inspectIdentifierExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.IdentifierExpression);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const dereferencedType: Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType ?? Type.UnknownInstance;
}
