import { expect } from "chai";
import "mocha";
import { ResultKind, Traverse } from "../../common";
import { lexAndParse } from "../../jobs";
import { Ast } from "../../parser";

interface State extends Traverse.IState<Ast.NodeKind[]> { }
interface Request extends Traverse.IRequest<State, Ast.NodeKind[]> { }

function tokenizeNodeKindFromAst(document: string): Ast.NodeKind[] {
    const parseResult = lexAndParse(document);
    if (parseResult.kind === ResultKind.Err) {
        throw new Error(`parseResult.kind === ResultKind.Err: ${JSON.stringify(parseResult)}`);
    }

    const request: Request = {
        ast: parseResult.value.ast,
        state: {
            result: [],
        },
        visitNodeFn,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    };

    const traverseRequest = Traverse.traverseAst(request);
    if (traverseRequest.kind === ResultKind.Err) {
        throw new Error(`traverseRequest.kind === ResultKind.Err: ${JSON.stringify(traverseRequest)}`);
    }

    return traverseRequest.value;
}

function visitNodeFn(node: Ast.TNode, state: State) {
    state.result.push(node.kind);
}

describe("verify NodeKind tokens in AST", () => {
    it(Ast.NodeKind.ArithmeticExpression, () => {
        const actual = tokenizeNodeKindFromAst("1 + 1");
        const expected = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ArithmeticExpression + "with multiple " + Ast.NodeKind.UnaryExpressionHelper, () => {
        const actual = tokenizeNodeKindFromAst("1 + 1 + 1 + 1");
        const expected = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.AsExpression, () => {
        const actual = tokenizeNodeKindFromAst("1 as number");
        const expected = [
            Ast.NodeKind.AsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.AsNullablePrimitiveType, () => {
        const actual = tokenizeNodeKindFromAst("1 as nullable number");
        const expected = [
            Ast.NodeKind.AsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.NullablePrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.AsType, () => {
        const actual = tokenizeNodeKindFromAst("type function (x as number) as number");
        const expected = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.FunctionType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.AsType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.AsType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.Constant, () => {
        const actual = tokenizeNodeKindFromAst("1 as number");
        const expected = [
            Ast.NodeKind.AsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    // Ast.NodeKind.Csv covered by many

    it(Ast.NodeKind.EachExpression, () => {
        const actual = tokenizeNodeKindFromAst("each 1");
        const expected = [
            Ast.NodeKind.EachExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.EqualityExpression, () => {
        const actual = tokenizeNodeKindFromAst("1 = 1");
        const expected = [
            Ast.NodeKind.EqualityExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ErrorHandlingExpression + "without otherwise", () => {
        const actual = tokenizeNodeKindFromAst("try 1");
        const expected = [
            Ast.NodeKind.ErrorHandlingExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ErrorHandlingExpression + " with otherwise", () => {
        const actual = tokenizeNodeKindFromAst("try 1 otherwise 1");
        const expected = [
            Ast.NodeKind.ErrorHandlingExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.OtherwiseExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ErrorRaisingExpression, () => {
        const actual = tokenizeNodeKindFromAst("error 1");
        const expected = [
            Ast.NodeKind.ErrorRaisingExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldProjection + " single", () => {
        const actual = tokenizeNodeKindFromAst("x[[y]]");
        const expected = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.FieldProjection,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldProjection + " multiple", () => {
        const actual = tokenizeNodeKindFromAst("x[[y], [z]]");
        const expected = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.FieldProjection,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldProjection + " optional", () => {
        const actual = tokenizeNodeKindFromAst("x[[y]]?");
        const expected = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.FieldProjection,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSelector, () => {
        const actual = tokenizeNodeKindFromAst("[x]");
        const expected = [
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSelector + " optional", () => {
        const actual = tokenizeNodeKindFromAst("[x]?");
        const expected = [
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSpecification, () => {
        const actual = tokenizeNodeKindFromAst("type [x]");
        const expected = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.RecordType,
            Ast.NodeKind.FieldSpecificationList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSpecification,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSpecification + " optional", () => {
        const actual = tokenizeNodeKindFromAst("type [optional x]");
        const expected = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.RecordType,
            Ast.NodeKind.FieldSpecificationList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSpecification,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSpecification + " FieldTypeSpecification", () => {
        const actual = tokenizeNodeKindFromAst("type [x = number]");
        const expected = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.RecordType,
            Ast.NodeKind.FieldSpecificationList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSpecification,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.FieldTypeSpecification,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSpecificationList, () => {
        const actual = tokenizeNodeKindFromAst("type [x]");
        const expected = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.RecordType,
            Ast.NodeKind.FieldSpecificationList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSpecification,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FieldSpecificationList + " openRecord", () => {
        const actual = tokenizeNodeKindFromAst("type [x, ...]");
        const expected = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.RecordType,
            Ast.NodeKind.FieldSpecificationList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSpecification,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    // Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    it(Ast.NodeKind.FunctionExpression, () => {
        const actual = tokenizeNodeKindFromAst("() => 1");
        const expected = [
            Ast.NodeKind.FunctionExpression,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FunctionExpression + " ParameterList", () => {
        const actual = tokenizeNodeKindFromAst("(x) => 1");
        const expected = [
            Ast.NodeKind.FunctionExpression,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FunctionExpression + " multiple ParameterList", () => {
        const actual = tokenizeNodeKindFromAst("(x, y, z) => 1");
        const expected = [
            Ast.NodeKind.FunctionExpression,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FunctionExpression + " ParameterList with optional", () => {
        const actual = tokenizeNodeKindFromAst("(optional x) => 1");
        const expected = [
            Ast.NodeKind.FunctionExpression,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.FunctionExpression + " ParameterList with AsNullablePrimitiveType", () => {
        const actual = tokenizeNodeKindFromAst("(x as nullable text) => 1");
        const expected = [
            Ast.NodeKind.FunctionExpression,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.Parameter,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.AsNullablePrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.NullablePrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    // Ast.NodeKind.FieldTypeSpecification covered by AsType

    it(Ast.NodeKind.GeneralizedIdentifier, () => {
        const actual = tokenizeNodeKindFromAst("[foo bar]");
        const expected = [
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, () => {
        const actual = tokenizeNodeKindFromAst("[x=1] section;");
        const expected = [
            Ast.NodeKind.Section,
            Ast.NodeKind.RecordLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.GeneralizedIdentifierPairedExpression, () => {
        const actual = tokenizeNodeKindFromAst("[x=1]");
        const expected = [
            Ast.NodeKind.RecordExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    // Ast.NodeKind.Identifier covered by many

    it(Ast.NodeKind.IdentifierExpression, () => {
        const actual = tokenizeNodeKindFromAst("@foo");
        const expected = [
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Identifier,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    // Ast.NodeKind.IdentifierExpressionPairedExpression covered by LetExpression

    it(Ast.NodeKind.IdentifierPairedExpression, () => {
        const actual = tokenizeNodeKindFromAst("section; x = 1;");
        const expected = [
            Ast.NodeKind.Section,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.SectionMember,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.IfExpression, () => {
        const actual = tokenizeNodeKindFromAst("if x then x else x");
        const expected = [
            Ast.NodeKind.IfExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.InvokeExpression, () => {
        const actual = tokenizeNodeKindFromAst("foo()");
        const expected = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.InvokeExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.IsExpression, () => {
        const actual = tokenizeNodeKindFromAst("1 is number");
        const expected = [
            Ast.NodeKind.IsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ItemAccessExpression, () => {
        const actual = tokenizeNodeKindFromAst("x{1}");
        const expected = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.ItemAccessExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ItemAccessExpression + " optional", () => {
        const actual = tokenizeNodeKindFromAst("x{1}?");
        const expected = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.ItemAccessExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.LetExpression, () => {
        const actual = tokenizeNodeKindFromAst("let x = 1 in x");
        const expected = [
            Ast.NodeKind.LetExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ListExpression, () => {
        const actual = tokenizeNodeKindFromAst("{1, 2}");
        const expected = [
            Ast.NodeKind.ListExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ListExpression + "empty", () => {
        const actual = tokenizeNodeKindFromAst("{}");
        const expected = [
            Ast.NodeKind.ListExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ListLiteral, () => {
        const actual = tokenizeNodeKindFromAst("[foo = {1}] section;");
        const expected = [
            Ast.NodeKind.Section,
            Ast.NodeKind.RecordLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.ListLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });

    it(Ast.NodeKind.ListLiteral + " empty", () => {
        const actual = tokenizeNodeKindFromAst("[foo = {}] section;");
        const expected = [
            Ast.NodeKind.Section,
            Ast.NodeKind.RecordLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.ListLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        const details = {
            actual,
            expected,
        };
        expect(actual).members(expected, JSON.stringify(details, null, 4));
    });
});
