import { expect } from "chai";
import "mocha";
import { ResultKind, Traverse, Option } from "../../common";
import { lexAndParse } from "../../jobs";
import { Ast } from "../../parser";

const LINE_TERMINATOR: string = "\n";

interface CollectAllNodeKindState extends Traverse.IState<Ast.NodeKind[]> { }
interface CollectAllNodeKindRequest extends Traverse.IRequest<CollectAllNodeKindState, Ast.NodeKind[]> { }

interface NthNodeOfKindState extends Traverse.IState<Option<Ast.TNode>> {
    readonly nodeKind: Ast.NodeKind,
    readonly nthRequired: number,
    nthCounter: number,
}
interface NthNodeOfKindRequest extends Traverse.IRequest<NthNodeOfKindState, Option<Ast.TNode>> { }

function astFromText(text: string, lineTerminator: string): Ast.TDocument {
    const parseResult = lexAndParse(text, lineTerminator);
    if (parseResult.kind === ResultKind.Err) {
        throw new Error(`parseResult.kind === ResultKind.Err: ${JSON.stringify(parseResult)}`);
    }

    return parseResult.value.ast;
}

function collectNodeKindsFromAst(text: string, lineTerminator: string): ReadonlyArray<Ast.NodeKind> {
    const ast = astFromText(text, lineTerminator);
    const request: CollectAllNodeKindRequest = {
        ast,
        state: {
            result: [],
        },
        visitNodeFn: collectNodeKindVisit,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    };

    const traverseRequest = Traverse.traverseAst(request);
    if (traverseRequest.kind === ResultKind.Err) {
        throw new Error(`traverseRequest.kind === ResultKind.Err: ${JSON.stringify(traverseRequest)}`);
    }

    return traverseRequest.value;
}

function expectNthNodeOfKind<T>(
    text: string,
    lineTerminator: string,
    nodeKind: Ast.NodeKind,
    nthRequired: number,
): T & Ast.TNode {
    const ast = astFromText(text, lineTerminator);
    const request: NthNodeOfKindRequest = {
        ast,
        state: {
            result: undefined,
            nodeKind,
            nthCounter: 0,
            nthRequired,
        },
        visitNodeFn: nthNodeVisit,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: nthNodeEarlyExit,
    };

    const traverseRequest = Traverse.traverseAst(request);
    if (traverseRequest.kind === ResultKind.Err) {
        throw new Error(`traverseRequest.kind === ResultKind.Err: ${JSON.stringify(traverseRequest)}`);
    }
    else if (traverseRequest.value === undefined) {
        throw new Error(`could not find nth NodeKind where nth=${nthRequired} and NodeKind=${nodeKind}`);
    }

    const node: Ast.TNode = traverseRequest.value;
    return <T & Ast.TNode>node;
}

function collectNodeKindVisit(node: Ast.TNode, state: CollectAllNodeKindState) {
    state.result.push(node.kind);
}

function nthNodeVisit(node: Ast.TNode, state: NthNodeOfKindState) {
    if (node.kind === state.nodeKind) {
        state.nthCounter += 1;
        if (state.nthCounter === state.nthRequired) {
            state.result = node;
        }
    }
}

function nthNodeEarlyExit(_: Ast.TNode, state: NthNodeOfKindState) {
    return state.nthCounter === state.nthRequired;
}

function expectNodeKinds(
    text: string,
    lineTerminator: string,
    expectedNodeKinds: ReadonlyArray<Ast.NodeKind>,
) {
    const actualNodeKinds = collectNodeKindsFromAst(text, lineTerminator);
    const details = {
        actualNodeKinds,
        expectedNodeKinds,
    };
    expect(actualNodeKinds).members(expectedNodeKinds, JSON.stringify(details, null, 4));
}

