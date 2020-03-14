// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind } from ".";
import { Ast } from "..";
import { CommonError, isNever, MapUtils } from "../../common";

export interface KeyValuePair {
    readonly source: TXorNode;
    readonly key: Ast.GeneralizedIdentifier | Ast.Identifier;
    readonly keyLiteral: string;
    readonly maybeValue: undefined | TXorNode;
}

export function expectAncestry(nodeIdMapCollection: NodeIdMap.Collection, rootId: number): ReadonlyArray<TXorNode> {
    const ancestryIds: number[] = [rootId];

    let maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(rootId);
    while (maybeParentId) {
        const parentId: number = maybeParentId;
        ancestryIds.push(parentId);
        maybeParentId = nodeIdMapCollection.parentIdById.get(parentId);
    }

    return expectXorNodes(nodeIdMapCollection, ancestryIds);
}

export function maybeAstChildren(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> | undefined {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    return childIds.map(childId => NodeIdMapUtils.expectAstNode(astNodeById, childId));
}

export function maybeNthSiblingXorNode(
    nodeIdMapCollection: NodeIdMap.Collection,
    rootId: number,
    offset: number,
): TXorNode | undefined {
    const childXorNode: TXorNode = NodeIdMapUtils.expectXorNode(nodeIdMapCollection, rootId);
    if (childXorNode.node.maybeAttributeIndex === undefined) {
        return undefined;
    }

    const attributeIndex: number = childXorNode.node.maybeAttributeIndex + offset;
    if (attributeIndex < 0) {
        return undefined;
    }

    const parentXorNode: TXorNode = NodeIdMapUtils.expectParentXorNode(nodeIdMapCollection, rootId, undefined);
    const childIds: ReadonlyArray<number> = expectChildIds(nodeIdMapCollection.childIdsById, parentXorNode.node.id);
    if (childIds.length >= attributeIndex) {
        return undefined;
    }

    return NodeIdMapUtils.maybeXorNode(nodeIdMapCollection, childIds[attributeIndex]);
}

export function maybeNextSiblingXorNode(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): TXorNode | undefined {
    return maybeNthSiblingXorNode(nodeIdMapCollection, nodeId, 1);
}

export function expectXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
): ReadonlyArray<TXorNode> {
    return nodeIds.map(nodeId => NodeIdMapUtils.expectXorNode(nodeIdMapCollection, nodeId));
}

export function expectChildIds(childIdsById: NodeIdMap.ChildIdsById, nodeId: number): ReadonlyArray<number> {
    return MapUtils.expectGet(childIdsById, nodeId);
}

export function expectAstChildren(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    return expectChildIds(nodeIdMapCollection.childIdsById, parentId).map(childId =>
        NodeIdMapUtils.expectAstNode(astNodeById, childId),
    );
}

export function expectXorChildren(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<TXorNode> {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return [];
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    return expectXorNodes(nodeIdMapCollection, childIds);
}

export function sectionNameValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    section: TXorNode,
): ReadonlyArray<KeyValuePair> {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        section,
        Ast.NodeKind.Section,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeSectionMembers: undefined | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        section.node.id,
        4,
        [Ast.NodeKind.ArrayWrapper],
    );
    if (maybeSectionMembers === undefined) {
        return [];
    }

    const partial: KeyValuePair[] = [];
    for (const sectionMember of arrayWrapperXorNodes(nodeIdMapCollection, maybeSectionMembers)) {
        const maybeKeyValuePair:
            | TXorNode
            | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, sectionMember.node.id, 2, [
            Ast.NodeKind.IdentifierPairedExpression,
        ]);
        if (maybeKeyValuePair === undefined) {
            continue;
        }
        const keyValuePair: TXorNode = maybeKeyValuePair;

        // Add name to scope.
        const maybeName: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            [Ast.NodeKind.Identifier],
        );
        if (maybeName === undefined) {
            continue;
        }
        const name: Ast.Identifier = maybeName as Ast.Identifier;

        const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            2,
            undefined,
        );

        partial.push({
            source: keyValuePair,
            key: name,
            keyLiteral: name.literal,
            maybeValue,
        });
    }
    return partial;
}

export function recordKeyValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    record: TXorNode,
): ReadonlyArray<KeyValuePair> {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstAnyNodeKind(record, [
        Ast.NodeKind.RecordExpression,
        Ast.NodeKind.RecordLiteral,
    ]);
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: undefined | TXorNode = NodeIdMapUtils.maybeWrappedContent(nodeIdMapCollection, record);
    return maybeArrayWrapper === undefined ? [] : keyValuePairs(nodeIdMapCollection, maybeArrayWrapper);
}

export function letKeyValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    letExpression: TXorNode,
): ReadonlyArray<KeyValuePair> {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        letExpression,
        Ast.NodeKind.LetExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: undefined | TXorNode = NodeIdMapUtils.maybeWrappedContent(
        nodeIdMapCollection,
        letExpression,
    );
    return maybeArrayWrapper === undefined ? [] : keyValuePairs(nodeIdMapCollection, maybeArrayWrapper);
}

export function keyValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    arrayWrapper: TXorNode,
): ReadonlyArray<KeyValuePair> {
    const partial: KeyValuePair[] = [];
    for (const keyValuePair of arrayWrapperXorNodes(nodeIdMapCollection, arrayWrapper)) {
        const maybeKey: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier],
        );
        if (maybeKey === undefined) {
            break;
        }
        const key: Ast.GeneralizedIdentifier | Ast.Identifier = maybeKey as Ast.GeneralizedIdentifier | Ast.Identifier;

        partial.push({
            source: keyValuePair,
            key,
            keyLiteral: key.literal,
            maybeValue: NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                keyValuePair.node.id,
                2,
                undefined,
            ),
        });
    }

    return partial;
}

export function arrayWrapperXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    arrayWrapper: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        arrayWrapper,
        Ast.NodeKind.ArrayWrapper,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    if (arrayWrapper.kind === XorNodeKind.Ast) {
        return (arrayWrapper.node as Ast.TCsvArray).elements.map((wrapper: Ast.TCsv) =>
            NodeIdMapUtils.xorNodeFromAst(wrapper.node),
        );
    }

    const partial: TXorNode[] = [];
    for (const csvXorNode of expectXorChildren(nodeIdMapCollection, arrayWrapper.node.id)) {
        switch (csvXorNode.kind) {
            case XorNodeKind.Ast:
                partial.push(NodeIdMapUtils.xorNodeFromAst((csvXorNode.node as Ast.TCsv).node));
                break;

            case XorNodeKind.Context: {
                const maybeChild: undefined | TXorNode = NodeIdMapUtils.maybeCsvNode(nodeIdMapCollection, csvXorNode);
                if (maybeChild !== undefined) {
                    partial.push(maybeChild);
                }
                break;
            }

            default:
                throw isNever(csvXorNode);
        }
    }

    return partial;
}
