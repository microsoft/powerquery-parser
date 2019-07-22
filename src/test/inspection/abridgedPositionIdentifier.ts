// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { isNever, Option, ResultKind } from "../../common";
import { PositionIdentifierKind, TPositionIdentifier } from "../../inspection";
import { Token, TokenPosition } from "../../lexer";
import { NodeIdMap, Parser } from "../../parser";
import { expectParseOk } from "./common";

type TAbridgedPositionIdentifier = AbridgedLocalIdentifier | AbridgedUndefinedIdentifier;

interface IAbridgedPositionIdentifier {
    readonly kind: PositionIdentifierKind;
    readonly identifierLiteral: string;
}

interface AbridgedLocalIdentifier extends IAbridgedPositionIdentifier {
    readonly kind: PositionIdentifierKind.Local;
    readonly maybeDefinitionPositionStart: Option<TokenPosition>;
}

interface AbridgedUndefinedIdentifier extends IAbridgedPositionIdentifier {
    readonly kind: PositionIdentifierKind.Undefined;
}

function abridgedMaybePositionIdentifierFrom(
    maybePositionIdentifier: Option<TPositionIdentifier>,
): Option<TAbridgedPositionIdentifier> {
    if (maybePositionIdentifier === undefined) {
        return undefined;
    }
    const positionIdentifier: TPositionIdentifier = maybePositionIdentifier;

    switch (positionIdentifier.kind) {
        case PositionIdentifierKind.Local: {
            const definition: NodeIdMap.TXorNode = positionIdentifier.definition;

            let maybeDefinitionPositionStart: Option<TokenPosition>;
            switch (definition.kind) {
                case NodeIdMap.XorNodeKind.Ast:
                    maybeDefinitionPositionStart = definition.node.tokenRange.positionStart;
                    break;

                case NodeIdMap.XorNodeKind.Context: {
                    const maybeTokenStart: Option<Token> = definition.node.maybeTokenStart;
                    if (maybeTokenStart !== undefined) {
                        const tokenStart: Token = maybeTokenStart;
                        maybeDefinitionPositionStart = tokenStart.positionStart;
                    }

                    break;
                }

                default:
                    throw isNever(definition);
            }

            return {
                kind: positionIdentifier.kind,
                identifierLiteral: positionIdentifier.identifier.literal,
                maybeDefinitionPositionStart,
            };
        }

        case PositionIdentifierKind.Undefined:
            return {
                kind: positionIdentifier.kind,
                identifierLiteral: positionIdentifier.identifier.literal,
            };

        default:
            throw isNever(positionIdentifier);
    }
}

function expectParseOkPositionIdentifierEqual(
    text: string,
    position: Inspection.Position,
    expected: Option<TAbridgedPositionIdentifier>,
): void {
    const parseOk: Parser.ParseOk = expectParseOk(text);
    const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
        position,
        parseOk.nodeIdMapCollection,
        parseOk.leafNodeIds,
    );
    expectPositionIdentifierEqual(triedInspect, expected);
}

// function expectParseErrPositionIdentifierEqual(
//     text: string,
//     position: Inspection.Position,
//     expected: Option<TAbridgedPositionIdentifier>,
// ): void {
//     const parserError: ParserError.ParserError = expectParseErr(text);
//     const triedInspect: Inspection.TriedInspect = Inspection.tryFrom(
//         position,
//         parserError.context.nodeIdMapCollection,
//         parserError.context.leafNodeIds,
//     );
//     expectPositionIdentifierEqual(triedInspect, expected);
// }

function expectPositionIdentifierEqual(
    triedInspect: Inspection.TriedInspect,
    expected: Option<TAbridgedPositionIdentifier>,
): void {
    if (!(triedInspect.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspect.kind === ResultKind.Ok: ${triedInspect.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspect.value;
    const actual: Option<TAbridgedPositionIdentifier> = abridgedMaybePositionIdentifierFrom(
        inspection.maybePositionIdentifier,
    );

    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`AbridgedPositionIdentifier`, () => {
        it(`let x = 1, y = 2 in x| * y`, () => {
            const text: string = `let x = 1, y = 2 in x * y`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 21,
            };
            const expected: TAbridgedPositionIdentifier = {
                kind: PositionIdentifierKind.Local,
                identifierLiteral: `x`,
                maybeDefinitionPositionStart: {
                    lineNumber: 0,
                    lineCodeUnit: 8,
                    codeUnit: 8,
                },
            };
            expectParseOkPositionIdentifierEqual(text, position, expected);
        });

        it(`let x = 1, y = 2 in x * y|`, () => {
            const text: string = `let x = 1, y = 2 in x * y`;
            const position: Inspection.Position = {
                lineNumber: 0,
                lineCodeUnit: 24,
            };
            const expected: TAbridgedPositionIdentifier = {
                kind: PositionIdentifierKind.Local,
                identifierLiteral: `y`,
                maybeDefinitionPositionStart: {
                    lineNumber: 0,
                    lineCodeUnit: 15,
                    codeUnit: 15,
                },
            };
            expectParseOkPositionIdentifierEqual(text, position, expected);
        });
    });
});