describe("Parser.NodeKind", () => {
    it(`${Ast.NodeKind.ArithmeticExpression} ${Ast.ArithmeticOperator.Addition}`, () => {
        const text = `1 + 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds)


        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.ArithmeticOperator.Addition, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.ArithmeticExpression} ${Ast.ArithmeticOperator.And}`, () => {
        const text = `1 & 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.ArithmeticOperator.And, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.ArithmeticExpression} ${Ast.ArithmeticOperator.Division}`, () => {
        const text = `1 / 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.ArithmeticOperator.Division, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.ArithmeticExpression} ${Ast.ArithmeticOperator.Multiplication}`, () => {
        const text = `1 * 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.ArithmeticOperator.Multiplication, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.ArithmeticExpression} ${Ast.ArithmeticOperator.Subtraction}`, () => {
        const text = `1 - 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.ArithmeticOperator.Subtraction, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.ArithmeticExpression} with multiple ${Ast.NodeKind.UnaryExpressionHelper}`, () => {
        const text = `1 + 1 + 1 + 1`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.AsExpression, () => {
        const text = `1 as number`;
        const expectedNodeKinds = [
            Ast.NodeKind.AsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.AsNullablePrimitiveType, () => {
        const text = `1 as nullable number`;
        const expectedNodeKinds = [
            Ast.NodeKind.AsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.NullablePrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.AsType, () => {
        const text = `type function (x as number) as number`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.Constant covered by many

    // Ast.NodeKind.Csv covered by many

    it(Ast.NodeKind.EachExpression, () => {
        const text = `each 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.EachExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.EqualityExpression} ${Ast.EqualityOperator.EqualTo}`, () => {
        const text = `1 = 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.EqualityExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.EqualityOperator.EqualTo, JSON.stringify(operatorNode.literal, null, 4));

    });

    it(`${Ast.NodeKind.EqualityExpression} ${Ast.EqualityOperator.NotEqualTo}`, () => {
        const text = `1 <> 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.EqualityExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.EqualityOperator.NotEqualTo, JSON.stringify(operatorNode.literal, null, 4));

    });

    it(`${Ast.NodeKind.ErrorHandlingExpression} otherwise`, () => {
        const text = `try 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ErrorHandlingExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.ErrorHandlingExpression} otherwise`, () => {
        const text = `try 1 otherwise 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ErrorHandlingExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.OtherwiseExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.ErrorRaisingExpression, () => {
        const text = `error 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.ErrorRaisingExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.FieldProjection, () => {
        const text = `x[[y]]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FieldProjection}multiple`, () => {
        const text = `x[[y], [z]]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FieldProjection} optional`, () => {
        const text = `x[[y]]?`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.FieldSelector, () => {
        const text = `[x]`;
        const expectedNodeKinds = [
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FieldSelector} optional`, () => {
        const text = `[x]?`;
        const expectedNodeKinds = [
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.FieldSpecification, () => {
        const text = `type [x]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FieldSpecification} optional`, () => {
        const text = `type [optional x]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FieldSpecification} FieldTypeSpecification`, () => {
        const text = `type [x = number]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.FieldSpecificationList, () => {
        const text = `type [x]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FieldSpecificationList}`, () => {
        const text = `type [x, ...]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    it(Ast.NodeKind.FunctionExpression, () => {
        const text = `() => 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.FunctionExpression,
            Ast.NodeKind.ParameterList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FunctionExpression} ParameterList`, () => {
        const text = `(x) => 1`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FunctionExpression} multiple ParameterList`, () => {
        const text = `(x, y, z) => 1`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FunctionExpression} ParameterList with optional`, () => {
        const text = `(optional x) => 1`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.FunctionExpression} ParameterList with AsNullablePrimitiveType`, () => {
        const text = `(x as nullable text) => 1`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.FieldTypeSpecification covered by AsType

    it(Ast.NodeKind.GeneralizedIdentifier, () => {
        const text = `[foo bar]`;
        const expectedNodeKinds = [
            Ast.NodeKind.FieldSelector,
            Ast.NodeKind.Constant,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, () => {
        const text = `[x=1] section;`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.GeneralizedIdentifierPairedExpression, () => {
        const text = `[x=1]`;
        const expectedNodeKinds = [
            Ast.NodeKind.RecordExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.Identifier covered by many

    it(Ast.NodeKind.IdentifierExpression, () => {
        const text = `@foo`;
        const expectedNodeKinds = [
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Identifier,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.IdentifierExpressionPairedExpression covered by LetExpression

    it(Ast.NodeKind.IdentifierPairedExpression, () => {
        const text = `section; x = 1;`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.IfExpression, () => {
        const text = `if x then x else x`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.InvokeExpression, () => {
        const text = `foo()`;
        const expectedNodeKinds = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.InvokeExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.IsExpression, () => {
        const text = `1 is number`;
        const expectedNodeKinds = [
            Ast.NodeKind.IsExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.ItemAccessExpression, () => {
        const text = `x{1}`;
        const expectedNodeKinds = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.ItemAccessExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.ItemAccessExpression} optional`, () => {
        const text = `x{1}?`;
        const expectedNodeKinds = [
            Ast.NodeKind.RecursivePrimaryExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.ItemAccessExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.LetExpression, () => {
        const text = `let x = 1 in x`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.ListExpression, () => {
        const text = `{1, 2}`;
        const expectedNodeKinds = [
            Ast.NodeKind.ListExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.ListExpression} empty`, () => {
        const text = `{}`;
        const expectedNodeKinds = [
            Ast.NodeKind.ListExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.ListLiteral, () => {
        const text = `[foo = {1}] section;`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.ListLiteral} empty`, () => {
        const text = `[foo = {}] section;`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.ListType, () => {
        const text = `type {number}`;
        const expectedNodeKinds = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.ListType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Logical} true`, () => {
        const text = `true`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Logical} false`, () => {
        const text = `false`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Numeric} decimal`, () => {
        const text = `1`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Numeric} hex`, () => {
        const text = `0x1`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Numeric} float`, () => {
        const text = `1.1`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Str}`, () => {
        const text = `""`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Str} double quote escape`, () => {
        const text = `""""`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LiteralExpression} ${Ast.LiteralKind.Null}`, () => {
        const text = `null`;
        const expectedNodeKinds = [Ast.NodeKind.LiteralExpression];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LogicalExpression} and`, () => {
        const text = `true and true`;
        const expectedNodeKinds = [
            Ast.NodeKind.LogicalExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.LogicalExpression} or`, () => {
        const text = `true or true`;
        const expectedNodeKinds = [
            Ast.NodeKind.LogicalExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.MetadataExpression, () => {
        const text = `1 meta 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.MetadataExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.NotImplementedExpression, () => {
        const text = `...`;
        const expectedNodeKinds = [
            Ast.NodeKind.NotImplementedExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.NullablePrimitiveType, () => {
        const text = `x is nullable number`;
        const expectedNodeKinds = [
            Ast.NodeKind.IsExpression,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.NullablePrimitiveType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(Ast.NodeKind.NullableType, () => {
        const text = `type nullable number`;
        const expectedNodeKinds = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.NullableType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.OtherwiseExpression covered by `${Ast.NodeKind.ErrorHandlingExpression} otherwise`

    // Ast.NodeKind.Parameter covered by many

    // Ast.NodeKind.ParameterList covered by many

    it(Ast.NodeKind.ParenthesizedExpression, () => {
        const text = `(1)`;
        const expectedNodeKinds = [
            Ast.NodeKind.ParenthesizedExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.PrimitiveType covered by many

    it(`${Ast.NodeKind.RecordExpression}`, () => {
        const text = `[x=1]`;
        const expectedNodeKinds = [
            Ast.NodeKind.RecordExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.RecordExpression} empty`, () => {
        const text = `[]`;
        const expectedNodeKinds = [
            Ast.NodeKind.RecordExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.RecordLiteral covered by many

    it(`${Ast.NodeKind.RecordType}`, () => {
        const text = `type [x]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.RecordType} open record marker`, () => {
        const text = `type [x, ...]`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.RecursivePrimaryExpression covered by many

    it(`${Ast.NodeKind.RelationalExpression} ${Ast.RelationalOperator.GreaterThan}`, () => {
        const text = `1 > 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.RelationalExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.RelationalOperator.GreaterThan, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.RelationalExpression} ${Ast.RelationalOperator.GreaterThanEqualTo}`, () => {
        const text = `1 >= 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.RelationalExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.RelationalOperator.GreaterThanEqualTo, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.RelationalExpression} ${Ast.RelationalOperator.LessThan}`, () => {
        const text = `1 < 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.RelationalExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.RelationalOperator.LessThan, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.RelationalExpression} ${Ast.RelationalOperator.LessThanEqualTo}`, () => {
        const text = `1 <= 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.RelationalExpression,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.RelationalOperator.LessThanEqualTo, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.Section}`, () => {
        const text = `section;`;
        const expectedNodeKinds = [
            Ast.NodeKind.Section,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.Section} attributes`, () => {
        const text = `[] section;`;
        const expectedNodeKinds = [
            Ast.NodeKind.Section,
            Ast.NodeKind.RecordLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.Section} name`, () => {
        const text = `section foo;`;
        const expectedNodeKinds = [
            Ast.NodeKind.Section,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.Section} member`, () => {
        const text = `section; x = 1;`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.Section} members`, () => {
        const text = `section; x = 1; y = 2;`;
        const expectedNodeKinds = [
            Ast.NodeKind.Section,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.SectionMember,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.SectionMember,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.SectionMember}`, () => {
        const text = `section; x = 1;`;
        const expectedNodeKinds = [
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
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.SectionMember} attributes`, () => {
        const text = `section; [] x = 1;`;
        const expectedNodeKinds = [
            Ast.NodeKind.Section,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.SectionMember,
            Ast.NodeKind.RecordLiteral,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.SectionMember} shared`, () => {
        const text = `section; shared x = 1;`;
        const expectedNodeKinds = [
            Ast.NodeKind.Section,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Constant,
            Ast.NodeKind.SectionMember,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierPairedExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.TableType} - type table [x]`, () => {
        const text = `type table [x]`;
        const expectedNodeKinds = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.TableType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.FieldSpecificationList,
            Ast.NodeKind.Constant,
            Ast.NodeKind.Csv,
            Ast.NodeKind.FieldSpecification,
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    it(`${Ast.NodeKind.TableType} - type table (x)`, () => {
        const text = `type table (x)`;
        const expectedNodeKinds = [
            Ast.NodeKind.TypePrimaryType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.TableType,
            Ast.NodeKind.Constant,
            Ast.NodeKind.ParenthesizedExpression,
            Ast.NodeKind.Constant,
            Ast.NodeKind.IdentifierExpression,
            Ast.NodeKind.Identifier,
            Ast.NodeKind.Constant,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);
    });

    // Ast.NodeKind.TypePrimaryType covered by many

    it(`${Ast.NodeKind.UnaryExpression} ${Ast.UnaryOperator.Negative}`, () => {
        const text = `-1`;
        const expectedNodeKinds = [
            Ast.NodeKind.UnaryExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.UnaryOperator.Negative, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.UnaryExpression} ${Ast.UnaryOperator.Not}`, () => {
        const text = `not 1`;
        const expectedNodeKinds = [
            Ast.NodeKind.UnaryExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.UnaryOperator.Not, JSON.stringify(operatorNode.literal, null, 4));
    });

    it(`${Ast.NodeKind.UnaryExpression} ${Ast.UnaryOperator.Positive}`, () => {
        const text = `+1`;
        const expectedNodeKinds = [
            Ast.NodeKind.UnaryExpression,
            Ast.NodeKind.UnaryExpressionHelper,
            Ast.NodeKind.Constant,
            Ast.NodeKind.LiteralExpression,
        ];
        expectNodeKinds(text, LINE_TERMINATOR, expectedNodeKinds);

        const operatorNode = expectNthNodeOfKind<Ast.Constant>(text, LINE_TERMINATOR, Ast.NodeKind.Constant, 1);
        expect(operatorNode.literal).to.equal(Ast.UnaryOperator.Positive, JSON.stringify(operatorNode.literal, null, 4));
    });
});
