// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast } from "../parser";

export type TInspectedVisitedNode = InspectedVisitedInvokeExpression;

export interface IInspectedVisitedNode {
    readonly kind: Ast.NodeKind;
    readonly id: number;
    readonly maybePositionStart: Option<TokenPosition>;
    readonly maybePositionEnd: Option<TokenPosition>;
}

export interface InspectedVisitedInvokeExpression extends IInspectedVisitedNode {
    readonly kind: Ast.NodeKind.InvokeExpression;
    readonly maybeName: Option<string>;
    readonly maybeArguments: Option<InvokeExpressionArgs>;
}

export interface InvokeExpressionArgs {
    readonly numArguments: number;
    readonly positionArgumentIndex: number;
}
