import { Ast } from "../parser";
import { isNever } from "./assert";
import { CommonError } from "./error";
import { Option } from "./option";
import { Result, ResultKind } from "./result";

// Adds some structure / helper functions for traversing an AST.
//
// By default a traversal visits every node and calls a visit function.
// A traversal can visit nodes either using a depth-first or breadth-first strategy.
// Branches can be pruned if an optional early exit fn is given.
//
// Review the traversals used in tests for an example.

export namespace Traverse {

    export type TVisitNodeFn<State, StateType, Return> = (node: Ast.TNode, state: State & Traverse.IState<StateType>) => Return;
    export type TVisitChildNodeFn<State, StateType, Return> = (parent: Ast.TNode, node: Ast.TNode, state: State & Traverse.IState<StateType>) => Return;

    export const enum VisitNodeStrategy {
        BreadthFirst = "BreadthFirst",
        DepthFirst = "DepthFirst",
    }

    export interface IRequest<State, StateType> {
        readonly ast: Ast.TNode,
        readonly state: State & Traverse.IState<StateType>,
        readonly visitNodeFn: TVisitNodeFn<State, StateType, void>,
        readonly visitNodeStrategy: Traverse.VisitNodeStrategy,
        readonly maybeEarlyExitFn: Option<TVisitNodeFn<State, StateType, boolean>>,
    }

    export interface IState<StateType> {
        result: StateType
    }

    export function traverseAst<Request, State, StateType>(
        request: Request & IRequest<State & Traverse.IState<StateType>, StateType>,
    ): Result<StateType, CommonError.CommonError> {
        try {
            traverse(
                request.ast,
                request.state,
                request.visitNodeFn,
                request.visitNodeStrategy,
                request.maybeEarlyExitFn,
            );
        }
        catch (e) {
            return {
                kind: ResultKind.Err,
                error: CommonError.ensureCommonError(e),
            };
        }
        return {
            kind: ResultKind.Ok,
            value: request.state.result,
        };
    }

