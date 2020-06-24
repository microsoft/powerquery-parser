// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "../../common";
import { NodeIdMap, NodeIdMapIterator, TXorNode } from "../../parser";
import { ScopeItemByKey } from "../scope";
import { Type, expectedNextType } from "../../type";

function getBestMatch(ancestry: ReadonlyArray<TXorNode>): TXorNode | undefined {
    const upperBound = ancestry.length - 2;
    let bestMatch: TXorNode | undefined;

    for (let index: number = 0; index < upperBound; index += 1) {
        const parent: TXorNode = ancestry[index + 1];
        const child: TXorNode = ancestry[index];

        const allowedType: Type.TType = expectedNextType(parent, child.node.maybeAttributeIndex)
    }
}

// function maybeTopSingleChild(
//     childIdsById: NodeIdMap.ChildIdsById,
//     ancestry: ReadonlyArray<TXorNode>,
// ): TXorNode | undefined {
//     const numAncestors: number = ancestry.length;
//     if (numAncestors < 2) {
//         return undefined;
//     } else if (numAncestors === 2) {
//         return ancestry[1];
//     }

//     let maybeBestMatch: TXorNode | undefined;
//     for (let index: number = 2; index < numAncestors - 1; index += 1) {
//         const parent: TXorNode | undefined = ancestry[index + 1];
//         const child: TXorNode = ancestry[index];

//         const siblingNodes: ReadonlyArray<number> = NodeIdMapIterator.expectChildIds(childIdsById, parent.node.id);

//         const childIndex: number = siblingNodes.indexOf(child.node.id);
//         if (childIndex === -1) {
//             const details: {} = {
//                 parentNodeId: parent.node.id,
//                 childNodeId: child.node.id,
//             };
//             throw new CommonError.InvariantError("expected child node to be in the parent's list of children", details);
//         }

//         const isOnlyChild: boolean = siblingNodes.length === 1;
//         if (isOnlyChild === false) {
//             break;
//         }

//         maybeBestMatch = parent;
//     }

//     return maybeBestMatch;
// }

// function inspectXorNode(xorNode: TXorNode): Type.TType {
//     switch (xorNode.node.kind) {
//         case Ast.NodeKind.ArithmeticExpression:
//         case Ast.NodeKind.ArrayWrapper:
//         case Ast.NodeKind.AsExpression:
//         case Ast.NodeKind.AsNullablePrimitiveType:
//         case Ast.NodeKind.AsType:
//         case Ast.NodeKind.Constant:
//         case Ast.NodeKind.Csv:
//         case Ast.NodeKind.EachExpression:
//         case Ast.NodeKind.EqualityExpression:
//         case Ast.NodeKind.ErrorHandlingExpression:
//         case Ast.NodeKind.ErrorRaisingExpression:
//         case Ast.NodeKind.FieldProjection:
//         case Ast.NodeKind.FieldSelector:
//         case Ast.NodeKind.FieldSpecification:
//         case Ast.NodeKind.FieldSpecificationList:
//         case Ast.NodeKind.FieldTypeSpecification:
//         case Ast.NodeKind.FunctionExpression:
//         case Ast.NodeKind.FunctionType:
//         case Ast.NodeKind.GeneralizedIdentifier:
//         case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
//         case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
//         case Ast.NodeKind.Identifier:
//         case Ast.NodeKind.IdentifierExpression:
//         case Ast.NodeKind.IdentifierPairedExpression:
//         case Ast.NodeKind.IfExpression:
//         case Ast.NodeKind.InvokeExpression:
//         case Ast.NodeKind.IsExpression:
//         case Ast.NodeKind.IsNullablePrimitiveType:
//         case Ast.NodeKind.ItemAccessExpression:
//         case Ast.NodeKind.LetExpression:
//         case Ast.NodeKind.ListExpression:
//         case Ast.NodeKind.ListLiteral:
//         case Ast.NodeKind.ListType:
//         case Ast.NodeKind.LiteralExpression:
//         case Ast.NodeKind.LogicalExpression:
//         case Ast.NodeKind.MetadataExpression:
//         case Ast.NodeKind.NotImplementedExpression:
//         case Ast.NodeKind.NullablePrimitiveType:
//         case Ast.NodeKind.NullableType:
//         case Ast.NodeKind.OtherwiseExpression:
//         case Ast.NodeKind.Parameter:
//         case Ast.NodeKind.ParameterList:
//         case Ast.NodeKind.ParenthesizedExpression:
//         case Ast.NodeKind.PrimitiveType:
//         case Ast.NodeKind.RangeExpression:
//         case Ast.NodeKind.RecordExpression:
//         case Ast.NodeKind.RecordLiteral:
//         case Ast.NodeKind.RecordType:
//         case Ast.NodeKind.RecursivePrimaryExpression:
//         case Ast.NodeKind.RelationalExpression:
//         case Ast.NodeKind.Section:
//         case Ast.NodeKind.SectionMember:
//         case Ast.NodeKind.TableType:
//         case Ast.NodeKind.TypePrimaryType:
//         case Ast.NodeKind.UnaryExpression:
//         default:
//             break;
//     }
// }
