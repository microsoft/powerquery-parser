# Specification Notes

There are a few differences between the [Power Query / M Language Specification](https://docs.microsoft.com/en-us/powerquery-m/power-query-m-language-specification), the Power Query implementation, and this implementation.

## Where the Power Query parser differs from the specification

* An additional primitive type named `time` exists.
* An additional primitive type named `action` exists.
* The `field-specification` construct requires an `identifier`. Instead `identifer` is replaced with `generalized-identifier`.
* The `type` construct matches either `parenthesized-expression` or `primary-type`. Instead `parenthesized-expression` is replaced with `primary-expression`.
* The `table-type` construct matches on `row-type`. An additional match of `primary-expression` is added on the following tokens: `@`, `identifier`, or `left-parenthesis`.
* The `generalized-identifier` was changed so that `identifier-start-character` was replaced with `identifier-part-character`. It also accepts quoted identifiers.
