// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from "..";
import { CommonError, Result } from "../common";
import { Type } from "../language";
import { ActiveNode } from "./activeNode";

export type TriedInspection = Result<InspectionOk, CommonError.CommonError>;

export interface InspectionOk {
    readonly maybeActiveNode: ActiveNode | undefined;
    readonly autocomplete: Inspection.Autocomplete;
    readonly maybeInvokeExpression: Inspection.InvokeExpression | undefined;
    readonly scope: Inspection.ScopeItemByKey;
    readonly scopeType: Inspection.ScopeTypeByKey;
    readonly maybeExpectedType: Type.TType | undefined;
}
