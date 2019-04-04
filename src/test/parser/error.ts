import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { lexAndParse } from "../../jobs";
import { ParserError } from "../../parser";

function expectParserInnerError(document: string): ParserError.TInnerParserError {
    const parseResult = lexAndParse(document);

    if (parseResult.kind !== ResultKind.Err) {
        throw new Error(`parseResult.kind !== ResultKind.Err: ${JSON.stringify(parseResult)}`);
    }
    else if (!(parseResult.error instanceof ParserError.ParserError)) {
        throw new Error(`!(parseResult.error instanceof ParserError): ${parseResult.error.message}`);
    }
    else {
        return parseResult.error.innerError;
    }
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const innerError = expectParserInnerError("(optional x, y) => x");
        expect(innerError instanceof ParserError.RequiredParameterAfterOptionalParameterError).to.equal(true, innerError.message);
    });

    it("UnterminatedBracketError: [", () => {
        const innerError = expectParserInnerError("[");
        expect(innerError instanceof ParserError.UnterminatedBracketError).to.equal(true, innerError.message);
    });

    it("UnterminatedParenthesesError: (", () => {
        const innerError = expectParserInnerError("(");
        expect(innerError instanceof ParserError.UnterminatedParenthesesError).to.equal(true, innerError.message);
    });

    it("UnusedTokensRemainError: 1 1", () => {
        const innerError = expectParserInnerError("1 1");
        expect(innerError instanceof ParserError.UnusedTokensRemainError).to.equal(true, innerError.message);
    });

    it("LetExpression requires at least one parameter: let in 1", () => {
        const innerError = expectParserInnerError("let in 1");
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });

    it("ListType requires at least one parameter: type list {}", () => {
        const innerError = expectParserInnerError("let in 1");
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });
});
