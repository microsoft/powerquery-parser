// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../powerquery-parser/language";
import { NoOpTraceManagerInstance } from "../../../../powerquery-parser/common/trace";
import { TPowerQueryType } from "../../../../powerquery-parser/language/type/type";

describe(`TypeUtils.isEqualType`, () => {
    function runTest(params: {
        readonly left: TPowerQueryType;
        readonly right: TPowerQueryType;
        readonly expected: boolean;
    }): void {
        const actual: boolean = TypeUtils.isEqualType(params.left, params.right);
        expect(actual).to.equal(params.expected);
    }

    describe(`${Type.TypeKind.Function}`, () => {
        it(`null is not compatible`, () => {
            const type: TPowerQueryType = TypeUtils.definedFunction(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: true,
                        type: Type.TypeKind.Text,
                        nameLiteral: `x`,
                    },
                ],
                TypeUtils.anyUnion(
                    [
                        {
                            isNullable: false,
                            kind: Type.TypeKind.Number,
                            literal: `1`,
                            extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                            normalizedLiteral: 1,
                        },
                        {
                            isNullable: false,
                            kind: Type.TypeKind.Number,
                            literal: `2`,
                            extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                            normalizedLiteral: 2,
                        },
                    ],
                    NoOpTraceManagerInstance,
                    undefined,
                ),
            );

            runTest({
                left: type,
                right: type,
                expected: true,
            });
        });
    });
});
