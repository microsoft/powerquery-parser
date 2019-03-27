# Specification Notes

There are a few differences between the [Power Query / M Language Specification](https://docs.microsoft.com/en-us/powerquery-m/power-query-m-language-specification), the Power Query implementation, and this implementation.

## Where the Power Query parser differs from the specification

* The `field-specification` construct requires an `identifier`. Instead `identifer` is replaced with `generalized-identifier`.
* The `type` construct matches either `parenthesized-expression` or `primary-type`. Instead `parenthesized-expression` is replaced with `primary-expression`.
* The `table-type` construct matches on `row-type`. An additional match of `primary-expression` is added on the following tokens: `@`, `identifier`, or `left-parenthesis`.

## Where this parser differs from the Power Query parser

* For convenience, similar BinOps (such as arithmetic BinOps) are combined into a collection AST node. Ex. `1 + 2 - 3 * 4` is represented by `1` followed by the 3 unary expressions `[+2, -3, *4]`. This is also true for all BinOps including keyword BinOps.
