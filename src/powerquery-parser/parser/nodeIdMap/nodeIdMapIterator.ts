// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, XorNodeUtils } from ".";
import { Assert, MapUtils, StringUtils } from "../../common";
import { Ast } from "../../language";
import { XorNode } from "./xorNode";

export type TKeyValuePair = LetKeyValuePair | RecordKeyValuePair | SectionKeyValuePair;

export interface IKeyValuePair<Key extends Ast.GeneralizedIdentifier | Ast.Identifier> {
    readonly source: TXorNode;
    readonly key: Key;
    readonly pairKind: PairKind;
    readonly keyLiteral: string;
    readonly normalizedKeyLiteral: string;
    readonly maybeValue: TXorNode | undefined;
}

export interface LetKeyValuePair extends IKeyValuePair<Ast.Identifier> {
    readonly pairKind: PairKind.LetExpression;
}

export interface RecordKeyValuePair extends IKeyValuePair<Ast.GeneralizedIdentifier> {
    readonly pairKind: PairKind.Record;
}

export interface SectionKeyValuePair extends IKeyValuePair<Ast.Identifier> {
    readonly pairKind: PairKind.SectionMember;
}

export const enum PairKind {
    LetExpression = "LetExpression",
    Record = "Record",
    SectionMember = "Section",
}

// -------------------------------
// -------- Simple iters  --------
// -------------------------------

// Assert the existence of children for the node.
// Returns an array of nodeIds of children for the given node.
export function assertIterChildIds(childIdsById: NodeIdMap.ChildIdsById, nodeId: number): ReadonlyArray<number> {
    return MapUtils.assertGet(childIdsById, nodeId);
}

// Assert the existence of children for the node and that they are Ast nodes.
// Returns an array of children (which are TNodes) for the given node.
export function assertIterChildrenAst(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    return assertIterChildIds(nodeIdMapCollection.childIdsById, parentId).map(childId =>
        NodeIdMapUtils.assertUnwrapAst(astNodeById, childId),
    );
}

// Assert the existence of children for the node.
// Returns an array of children (as XorNodes) for the given node.
export function assertIterChildrenXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<TXorNode> {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return [];
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    return assertIterXor(nodeIdMapCollection, childIds);
}

// Given a list of nodeIds, assert the existence of then return them as XorNodes.
export function assertIterXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
): ReadonlyArray<TXorNode> {
    return nodeIds.map(nodeId => NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId));
}

// If any exist, returns all Ast nodes under the given node.
export function maybeIterChildrenAst(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> | undefined {
    const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);
    if (maybeChildIds === undefined) {
        return undefined;
    }
    const childIds: ReadonlyArray<number> = maybeChildIds;

    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    return childIds.map(childId => NodeIdMapUtils.assertUnwrapAst(astNodeById, childId));
}

export function maybeNextSiblingXor(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): TXorNode | undefined {
    return maybeNthSiblingXor(nodeIdMapCollection, nodeId, 1);
}

// Grabs the parent for the given nodeId, then returns the nth child of the parent where that child's attributeIndex is
// (givenNode.maybeAttributeIndex + offset) as an XorNode if such a child exists.
export function maybeNthSiblingXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    rootId: number,
    offset: number,
): TXorNode | undefined {
    const childXorNode: TXorNode = NodeIdMapUtils.assertGetXor(nodeIdMapCollection, rootId);
    if (childXorNode.node.maybeAttributeIndex === undefined) {
        return undefined;
    }

    const attributeIndex: number = childXorNode.node.maybeAttributeIndex + offset;
    if (attributeIndex < 0) {
        return undefined;
    }

    const parentXorNode: TXorNode = NodeIdMapUtils.assertGetParentXor(nodeIdMapCollection, rootId);
    const childIds: ReadonlyArray<number> = assertIterChildIds(nodeIdMapCollection.childIdsById, parentXorNode.node.id);
    if (childIds.length >= attributeIndex) {
        return undefined;
    }

    return NodeIdMapUtils.maybeXor(nodeIdMapCollection, childIds[attributeIndex]);
}

// ------------------------------------------
// -------- NodeKind Specific Iters  --------
// ------------------------------------------

// Iterates over Ast.TCsv.node
export function iterArrayWrapper(
    nodeIdMapCollection: NodeIdMap.Collection,
    arrayWrapper: TXorNode,
): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsNodeKind(arrayWrapper, Ast.NodeKind.ArrayWrapper);

    if (arrayWrapper.kind === XorNodeKind.Ast) {
        return (arrayWrapper.node as Ast.TCsvArray).elements.map((wrapper: Ast.TCsv) =>
            XorNodeUtils.createAstNode(wrapper.node),
        );
    }

    const partial: TXorNode[] = [];
    for (const csvXorNode of assertIterChildrenXor(nodeIdMapCollection, arrayWrapper.node.id)) {
        switch (csvXorNode.kind) {
            case XorNodeKind.Ast:
                partial.push(XorNodeUtils.createAstNode((csvXorNode.node as Ast.TCsv).node));
                break;

            case XorNodeKind.Context: {
                const maybeChild: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
                    nodeIdMapCollection,
                    csvXorNode.node.id,
                    0,
                );
                if (maybeChild !== undefined) {
                    partial.push(maybeChild);
                }
                break;
            }

            default:
                throw Assert.isNever(csvXorNode);
        }
    }

    return partial;
}

