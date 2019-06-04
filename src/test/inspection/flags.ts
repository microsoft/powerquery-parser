import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { Option, ResultKind } from "../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { Parser } from "../../parser";

function expectTriedParse(text: string): Parser.TriedParse {
    const state: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (!(maybeErrorLineMap === undefined)) {
        throw new Error(`AssertFailed: maybeErrorLineMap === undefined`);
    }

    const snapshotResult: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    if (!(snapshotResult.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: snapshotResult.kind === ResultKind.Ok`);
    }
    const snapshot: LexerSnapshot = snapshotResult.value;

    return Parser.parse(snapshot);
}

function expectTriedInspect(text: string, position: Inspection.Position): Inspection.TriedInspect {
    const triedParse: Parser.TriedParse = expectTriedParse(text);
    return Inspection.tryFrom(position, triedParse);
}

function expectInspectEquals(text: string, position: Inspection.Position, expected: Inspection.Inspection): void {
    const triedInspect: Inspection.TriedInspect = expectTriedInspect(text, position);
    if (!(triedInspect.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedInspect.kind === ResultKind.Ok`);
    }
    const actual: Inspection.Inspection = triedInspect.value;
    expect(actual).deep.equal(expected);
}

describe(`Inspection`, () => {
    describe(`Flags`, () => {
        describe(`Record`, () => {
            it(`[] at (0, 0)`, () => {
                const text: string = `[]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                };
                const expected: Inspection.Inspection = {
                    isInEach: false,
                    isInFunction: false,
                    isInIdentifierExpression: false,
                    isInLeftHandAssignment: false,
                    isInRecord: false,
                    scope: [],
                };
                expectInspectEquals(text, position, expected);
            });

            it(`[] at (0, 1)`, () => {
                const text: string = `[]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                };
                const expected: Inspection.Inspection = {
                    isInEach: false,
                    isInFunction: false,
                    isInIdentifierExpression: false,
                    isInLeftHandAssignment: false,
                    isInRecord: true,
                    scope: [],
                };
                expectInspectEquals(text, position, expected);
            });

            it(`[] at (0, 2)`, () => {
                const text: string = `[]`;
                const position: Inspection.Position = {
                    lineNumber: 0,
                    lineCodeUnit: 2,
                };
                const expected: Inspection.Inspection = {
                    isInEach: false,
                    isInFunction: false,
                    isInIdentifierExpression: false,
                    isInLeftHandAssignment: false,
                    isInRecord: false,
                    scope: [],
                };
                expectInspectEquals(text, position, expected);
            });
        });
    });
});
