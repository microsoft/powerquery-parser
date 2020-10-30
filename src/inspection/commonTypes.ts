// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from "..";
import { CommonError, Result } from "../common";
import { ExpectedType } from "../language";
import { TMaybeActiveNode } from "./activeNode";

export type TriedInspection = Result<Inspection, CommonError.CommonError>;

export interface Inspection {
    readonly maybeActiveNode: TMaybeActiveNode;
    readonly autocomplete: Inspection.Autocomplete;
    readonly triedInvokeExpression: Inspection.TriedInvokeExpression;
    readonly triedNodeScope: Inspection.TriedNodeScope;
    readonly triedScopeType: Inspection.TriedScopeType;
    readonly triedExpectedType: ExpectedType.TriedExpectedType;
}
