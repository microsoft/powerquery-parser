# Style Notes

## Exports

* Always put exports before non-exports
* Always order exports in the following order: types, enums, classes, interfaces, functions
  * ast.ts is excluded from this rule

## If statements

* Prefer to pair if with an else, except in the case of invariant checks, eg.
    ```typescript
    if (foo === undefined) {
        throw new Error("should never be undefined");
    }
    ```
