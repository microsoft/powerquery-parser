import { expect } from "chai";
import "mocha";
import { Result, ResultKind } from "../../common";
import { lexAndParse, LexAndParseErr, LexAndParseOk } from "../../jobs";
import { ParserError } from "../../parser";

function expectParserInnerError(text: string): ParserError.TInnerParserError {
    const parseResult: Result<LexAndParseOk, LexAndParseErr> = lexAndParse(text);

    if (!(parseResult.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: parseResult.kind === ResultKind.Err ${JSON.stringify(parseResult)}`);
    } else if (!(parseResult.error instanceof ParserError.ParserError)) {
        throw new Error(`AssertFailed: parseResult.error instanceof ParserError: ${parseResult.error.message}`);
    } else {
        return parseResult.error.innerError;
    }
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const text: string = "(optional x, y) => x";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedBracketError: [", () => {
        const text: string = "[";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.UnterminatedBracketError).to.equal(true, innerError.message);
    });

    it("UnterminatedParenthesesError: (", () => {
        const text: string = "(";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.UnterminatedParenthesesError).to.equal(true, innerError.message);
    });

    it("UnusedTokensRemainError: 1 1", () => {
        const text: string = "1 1";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.UnusedTokensRemainError).to.equal(true, innerError.message);
    });

    it("LetExpression requires at least one parameter: let in 1", () => {
        const text: string = "let in 1";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });

    it("ListType requires at least one parameter: type list {}", () => {
        const text: string = "let in 1";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });
});
