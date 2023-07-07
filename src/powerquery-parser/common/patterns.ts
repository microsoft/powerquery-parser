// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const IdentifierStartCharacter: RegExp =
    /(?:[\p{Uppercase_Letter}|\p{Lowercase_Letter}|\p{Titlecase_Letter}|\p{Modifier_Letter}|\p{Other_Letter}|\p{Letter_Number}|\u{5F}]+)/gu;

export const IdentifierPartCharacters: RegExp =
    /(?:[\p{Uppercase_Letter}|\p{Lowercase_Letter}|\p{Titlecase_Letter}|\p{Modifier_Letter}|\p{Other_Letter}|\p{Letter_Number}|\p{Decimal_Number}|\p{Connector_Punctuation}|\p{Spacing_Mark}|\p{Nonspacing_Mark}|\p{Format}]+)/gu;

export const Whitespace: RegExp =
    // eslint-disable-next-line no-control-regex
    /(:?[\u000b-\u000c\u2000-\u200a])|(?:\u0009)|(?:\u0020)|(?:\u00a0)|(?:\u1680)|(?:\u202f)|(?:\u205f)|(?:\u3000)/g;

export const Hex: RegExp = /0[xX][a-fA-F0-9]+/g;

// eslint-disable-next-line security/detect-unsafe-regex
export const Numeric: RegExp = /(([0-9]*\.[0-9]+)|([0-9]+))([eE][\\+\\-]?[0-9]+)?/g;
