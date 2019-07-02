// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../parser";
import {
    addAstToScopeIfNew,
    isInTokenRange,
    isParentOfNodeKind,
    isTokenPositionBeforePostiion as isTokenPositionBeforePostion,
    isTokenPositionOnPosition,
    NodeKind,
    Position,
    State,
} from "./common";

export function inspectAstNode(state: State, node: Ast.TNode): void {
    switch (node.kind) {
        case Ast.NodeKind.EachExpression: {
            addAstToScopeIfNew(state, "_", node);
            const tokenRange: Ast.TokenRange = node.tokenRange;
            state.result.nodes.push({
                kind: NodeKind.Each,
                maybePositionStart: tokenRange.positionStart,
                maybePositionEnd: tokenRange.positionEnd,
            });
            break;
        }

        case Ast.NodeKind.FunctionExpression: {
            if (isTokenPositionBeforePostion(node.parameters.tokenRange.positionEnd, state.position)) {
                inspectParameterList(state, node.parameters);
            }
            break;
        }

        case Ast.NodeKind.GeneralizedIdentifier:
            addAstToScopeIfNew(state, node.literal, node);
            break;

        case Ast.NodeKind.Identifier:
            if (!isParentOfNodeKind(state.nodeIdMapCollection, node.id, Ast.NodeKind.IdentifierExpression)) {
                addAstToScopeIfNew(state, node.literal, node);
            }
            break;

        case Ast.NodeKind.IdentifierExpression:
            inspectIdentifierExpression(state, node);
            break;

        case Ast.NodeKind.InvokeExpression:
            inspectInvokeExpressionContent(state, node.content);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral: {
            // Check if position is on closeWrapperConstant, eg. '}'
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = node.tokenRange;

            if (
                isInTokenRange(position, tokenRange) &&
                !isTokenPositionOnPosition(node.closeWrapperConstant.tokenRange.positionStart, position)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.List,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });
            }

            break;
        }

        case Ast.NodeKind.ParameterList:
            inspectParameterList(state, node);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            // Check if position is on closeWrapperConstant, eg. ']'
            const position: Position = state.position;
            const tokenRange: Ast.TokenRange = node.tokenRange;
            if (
                isInTokenRange(position, tokenRange) &&
                !isTokenPositionOnPosition(node.closeWrapperConstant.tokenRange.positionStart, position)
            ) {
                state.result.nodes.push({
                    kind: NodeKind.Record,
                    maybePositionStart: tokenRange.positionStart,
                    maybePositionEnd: tokenRange.positionEnd,
                });

                for (const csv of node.content.elements) {
                    const key: Ast.GeneralizedIdentifier = csv.node.key;
                    if (isTokenPositionBeforePostion(key.tokenRange.positionEnd, state.position)) {
                        addAstToScopeIfNew(state, key.literal, key);
                    } else {
                        break;
                    }
                }
            }

            break;
        }

        case Ast.NodeKind.RecursivePrimaryExpression:
            inspectRecursivePrimaryExressionHead(state, node.head);
            break;

        case Ast.NodeKind.Section:
            inspectSectionMemberArray(state, node.sectionMembers);
            break;

        default:
            break;
    }
}

export function inspectIdentifierExpression(state: State, node: Ast.IdentifierExpression): void {
    let identifier: string = node.identifier.literal;
    if (node.maybeInclusiveConstant) {
        const inclusiveConstant: Ast.Constant = node.maybeInclusiveConstant;
        identifier = inclusiveConstant.literal + identifier;
    }

    addAstToScopeIfNew(state, identifier, node);
}

export function inspectInvokeExpressionContent(state: State, args: Ast.InvokeExpression["content"]): void {
    for (const csv of args.elements) {
        const arg: Ast.TExpression = csv.node;
        if (
            arg.kind === Ast.NodeKind.IdentifierExpression &&
            isTokenPositionBeforePostion(arg.tokenRange.positionEnd, state.position)
        ) {
            inspectAstNode(state, arg);
        } else {
            break;
        }
    }
}

export function inspectParameterList(state: State, parameterList: Ast.TParameterList): void {
    for (const csv of parameterList.content.elements) {
        if (!inspectParameter(state, csv.node)) {
            break;
        }
    }
}

export function inspectParameter(state: State, parameter: Ast.TParameter): boolean {
    const name: Ast.Identifier | Ast.GeneralizedIdentifier = parameter.name;
    if (isTokenPositionBeforePostion(name.tokenRange.positionEnd, state.position)) {
        inspectAstNode(state, name);
        return true;
    } else {
        return false;
    }
}

export function inspectRecursivePrimaryExressionHead(state: State, head: Ast.TPrimaryExpression): void {
    if (
        head.kind === Ast.NodeKind.IdentifierExpression &&
        isTokenPositionBeforePostion(head.tokenRange.positionEnd, state.position)
    ) {
        inspectAstNode(state, head);
    }
}

export function inspectSectionMemberArray(state: State, sectionMemberArray: Ast.SectionMemberArray): void {
    for (const sectionMember of sectionMemberArray.elements) {
        inspectSectionMember(state, sectionMember);
    }
}

export function inspectSectionMember(state: State, sectionMember: Ast.SectionMember): void {
    const sectionMemberName: Ast.Identifier = sectionMember.namePairedExpression.key;
    if (isTokenPositionBeforePostion(sectionMemberName.tokenRange.positionEnd, state.position)) {
        addAstToScopeIfNew(state, sectionMemberName.literal, sectionMemberName);
    }
}
