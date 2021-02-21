// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, ExternalType, ExternalTypeUtils, Type } from "../../../language";
import { NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXor, recursiveIdentifierDereference } from "./common";

export function inspectTypeInvokeExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.InvokeExpression);

    const maybeRequest: ExternalType.ExternalInvocationTypeRequest | undefined = maybeExternalInvokeRequest(
        state,
        xorNode,
    );
    if (maybeRequest !== undefined && state.settings.maybeExternalTypeResolver) {
        const maybeType: Type.TType | undefined = state.settings.maybeExternalTypeResolver(maybeRequest);
        if (maybeType !== undefined) {
            return maybeType;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXor(state, previousSibling);
    if (previousSiblingType.kind === Type.TypeKind.Any) {
        return Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        return Type.NoneInstance;
    } else if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        return previousSiblingType.returnType;
    } else {
        return Type.AnyInstance;
    }
}

function maybeExternalInvokeRequest(
    state: InspectTypeState,
    xorNode: TXorNode,
): ExternalType.ExternalInvocationTypeRequest | undefined {
    const maybeIdentifier: TXorNode | undefined = NodeIdMapUtils.maybeInvokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (maybeIdentifier === undefined) {
        return undefined;
    }
    const deferencedIdentifier: TXorNode = recursiveIdentifierDereference(state, maybeIdentifier);

    const types: Type.TType[] = [];
    for (const argument of NodeIdMapIterator.iterInvokeExpression(state.nodeIdMapCollection, xorNode)) {
        types.push(inspectXor(state, argument));
    }

    return ExternalTypeUtils.invocationTypeRequestFactory(
        Assert.asDefined(XorNodeUtils.maybeIdentifierExpressionLiteral(deferencedIdentifier)),
        types,
    );
}
