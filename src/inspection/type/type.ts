// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap } from "../../parser";
import { CommonSettings } from "../../settings";
import { Type } from "../../type";
import { ScopeById } from "../scope";

export type ScopeTypeByKey = Map<string, Type.TType>;

export type TypeById = Map<number, Type.TType>;

export interface TypeInspectionState {
    readonly settings: CommonSettings;
    readonly givenTypeById: TypeById;
    readonly deltaTypeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    scopeById: ScopeById;
}
