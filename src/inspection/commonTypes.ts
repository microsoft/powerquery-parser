// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "../common";
import { LexError } from "../lexer";
import { ParseError } from "../parser";
import { InspectionOk } from "../task";

export type TriedInspection = Result<InspectionOk, CommonError.CommonError | LexError.LexError | ParseError.ParseError>;