// Return all FieldSelector children under the given FieldProjection.
export function iterFieldProjection(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldProjection: TXorNode,
): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsNodeKind(fieldProjection, Ast.NodeKind.FieldProjection);

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.maybeArrayWrapper(
        nodeIdMapCollection,
        fieldProjection,
    );
    return maybeArrayWrapper === undefined ? [] : iterArrayWrapper(nodeIdMapCollection, maybeArrayWrapper);
}

// Return all FieldSelector names under the given FieldProjection.
export function iterFieldProjectionNames(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldProjection: TXorNode,
): ReadonlyArray<string> {
    const result: string[] = [];

    for (const selector of iterFieldProjection(nodeIdMapCollection, fieldProjection)) {
        const maybeIdentifier: XorNode<Ast.GeneralizedIdentifier> | undefined = NodeIdMapUtils.maybeWrappedContent(
            nodeIdMapCollection,
            selector,
            Ast.NodeKind.GeneralizedIdentifier,
        );
        if (maybeIdentifier?.kind !== XorNodeKind.Ast) {
            break;
        } else {
            result.push(maybeIdentifier.node.literal);
        }
    }

    return result;
}

export function iterFunctionExpressionParameters(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionExpression: TXorNode,
): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsNodeKind(functionExpression, Ast.NodeKind.FunctionExpression);

    if (functionExpression.kind === XorNodeKind.Ast) {
        return (functionExpression.node as Ast.FunctionExpression).parameters.content.elements.map(
            (parameter: Ast.ICsv<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>) =>
                XorNodeUtils.createAstNode(parameter.node),
        );
    }

    const maybeParameterList:
        | XorNode<Ast.TParameterList>
        | undefined = NodeIdMapUtils.maybeNthChild(nodeIdMapCollection, functionExpression.node.id, 0, [
        Ast.NodeKind.ParameterList,
    ]);
    if (maybeParameterList === undefined) {
        return [];
    }

    return iterArrayWrapperInWrappedContent(nodeIdMapCollection, maybeParameterList);
}

export function iterFunctionExpressionParameterNames(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionExpression: TXorNode,
): ReadonlyArray<string> {
    const result: string[] = [];

    for (const parameter of iterFunctionExpressionParameters(nodeIdMapCollection, functionExpression)) {
        const maybeName: Ast.Identifier | undefined = NodeIdMapUtils.maybeUnwrapNthChildIfAst(
            nodeIdMapCollection,
            parameter.node.id,
            1,
            Ast.NodeKind.Identifier,
        );

        if (!maybeName) {
            return result;
        } else {
            result.push((maybeName as Ast.Identifier).literal);
        }
    }

    return result;
}

// Return all FieldSpecification children under the given FieldSpecificationList.
export function iterFieldSpecification(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldSpecificationList: XorNode<Ast.FieldSpecificationList>,
): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsNodeKind(fieldSpecificationList, Ast.NodeKind.FieldSpecificationList);
    return iterArrayWrapperInWrappedContent(nodeIdMapCollection, fieldSpecificationList);
}

export function iterInvokeExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    invokeExpression: XorNode<Ast.InvokeExpression>,
): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsNodeKind(invokeExpression, Ast.NodeKind.InvokeExpression);
    return iterArrayWrapperInWrappedContent(nodeIdMapCollection, invokeExpression);
}

// Return all key-value-pair children under the given LetExpression.
export function iterLetExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    letExpression: XorNode<Ast.LetExpression>,
): ReadonlyArray<LetKeyValuePair> {
    XorNodeUtils.assertIsNodeKind(letExpression, Ast.NodeKind.LetExpression);

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.maybeArrayWrapper(
        nodeIdMapCollection,
        letExpression,
    );
    if (maybeArrayWrapper === undefined) {
        return [];
    }

    return iterKeyValuePairs<Ast.Identifier, LetKeyValuePair>(
        nodeIdMapCollection,
        maybeArrayWrapper,
        PairKind.LetExpression,
    );
}

// Return all ListItem children under the given ListExpression/ListLiteral.
export function iterListItems(nodeIdMapCollection: NodeIdMap.Collection, list: TXorNode): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsList(list);
    return iterArrayWrapperInWrappedContent(nodeIdMapCollection, list);
}

