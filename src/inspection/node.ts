// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";

export type TInspectedNode = InspectedInvokeExpression;

export interface IInspectedNode {
    readonly kind: Ast.NodeKind;
    readonly id: number,
    readonly maybePositionStart: Option<TokenPosition>;
    readonly maybePositionEnd: Option<TokenPosition>;
}

export interface InspectedInvokeExpression extends IInspectedNode {
    readonly kind: Ast.NodeKind.InvokeExpression;
    readonly maybeName: Option<string>;
    readonly maybeArguments: Option<InvokeExpressionArguments>;
}

export interface InvokeExpressionArguments {
    readonly numArguments: number;
    readonly positionArgumentIndex: number;
}

export function basicInspectedNodeFrom(xorNode: NodeIdMap.TXorNode): IInspectedNode {
    let maybePositionStart: Option<TokenPosition>;
    let maybePositionEnd: Option<TokenPosition>;

    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const tokenRange: Ast.TokenRange = xorNode.node.tokenRange;
            maybePositionStart = tokenRange.positionStart;
            maybePositionEnd = tokenRange.positionEnd;
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const contextNode: ParserContext.Node = xorNode.node;
            maybePositionStart =
                contextNode.maybeTokenStart !== undefined ? contextNode.maybeTokenStart.positionStart : undefined;
            maybePositionEnd = undefined;
            break;
        }

        default:
            throw isNever(xorNode);
    }

    return {
        kind: xorNode.node.kind,
        id: xorNode.node.id,
        maybePositionStart,
        maybePositionEnd,
    };
}
