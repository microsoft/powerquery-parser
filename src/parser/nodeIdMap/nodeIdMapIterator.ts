// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind } from ".";
import { CommonError, isNever, MapUtils } from "../../common";
import { Ast } from "../../language";

export interface KeyValuePair<T extends Ast.GeneralizedIdentifier | Ast.Identifier> {
    readonly source: TXorNode;
    readonly key: T;
    readonly keyLiteral: string;
    readonly maybeValue: TXorNode | undefined;
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

export function letKeyValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    letExpression: TXorNode,
): ReadonlyArray<KeyValuePair<Ast.Identifier>> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        letExpression,
        Ast.NodeKind.LetExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        letExpression.node.id,
        1,
        [Ast.NodeKind.ArrayWrapper],
    );
    return maybeArrayWrapper === undefined ? [] : keyValuePairs(nodeIdMapCollection, maybeArrayWrapper);
}

export function fieldProjectionFieldSelectors(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldProjection: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        fieldProjection,
        Ast.NodeKind.FieldProjection,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeArrayWrapperContent(
        nodeIdMapCollection,
        fieldProjection,
    );
    return maybeArrayWrapper === undefined ? [] : arrayWrapperCsvXorNodes(nodeIdMapCollection, maybeArrayWrapper);
}

export function fieldProjectionFieldNames(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldProjection: TXorNode,
): ReadonlyArray<string> {
    const result: string[] = [];

    for (const selector of fieldProjectionFieldSelectors(nodeIdMapCollection, fieldProjection)) {
        const maybeIdentifier: TXorNode | undefined = NodeIdMapUtils.maybeWrappedContent(
            nodeIdMapCollection,
            selector,
            Ast.NodeKind.GeneralizedIdentifier,
        );
        if (maybeIdentifier === undefined || maybeIdentifier.kind !== XorNodeKind.Ast) {
            break;
        } else {
            result.push((maybeIdentifier.node as Ast.GeneralizedIdentifier).literal);
        }
    }

    return result;
}

export function fieldSpecificationListCsvXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldSpecificationList: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        fieldSpecificationList,
        Ast.NodeKind.FieldSpecificationList,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeWrappedContent(
        nodeIdMapCollection,
        fieldSpecificationList,
        Ast.NodeKind.ArrayWrapper,
    );
    if (maybeArrayWrapper === undefined) {
        return [];
    }

    return arrayWrapperCsvXorNodes(nodeIdMapCollection, maybeArrayWrapper);
}

export function listItems(nodeIdMapCollection: NodeIdMap.Collection, list: TXorNode): ReadonlyArray<TXorNode> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstAnyNodeKind(list, [
        Ast.NodeKind.ListExpression,
        Ast.NodeKind.ListLiteral,
    ]);
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeArrayWrapperContent(nodeIdMapCollection, list);
    return maybeArrayWrapper === undefined ? [] : arrayWrapperCsvXorNodes(nodeIdMapCollection, maybeArrayWrapper);
}

export function recordKeyValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    record: TXorNode,
): ReadonlyArray<KeyValuePair<Ast.GeneralizedIdentifier>> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstAnyNodeKind(record, [
        Ast.NodeKind.RecordExpression,
        Ast.NodeKind.RecordLiteral,
    ]);
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeArrayWrapperContent(
        nodeIdMapCollection,
        record,
    );
    return maybeArrayWrapper === undefined ? [] : keyValuePairs(nodeIdMapCollection, maybeArrayWrapper);
}

export function sectionMemberKeyValuePairs(
    nodeIdMapCollection: NodeIdMap.Collection,
    section: TXorNode,
): ReadonlyArray<KeyValuePair<Ast.Identifier>> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
        section,
        Ast.NodeKind.Section,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    if (section.kind === XorNodeKind.Ast) {
        return (section.node as Ast.Section).sectionMembers.elements.map((sectionMember: Ast.SectionMember) => {
            const namePairedExpression: Ast.IdentifierPairedExpression = sectionMember.namePairedExpression;
            return {
                source: NodeIdMapUtils.xorNodeFromAst(namePairedExpression),
                key: namePairedExpression.key,
                keyLiteral: namePairedExpression.key.literal,
                maybeValue: NodeIdMapUtils.xorNodeFromAst(namePairedExpression.value),
            };
        });
    }

    const maybeSectionMemberArrayWrapper:
        | undefined
        | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, section.node.id, 4, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeSectionMemberArrayWrapper === undefined) {
        return [];
    }
    const sectionMemberArrayWrapper: TXorNode = maybeSectionMemberArrayWrapper;

    const partial: KeyValuePair<Ast.Identifier>[] = [];
    for (const sectionMember of expectXorChildren(nodeIdMapCollection, sectionMemberArrayWrapper.node.id)) {
        const maybeKeyValuePair:
            | undefined
            | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, sectionMember.node.id, 2, [
            Ast.NodeKind.IdentifierPairedExpression,
        ]);
        if (maybeKeyValuePair === undefined) {
            continue;
        }
        const keyValuePair: TXorNode = maybeKeyValuePair;
        const keyValuePairNodeId: number = keyValuePair.node.id;

        const maybeKey: Ast.Identifier | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePairNodeId,
            0,
            [Ast.NodeKind.Identifier],
        ) as Ast.Identifier;
        if (maybeKey === undefined) {
            continue;
        }
        const key: Ast.Identifier = maybeKey;

        partial.push({
            source: keyValuePair,
            key,
            keyLiteral: key.literal,
            maybeValue: NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                keyValuePairNodeId,
                2,
                undefined,
            ),
        });
    }

    return partial;
}

export function keyValuePairs<T extends Ast.GeneralizedIdentifier | Ast.Identifier>(
    nodeIdMapCollection: NodeIdMap.Collection,
    arrayWrapper: TXorNode,
): ReadonlyArray<KeyValuePair<T>> {
    const partial: KeyValuePair<T>[] = [];
    for (const keyValuePair of arrayWrapperCsvXorNodes(nodeIdMapCollection, arrayWrapper)) {
        const maybeKey: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier],
        );
        if (maybeKey === undefined) {
            break;
        }
        const key: T = maybeKey as T & (Ast.GeneralizedIdentifier | Ast.Identifier);

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

export function arrayWrapperCsvXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    arrayWrapper: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeErr: CommonError.InvariantError | undefined = NodeIdMapUtils.testAstNodeKind(
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
                const maybeChild: TXorNode | undefined = NodeIdMapUtils.maybeCsvNode(nodeIdMapCollection, csvXorNode);
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