// Return all key-value-pair children under the given RecordExpression/RecordLiteral.
export function iterRecord(
    nodeIdMapCollection: NodeIdMap.Collection,
    record: TXorNode,
): ReadonlyArray<RecordKeyValuePair> {
    XorNodeUtils.assertIsRecord(record);

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.maybeArrayWrapper(
        nodeIdMapCollection,
        record,
    );
    if (maybeArrayWrapper === undefined) {
        return [];
    }

    return iterKeyValuePairs<Ast.GeneralizedIdentifier, RecordKeyValuePair>(
        nodeIdMapCollection,
        maybeArrayWrapper,
        PairKind.Record,
    );
}

// Return all key-value-pair children under the given Section.
export function iterSection(
    nodeIdMapCollection: NodeIdMap.Collection,
    section: TXorNode,
): ReadonlyArray<SectionKeyValuePair> {
    XorNodeUtils.assertIsNodeKind(section, Ast.NodeKind.Section);

    if (section.kind === XorNodeKind.Ast) {
        return (section.node as Ast.Section).sectionMembers.elements.map((sectionMember: Ast.SectionMember) => {
            const namePairedExpression: Ast.IdentifierPairedExpression = sectionMember.namePairedExpression;
            const keyLiteral: string = namePairedExpression.key.literal;

            return {
                source: XorNodeUtils.createAstNode(namePairedExpression),
                key: namePairedExpression.key,
                keyLiteral,
                normalizedKeyLiteral: StringUtils.normalizeIdentifier(keyLiteral),
                maybeValue: XorNodeUtils.createAstNode(namePairedExpression.value),
                pairKind: PairKind.SectionMember,
            };
        });
    }

    const maybeSectionMemberArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.maybeNthChild(
        nodeIdMapCollection,
        section.node.id,
        4,
        Ast.NodeKind.ArrayWrapper,
    );
    if (maybeSectionMemberArrayWrapper === undefined) {
        return [];
    }
    const sectionMemberArrayWrapper: TXorNode = maybeSectionMemberArrayWrapper;

    const partial: SectionKeyValuePair[] = [];
    for (const sectionMember of assertIterChildrenXor(nodeIdMapCollection, sectionMemberArrayWrapper.node.id)) {
        const maybeKeyValuePair: XorNode<Ast.IdentifierPairedExpression> | undefined = NodeIdMapUtils.maybeNthChild(
            nodeIdMapCollection,
            sectionMember.node.id,
            2,
            Ast.NodeKind.IdentifierPairedExpression,
        );
        if (maybeKeyValuePair === undefined) {
            continue;
        }
        const keyValuePair: TXorNode = maybeKeyValuePair;
        const keyValuePairNodeId: number = keyValuePair.node.id;

        const maybeKey: Ast.Identifier | undefined = NodeIdMapUtils.maybeUnwrapNthChildIfAst(
            nodeIdMapCollection,
            keyValuePairNodeId,
            0,
            Ast.NodeKind.Identifier,
        );
        if (maybeKey === undefined) {
            continue;
        }
        const key: Ast.Identifier = maybeKey;
        const keyLiteral: string = key.literal;

        partial.push({
            source: keyValuePair,
            key,
            keyLiteral,
            normalizedKeyLiteral: StringUtils.normalizeIdentifier(keyLiteral),
            maybeValue: NodeIdMapUtils.maybeNthChild(nodeIdMapCollection, keyValuePairNodeId, 2),
            pairKind: PairKind.SectionMember,
        });
    }

    return partial;
}

function iterKeyValuePairs<
    Key extends Ast.GeneralizedIdentifier | Ast.Identifier,
    KVP extends TKeyValuePair & IKeyValuePair<Key>
>(nodeIdMapCollection: NodeIdMap.Collection, arrayWrapper: TXorNode, pairKind: KVP["pairKind"]): ReadonlyArray<KVP> {
    const partial: KVP[] = [];
    for (const keyValuePair of iterArrayWrapper(nodeIdMapCollection, arrayWrapper)) {
        const maybeKey: Key | undefined = NodeIdMapUtils.maybeUnwrapNthChildIfAst(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier],
        );
        if (maybeKey === undefined) {
            break;
        }
        const keyLiteral: string = maybeKey.literal;

        partial.push({
            source: keyValuePair,
            key: maybeKey,
            keyLiteral,
            normalizedKeyLiteral: StringUtils.normalizeIdentifier(keyLiteral),
            maybeValue: NodeIdMapUtils.maybeNthChild(nodeIdMapCollection, keyValuePair.node.id, 2),
            pairKind,
        } as KVP);
    }

    return partial;
}

function iterArrayWrapperInWrappedContent(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: XorNode<Ast.TWrapped>,
): ReadonlyArray<TXorNode> {
    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.maybeArrayWrapper(
        nodeIdMapCollection,
        xorNode,
    );
    if (maybeArrayWrapper === undefined) {
        return [];
    }

    return iterArrayWrapper(nodeIdMapCollection, maybeArrayWrapper);
}
