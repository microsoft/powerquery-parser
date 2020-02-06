# Style Notes

## Naming conventions

* A function that can return undefined should have its name start with `maybe`, eg. `const maybeUser = maybeGetCurrentUser()`
* A variable that can be undefined should have its name start with `maybe`, eg. `const maybeUser = maybeGetCurrentUser()`
* A function that can return a result should have its name start with `try`, eg. `const triedUpdateUserPhoto = tryUpdateUserPhoto(user, photo)`
* A variable that is a Result should have its name start with `tried`, eg. `const triedUpdateUserPhoto = tryUpdateUserPhoto(user, photo)`

## Exports

* Always put exports before non-exports
* Always order exports in the following order: types, enums, classes, interfaces, constants, functions
  * naive.ts and ast.ts is excluded from this rule

## If statements

* Prefer to pair if with an else, except in the case of invariant checks, eg.
    ```typescript
    if (divisor === 0) {
        throw new Error("divisor should never be 0");
    }

    return x / divisor
    ```