    // apply a function to all children of the given TNode
    export function traverseChildren<State, StateType, Return>(
        node: Ast.TNode,
        state: State & Traverse.IState<StateType>,
        visitFn: TVisitChildNodeFn<State, StateType, Return>,
    ) {
        switch (node.kind) {
            // TPairedConstant
            case Ast.NodeKind.AsNullablePrimitiveType:
            case Ast.NodeKind.AsType:
            case Ast.NodeKind.EachExpression:
            case Ast.NodeKind.ErrorRaisingExpression:
            case Ast.NodeKind.NullablePrimitiveType:
            case Ast.NodeKind.NullableType:
            case Ast.NodeKind.OtherwiseExpression:
            case Ast.NodeKind.TypePrimaryType:
                visitFn(node, node.constant, state);
                visitFn(node, node.paired, state);
                break;

            // TBinOpExpression
            case Ast.NodeKind.ArithmeticExpression:
            case Ast.NodeKind.EqualityExpression:
            case Ast.NodeKind.LogicalExpression:
            case Ast.NodeKind.RelationalExpression:
                visitFn(node, node.first, state);
                traverseUnaryExpressionHelperChildren(node.rest, state, visitFn);
                break;

            // TBinOpKeyword
            case Ast.NodeKind.IsExpression:
            case Ast.NodeKind.AsExpression:
            case Ast.NodeKind.MetadataExpression:
                visitFn(node, node.left, state);
                visitFn(node, node.constant, state);
                visitFn(node, node.right, state);
                break;

            // TKeyValuePair
            case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
            case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
            case Ast.NodeKind.IdentifierExpressionPairedExpression:
            case Ast.NodeKind.IdentifierPairedExpression:
                visitFn(node, node.key, state);
                visitFn(node, node.equalConstant, state);
                visitFn(node, node.value, state);
                break;

            // TWrapped where Content is TCsv[] and no extra attributes
            case Ast.NodeKind.InvokeExpression:
            case Ast.NodeKind.ListExpression:
            case Ast.NodeKind.ListLiteral:
            case Ast.NodeKind.ParameterList:
            case Ast.NodeKind.RecordExpression:
            case Ast.NodeKind.RecordLiteral:
                visitFn(node, node.openWrapperConstant, state);
                traverseChildArray(node, node.content, state, visitFn);
                visitFn(node, node.closeWrapperConstant, state);
                break;

            case Ast.NodeKind.Csv:
                visitFn(node, node.node, state);
                maybeTraverseChild(node, node.maybeCommaConstant, state, visitFn);
                break;

            case Ast.NodeKind.ErrorHandlingExpression:
                visitFn(node, node.tryConstant, state);
                visitFn(node, node.protectedExpression, state);
                maybeTraverseChild(node, node.maybeOtherwiseExpression, state, visitFn);
                break;

            case Ast.NodeKind.FieldProjection:
                visitFn(node, node.openWrapperConstant, state);
                traverseChildArray(node, node.content, state, visitFn);
                visitFn(node, node.closeWrapperConstant, state);
                maybeTraverseChild(node, node.maybeOptionalConstant, state, visitFn);
                break;

            case Ast.NodeKind.FieldSelector:
                visitFn(node, node.openWrapperConstant, state);
                visitFn(node, node.content, state);
                visitFn(node, node.closeWrapperConstant, state);
                maybeTraverseChild(node, node.maybeOptionalConstant, state, visitFn);
                break;

            case Ast.NodeKind.FieldSpecification:
                maybeTraverseChild(node, node.maybeOptionalConstant, state, visitFn);
                visitFn(node, node.name, state);
                maybeTraverseChild(node, node.maybeFieldTypeSpeification, state, visitFn);
                break;

            case Ast.NodeKind.FieldSpecificationList:
                visitFn(node, node.openWrapperConstant, state);
                traverseChildArray(node, node.content, state, visitFn);
                maybeTraverseChild(node, node.maybeOpenRecordMarkerConstant, state, visitFn);
                visitFn(node, node.closeWrapperConstant, state);
                break;

            case Ast.NodeKind.FieldTypeSpecification:
                visitFn(node, node.equalConstant, state);
                visitFn(node, node.fieldType, state);
                break;

            case Ast.NodeKind.FunctionExpression:
                visitFn(node, node.parameters, state);
                maybeTraverseChild(node, node.maybeFunctionReturnType, state, visitFn);
                visitFn(node, node.fatArrowConstant, state);
                visitFn(node, node.expression, state);
                break;

            case Ast.NodeKind.FunctionType:
                visitFn(node, node.functionConstant, state);
                visitFn(node, node.parameters, state);
                visitFn(node, node.functionReturnType, state);
                break;

            case Ast.NodeKind.IdentifierExpression:
                maybeTraverseChild(node, node.maybeInclusiveConstant, state, visitFn);
                visitFn(node, node.identifier, state);
                break;

            case Ast.NodeKind.IfExpression:
                visitFn(node, node.ifConstant, state);
                visitFn(node, node.condition, state);
                visitFn(node, node.thenConstant, state);
                visitFn(node, node.trueExpression, state);
                visitFn(node, node.elseConstant, state);
                visitFn(node, node.falseExpression, state);
                break;

            case Ast.NodeKind.ItemAccessExpression:
                visitFn(node, node.openWrapperConstant, state);
                visitFn(node, node.content, state);
                visitFn(node, node.closeWrapperConstant, state);
                maybeTraverseChild(node, node.maybeOptionalConstant, state, visitFn);
                break;

            case Ast.NodeKind.LetExpression:
                visitFn(node, node.letConstant, state);
                traverseChildArray(node, node.variableList, state, visitFn);
                visitFn(node, node.inConstant, state);
                visitFn(node, node.expression, state);
                break;

            case Ast.NodeKind.ListType:
                visitFn(node, node.openWrapperConstant, state);
                visitFn(node, node.content, state);
                visitFn(node, node.closeWrapperConstant, state);
                break;

            case Ast.NodeKind.NotImplementedExpression:
                visitFn(node, node.ellipsisConstant, state)
                break;

            case Ast.NodeKind.Parameter:
                maybeTraverseChild(node, node.maybeOptionalConstant, state, visitFn);
                visitFn(node, node.name, state);
                maybeTraverseChild(node, node.maybeParameterType, state, visitFn);
                break;

            case Ast.NodeKind.ParenthesizedExpression:
                visitFn(node, node.openWrapperConstant, state);
                visitFn(node, node.content, state);
                visitFn(node, node.closeWrapperConstant, state);
                break;

            case Ast.NodeKind.PrimitiveType:
                visitFn(node, node.primitiveType, state);
                break;

            case Ast.NodeKind.RecordType:
                visitFn(node, node.fields, state);
                break;

            case Ast.NodeKind.RecursivePrimaryExpression:
                visitFn(node, node.head, state);
                traverseChildArray(node, node.recursiveExpressions, state, visitFn);
                break;

            case Ast.NodeKind.Section:
                maybeTraverseChild(node, node.maybeLiteralAttributes, state, visitFn);
                visitFn(node, node.sectionConstant, state);
                maybeTraverseChild(node, node.maybeName, state, visitFn);
                visitFn(node, node.semicolonConstant, state);
                traverseChildArray(node, node.sectionMembers, state, visitFn);
                break;

            case Ast.NodeKind.SectionMember:
                maybeTraverseChild(node, node.maybeLiteralAttributes, state, visitFn);
                maybeTraverseChild(node, node.maybeSharedConstant, state, visitFn);
                visitFn(node, node.namePairedExpression, state);
                visitFn(node, node.semicolonConstant, state);
                break;

            case Ast.NodeKind.TableType:
                visitFn(node, node.tableConstant, state);
                visitFn(node, node.rowType, state);
                break;

            case Ast.NodeKind.UnaryExpression:
                traverseUnaryExpressionHelperChildren(node.expressions, state, visitFn);
                break;

            case Ast.NodeKind.UnaryExpressionHelper:
                visitFn(node, node.operatorConstant, state);
                visitFn(node, node.node, state);
                break;

            // terminal nodes
            case Ast.NodeKind.Constant:
            case Ast.NodeKind.GeneralizedIdentifier:
            case Ast.NodeKind.Identifier:
            case Ast.NodeKind.LiteralExpression:
                break;

            default:
                isNever(node);
        }
    }

}

