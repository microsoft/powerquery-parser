// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TypesUtils } from ".";
import { Ast, TXorNode, XorNodeKind, AstUtils, NodeIdMap, NodeIdMapUtils } from "../../parser";
import { ExtendedTypeKind } from "./types";
import { CommonError } from "../../common";

type EvaluationCache = Map<number, ExtendedTypeKind>;

export function evaluate(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    cache: EvaluationCache,
): ExtendedTypeKind {
    const maybeCached: ExtendedTypeKind | undefined = cache.get(xorNode.node.id);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: ExtendedTypeKind;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.LiteralExpression:
            result =
                xorNode.kind === XorNodeKind.Ast
                    ? TypesUtils.extendedTypeKindFrom((xorNode.node as Ast.LiteralExpression).literalKind)
                    : ExtendedTypeKind.Unknown;
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = evaluateBinOpExpression(nodeIdMapCollection, xorNode, cache);
            break;

        default:
            result = ExtendedTypeKind.Unknown;
    }

    cache.set(xorNode.node.id, result);
    return result;
}

function evaluateBinOpExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    cache: EvaluationCache,
): ExtendedTypeKind {
    if (!AstUtils.isTBinOpExpressionKind(xorNode.node.kind)) {
        const details: {} = {
            nodeId: xorNode.node.id,
            nodeKind: xorNode.node.kind,
        };
        throw new CommonError.InvariantError("expected xorNode to be TBinOpExpression", details);
    }

    const parentId: number = xorNode.node.id;
    const maybeLeft: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        0,
        undefined,
    );
    const maybeOperator: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        1,
        [Ast.NodeKind.Constant],
    );
    const maybeRight: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentId,
        2,
        undefined,
    );

    if (maybeLeft === undefined || maybeOperator === undefined || maybeRight === undefined) {
        return ExtendedTypeKind.Unknown;
    }
}

const BinOpExpressionLookup: Map<string, ExtendedTypeKind> = new Map();

function binOpExpressionLookupKey()