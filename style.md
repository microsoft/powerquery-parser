# Style Notes

## Exports

-   naive.ts, ast.ts, and naive.ts are excluded from the following rules
-   Always put exports before non-exports
-   Always order exports in the following order: types, enums, classes, interfaces, constants, functions

## If statements

-   Prefer to pair if with an else, except in the case of invariant checks, eg.

    ```typescript
    if (divisor === 0) {
        throw new Error("divisor should never be 0");
    }

    return x / divisor;
    ```

## Parameters

-   If one of the following parameters exist, order it in this order: locale, cancellation token, trace manager, trace, trace correlation Id
