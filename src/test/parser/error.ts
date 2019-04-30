import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { lexAndParse } from "../../jobs";
import { ParserError } from "../../parser";

const LINE_TERMINATOR: string = "\n";

function expectParserInnerError(document: string, lineTerminator: string): ParserError.TInnerParserError {
    const parseResult = lexAndParse(document, lineTerminator);

    if (!(parseResult.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: parseResult.kind === ResultKind.Err ${JSON.stringify(parseResult)}`);
    }
    else if (!(parseResult.error instanceof ParserError.ParserError)) {
        throw new Error(`AssertFailed: parseResult.error instanceof ParserError: ${parseResult.error.message}`);
    }
    else {
        return parseResult.error.innerError;
    }
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const text = "(optional x, y) => x";
        const innerError = expectParserInnerError(text, LINE_TERMINATOR);
        expect(innerError instanceof ParserError.RequiredParameterAfterOptionalParameterError).to.equal(true, innerError.message);
    });

    it("UnterminatedBracketError: [", () => {
        const text = "[";
        const innerError = expectParserInnerError(text, LINE_TERMINATOR);
        expect(innerError instanceof ParserError.UnterminatedBracketError).to.equal(true, innerError.message);
    });

    it("UnterminatedParenthesesError: (", () => {
        const text = "(";
        const innerError = expectParserInnerError(text, LINE_TERMINATOR);
        expect(innerError instanceof ParserError.UnterminatedParenthesesError).to.equal(true, innerError.message);
    });

    it("UnusedTokensRemainError: 1 1", () => {
        const text = "1 1";
        const innerError = expectParserInnerError(text, LINE_TERMINATOR);
        expect(innerError instanceof ParserError.UnusedTokensRemainError).to.equal(true, innerError.message);
    });

    it("LetExpression requires at least one parameter: let in 1", () => {
        const text = "let in 1";
        const innerError = expectParserInnerError(text, LINE_TERMINATOR);
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });

    it("ListType requires at least one parameter: type list {}", () => {
        const text = "let in 1";
        const innerError = expectParserInnerError(text, LINE_TERMINATOR);
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });
});
