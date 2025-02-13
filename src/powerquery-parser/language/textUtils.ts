// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export function escape(text: string): string {
    let result: string = text;

    for (const [regexp, escaped] of UnescapedWhitespaceRegexp) {
        result = result.replace(regexp, escaped);
    }

    return result;
}

export function unescape(text: string): string {
    let result: string = text;

    for (const [regexp, literal] of EscapedWhitespaceRegexp) {
        result = result.replace(regexp, literal);
    }

    return result;
}

const EscapedWhitespaceRegexp: ReadonlyArray<[RegExp, string]> = [
    [/#\(cr,lf\)/gm, "\r\n"],
    [/#\(cr\)/gm, "\r"],
    [/#\(lf\)/gm, "\n"],
    [/#\(tab\)/gm, "\t"],
    [/""/gm, '"'],
    [/#\(#\)\(/gm, "#("],
];

const UnescapedWhitespaceRegexp: ReadonlyArray<[RegExp, string]> = [
    [/#/gm, "#(#)"],
    [/\r\n/gm, `#(cr,lf)`],
    [/\r/gm, `#(cr)`],
    [/\n/gm, `#(lf)`],
    [/\t/gm, `#(tab)`],
    [/"/gm, `""`],
];
