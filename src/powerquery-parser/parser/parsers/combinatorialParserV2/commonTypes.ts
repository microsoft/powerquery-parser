// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";

export type TOperand = Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType;

export enum CombinatorialParserV2TraceConstant {
    CombinatorialParseV2 = "CombinatorialParseV2",
}

export interface OperatorsAndOperands {
    readonly operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>;
    readonly operands: ReadonlyArray<TOperand>;
}
