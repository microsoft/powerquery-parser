// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// A tri-state Result, also known as a partial.
// The third state is for when a job was partially completed but an error occured partway through.
//
// Example usage:
// type DividedNumbersPartial = { results: number[], errorIndex: number };
// type DividedNumbersPartialResult = PartialResult<number[], DividedNumbersPartial, Error>;
//
// function divideNumbers(numbers: [number, number][]): DividedNumbersPartialResult {
//    try {
//         const results: number[] = [];
//         for (let i = 0; i < numbers.length; i++) {
//             const [numerator, denominator] = numbers[i];
//
//             if (denominator === 0) {
//                 return PartialResultUtils.createIncomplete({ results, errorIndex: i });
//             }
//
//             results.push(numerator / denominator);
//         }
//
//         return PartialResultUtils.createOk(results);
//     }
//    catch (error) {
//         return PartialResultUtils.createError(error);
//     }
// }

export type PartialResult<Ok, Partial, Error> =
    | PartialResultOk<Ok>
    | PartialResultIncomplete<Partial>
    | PartialResultError<Error>;

export const enum PartialResultKind {
    Ok = "Ok",
    Incomplete = "Incomplete",
    Error = "Error",
}

export interface PartialResultOk<Value> {
    readonly kind: PartialResultKind.Ok;
    readonly value: Value;
}

export interface PartialResultIncomplete<Partial> {
    readonly kind: PartialResultKind.Incomplete;
    readonly partial: Partial;
}

export interface PartialResultError<Error> {
    readonly kind: PartialResultKind.Error;
    readonly error: Error;
}
