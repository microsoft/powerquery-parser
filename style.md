# Style Notes

## General

* Always format use Visual Studio Code's default formatter.
* Line limit should be less than 120, except in the case of generics.
  * prefer descriptive names for generics, which tends to make things verbose.

## Exports

* Always put exports before non-exports
* Always order exports in the following order: types, enums, classes, interfaces, functions
  * ast.ts is excluded from this rule

## If statements

* Always use braces.
* Prefer to pair if with an else, except in the case of invariant checks, eg.
    ```typescript
    if (foo === undefined) {
        throw new Error("should never be undefined");
    }
    ```
