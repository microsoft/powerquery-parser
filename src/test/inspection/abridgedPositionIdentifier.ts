// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { isNever, ResultUtils } from "../../common";
import { PositionIdentifierKind, TPositionIdentifier } from "../../inspection";
import { Token, TokenPosition } from "../../lexer";
import { TXorNode, XorNodeKind } from "../../parser";
import { expectParseErrInspection, expectParseOkInspection, expectTextWithPosition } from "../common";

type TAbridgedPositionIdentifier = AbridgedLocalIdentifier | AbridgedUndefinedIdentifier;

interface IAbridgedPositionIdentifier {
    readonly kind: PositionIdentifierKind;
    readonly identifierLiteral: string;
}

interface AbridgedLocalIdentifier extends IAbridgedPositionIdentifier {
    readonly kind: PositionIdentifierKind.Local;
    readonly maybeDefinitionPositionStart: TokenPosition | undefined;
}

interface AbridgedUndefinedIdentifier extends IAbridgedPositionIdentifier {
    readonly kind: PositionIdentifierKind.Undefined;
}

function expectAbridgedInspectionEqual(
    triedInspection: Inspection.TriedInspection,
    expected: TAbridgedPositionIdentifier | undefined,
): void {
    if (!ResultUtils.isOk(triedInspection)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedInspection): ${triedInspection.error.message}`);
    }
    const inspection: Inspection.Inspected = triedInspection.value;
    const actual: TAbridgedPositionIdentifier | undefined = abridgedMaybeIdentifierUnderPositionFrom(
        inspection.maybeIdentifierUnderPosition,
    );

    expect(actual).deep.equal(expected);
}

function abridgedMaybeIdentifierUnderPositionFrom(
    maybeIdentifierUnderPosition: TPositionIdentifier | undefined,
): TAbridgedPositionIdentifier | undefined {
    if (maybeIdentifierUnderPosition === undefined) {
        return undefined;
    }
    const positionIdentifier: TPositionIdentifier = maybeIdentifierUnderPosition;

    switch (positionIdentifier.kind) {
        case PositionIdentifierKind.Local: {
            const definition: TXorNode = positionIdentifier.definition;

            let maybeDefinitionPositionStart: TokenPosition | undefined;
            switch (definition.kind) {
                case XorNodeKind.Ast:
                    maybeDefinitionPositionStart = definition.node.tokenRange.positionStart;
                    break;

                case XorNodeKind.Context: {
                    const maybeTokenStart: Token | undefined = definition.node.maybeTokenStart;
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

describe(`Inspection`, () => {
    describe(`AbridgedPositionIdentifier`, () => {
        describe("Ast", () => {
            it(`x |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`x |`);
                const expected: TAbridgedPositionIdentifier | undefined = undefined;
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let x = 1 in y|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = 1 in y|`);
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Undefined,
                    identifierLiteral: `y`,
                };
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let x = 1, y = 2 in x| * y`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = 1, y = 2 in x| * y`,
                );
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Local,
                    identifierLiteral: `x`,
                    maybeDefinitionPositionStart: {
                        lineNumber: 0,
                        lineCodeUnit: 8,
                        codeUnit: 8,
                    },
                };
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let x = 1, y = 2 in x * y|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = 1, y = 2 in x * y|`,
                );
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Local,
                    identifierLiteral: `y`,
                    maybeDefinitionPositionStart: {
                        lineNumber: 0,
                        lineCodeUnit: 15,
                        codeUnit: 15,
                    },
                };
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`let x = 1 in [y = x|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = 1 in [y = x|]`);
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Local,
                    identifierLiteral: `x`,
                    maybeDefinitionPositionStart: {
                        lineNumber: 0,
                        lineCodeUnit: 8,
                        codeUnit: 8,
                    },
                };
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`section; foo = 1; bar = foo|;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section; foo = 1; bar = foo|;`,
                );
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Local,
                    identifierLiteral: `foo`,
                    maybeDefinitionPositionStart: {
                        lineNumber: 0,
                        lineCodeUnit: 15,
                        codeUnit: 15,
                    },
                };
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });

            it(`section; foo = 1; bar = foo;|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section; foo = 1; bar = foo;|`,
                );
                const expected: TAbridgedPositionIdentifier | undefined = undefined;
                expectAbridgedInspectionEqual(expectParseOkInspection(text, position), expected);
            });
        });

        describe("ParserContext", () => {
            it(`let x = 1, y = 2 in x| *`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = 1, y = 2 in x| *`,
                );
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Local,
                    identifierLiteral: `x`,
                    maybeDefinitionPositionStart: {
                        lineNumber: 0,
                        lineCodeUnit: 8,
                        codeUnit: 8,
                    },
                };
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });

            it(`let x = 1 in [y = x|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = 1 in [y = x|`);
                const expected: TAbridgedPositionIdentifier | undefined = {
                    kind: PositionIdentifierKind.Local,
                    identifierLiteral: `x`,
                    maybeDefinitionPositionStart: {
                        lineNumber: 0,
                        lineCodeUnit: 8,
                        codeUnit: 8,
                    },
                };
                expectAbridgedInspectionEqual(expectParseErrInspection(text, position), expected);
            });
        });
    });
});
