// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT license.

// import { NodeIdMap, TXorNode, Ast } from "../../parser";
// import { InspectedIdentifier } from "..";

// export function tryInspectFunctionExpression(
//     // settings: InspectionSettings,
//     // activeNode: ActiveNode,
//     inspectedIdentifier: InspectedIdentifier,
//     nodeIdMapCollection: NodeIdMap.Collection,
//     // leafNodeIds: ReadonlyArray<number>,
// ): any {
//     const scope: ReadonlyMap<string, TXorNode> = inspectedIdentifier.scope;
//     const normalizedScope: ReadonlyMap<string, TXorNode> = functionExpressions(scope);
// }

// function functionExpressions(scope: ReadonlyMap<string, TXorNode>): ReadonlyMap<string, TXorNode> {
//     const normalizedMap: Map<string, TXorNode> = new Map();
//     for (const [key, value] of scope.entries()) {
//         const maybeNormalized: TXorNode | undefined = normalizeNode(value, scope);
//         if (maybeNormalized !== undefined && maybeNormalized.node.kind === Ast.NodeKind.FunctionExpression) {
//             normalizedMap.set(key, maybeNormalized);
//         }
//     }

//     return normalizedMap;
// }

// function normalizeNode(xorNode: TXorNode, scope: ReadonlyMap<string, TXorNode>): TXorNode | undefined {
//     while (xorNode.node.kind === Ast.NodeKind.Identifier) {
//         const identifier: Ast.Identifier = xorNode.node as Ast.Identifier;
//         const maybeIndirectNode: TXorNode | undefined = scope.get(identifier.literal);

//         if (maybeIndirectNode === undefined) {
//             return undefined;
//         }
//         xorNode = maybeIndirectNode;
//     }

//     return xorNode;
// }