function traverse<State, StateType, Return>(
    node: Ast.TNode,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitNodeFn<State, StateType, Return>,
    strategy: Traverse.VisitNodeStrategy,
    maybeEarlyExitFn: Option<Traverse.TVisitNodeFn<State, StateType, boolean>>,
) {
    if (maybeEarlyExitFn && maybeEarlyExitFn(node, state)) {
        return;
    }
    else if (strategy === Traverse.VisitNodeStrategy.BreadthFirst) {
        visitFn(node, state);
    }

    switch (node.kind) {
        // TPairedConstant
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.TypePrimaryType:
            traversePairedConstant(node, state, visitFn, strategy, maybeEarlyExitFn)
            break;

        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            traverse(node.first, state, visitFn, strategy, maybeEarlyExitFn);
            traverseUnaryExpressionHelpers(node.rest, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        // TBinOpKeyword
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.MetadataExpression:
            traverse(node.left, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.constant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.right, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            traverseKeyValuePair(node, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        // TWrapped where Content is TCsv[] and no extra attributes
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverseArray(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.Csv:
            traverse(node.node, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeCommaConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            traverse(node.tryConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.protectedExpression, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeOtherwiseExpression, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FieldProjection:
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverseArray(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeOptionalConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FieldSelector:
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeOptionalConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FieldSpecification:
            maybeTraverse(node.maybeOptionalConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.name, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeFieldTypeSpeification, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FieldSpecificationList:
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverseArray(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeOpenRecordMarkerConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FieldTypeSpecification:
            traverse(node.equalConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.fieldType, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FunctionExpression:
            traverse(node.parameters, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeFunctionReturnType, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.fatArrowConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.expression, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.FunctionType:
            traverse(node.functionConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.parameters, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.functionReturnType, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.IdentifierExpression:
            maybeTraverse(node.maybeInclusiveConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.identifier, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.IfExpression:
            traverse(node.ifConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.condition, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.thenConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.trueExpression, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.elseConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.falseExpression, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeOptionalConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.LetExpression:
            traverse(node.letConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverseArray(node.variableList, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.inConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.expression, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.ListType:
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.NotImplementedExpression:
            traverse(node.ellipsisConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.Parameter:
            maybeTraverse(node.maybeOptionalConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.name, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeParameterType, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.ParenthesizedExpression:
            traverse(node.openWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.content, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.closeWrapperConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.PrimitiveType:
            traverse(node.primitiveType, state, visitFn, strategy, maybeEarlyExitFn)
            break;

        case Ast.NodeKind.RecordType:
            traverse(node.fields, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            traverse(node.head, state, visitFn, strategy, maybeEarlyExitFn);
            traverseArray(node.recursiveExpressions, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.Section:
            maybeTraverse(node.maybeLiteralAttributes, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.sectionConstant, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeName, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.semicolonConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverseArray(node.sectionMembers, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.SectionMember:
            maybeTraverse(node.maybeLiteralAttributes, state, visitFn, strategy, maybeEarlyExitFn);
            maybeTraverse(node.maybeSharedConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.namePairedExpression, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.semicolonConstant, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.TableType:
            traverse(node.tableConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.rowType, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.UnaryExpression:
            traverseUnaryExpressionHelpers(node.expressions, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        case Ast.NodeKind.UnaryExpressionHelper:
            traverse(node.operatorConstant, state, visitFn, strategy, maybeEarlyExitFn);
            traverse(node.node, state, visitFn, strategy, maybeEarlyExitFn);
            break;

        // terminal nodes
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.LiteralExpression:
            break;

        default:
            isNever(node);
    }

    if (strategy === Traverse.VisitNodeStrategy.DepthFirst) {
        visitFn(node, state);
    }
}

function maybeTraverse<State, StateType, Return>(
    maybeNode: Option<Ast.TNode>,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitNodeFn<State, StateType, Return>,
    strategy: Traverse.VisitNodeStrategy,
    maybeEarlyExitFn: Option<Traverse.TVisitNodeFn<State, StateType, boolean>>,
) {
    if (maybeNode) {
        traverse(maybeNode, state, visitFn, strategy, maybeEarlyExitFn)
    }
}

function traverseArray<State, StateType, Return>(
    collection: ReadonlyArray<Ast.TNode>,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitNodeFn<State, StateType, Return>,
    strategy: Traverse.VisitNodeStrategy,
    maybeEarlyExitFn: Option<Traverse.TVisitNodeFn<State, StateType, boolean>>,
) {
    for (const node of collection) {
        traverse(node, state, visitFn, strategy, maybeEarlyExitFn);
    }
}

function traversePairedConstant<State, StateType, Return>(
    node: Ast.TPairedConstant,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitNodeFn<State, StateType, Return>,
    strategy: Traverse.VisitNodeStrategy,
    maybeEarlyExitFn: Option<Traverse.TVisitNodeFn<State, StateType, boolean>>,
) {
    traverse(node.constant, state, visitFn, strategy, maybeEarlyExitFn);
    traverse(node.paired, state, visitFn, strategy, maybeEarlyExitFn);
}

function traverseUnaryExpressionHelpers<State, StateType, Return>(
    nodes: ReadonlyArray<Ast.TUnaryExpressionHelper>,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitNodeFn<State, StateType, Return>,
    strategy: Traverse.VisitNodeStrategy,
    maybeEarlyExitFn: Option<Traverse.TVisitNodeFn<State, StateType, boolean>>,
) {
    for (const unaryExpression of nodes) {
        traverse(unaryExpression, state, visitFn, strategy, maybeEarlyExitFn);
    }
}

function traverseKeyValuePair<State, StateType, Return>(
    node: Ast.TKeyValuePair,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitNodeFn<State, StateType, Return>,
    strategy: Traverse.VisitNodeStrategy,
    maybeEarlyExitFn: Option<Traverse.TVisitNodeFn<State, StateType, boolean>>,
) {
    traverse(node.key, state, visitFn, strategy, maybeEarlyExitFn);
    traverse(node.equalConstant, state, visitFn, strategy, maybeEarlyExitFn);
    traverse(node.value, state, visitFn, strategy, maybeEarlyExitFn);
}

function maybeTraverseChild<State, StateType, Return>(
    parent: Ast.TNode,
    maybeNode: Option<Ast.TNode>,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitChildNodeFn<State, StateType, Return>,
) {
    if (maybeNode) {
        visitFn(parent, maybeNode, state);
    }
}

function traverseChildArray<State, StateType, Return>(
    parent: Ast.TNode,
    collection: ReadonlyArray<Ast.TNode>,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitChildNodeFn<State, StateType, Return>,
) {
    for (const node of collection) {
        visitFn(parent, node, state);
    }
}

function traverseUnaryExpressionHelperChildren<State, StateType, Return>(
    nodes: ReadonlyArray<Ast.TUnaryExpressionHelper>,
    state: State & Traverse.IState<StateType>,
    visitFn: Traverse.TVisitChildNodeFn<State, StateType, Return>,
) {
    for (const unaryExpression of nodes) {
        Traverse.traverseChildren(unaryExpression, state, visitFn);
    }
}
