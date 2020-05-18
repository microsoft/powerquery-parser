// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import "mocha";
import { Type, TypeUtils } from "../../../type";

describe(`TypeUtils`, () => {
    describe(`dedupe`, () => {
        it(`dedupe - generic, identical`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.genericFactory(Type.TypeKind.Record, false),
                TypeUtils.genericFactory(Type.TypeKind.Record, false),
            ]);
            expect(result.length).to.equal(1);
        });

        it(`WIP dedupe - generic, mixed`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.genericFactory(Type.TypeKind.Record, false),
                TypeUtils.genericFactory(Type.TypeKind.Record, true),
            ]);
            expect(result.length).to.equal(2);
        });
    });
});
