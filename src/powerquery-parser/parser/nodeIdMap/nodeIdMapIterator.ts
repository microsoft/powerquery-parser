// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ResultUtils } from "../../common";
import { Ast, Constant, IdentifierUtils } from "../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, XorNodeUtils } from ".";
import { parameterIdentifier } from "./nodeIdMapUtils";
import { XorNode } from "./xorNode";

export type TKeyValuePair = FieldSpecificationKeyValuePair | LetKeyValuePair | RecordKeyValuePair | SectionKeyValuePair;

export interface IKeyValuePair<Key extends Ast.GeneralizedIdentifier | Ast.Identifier> {
    readonly source: TXorNode;
    readonly key: Key;
    readonly pairKind: PairKind;
    readonly keyLiteral: string;
    readonly normalizedKeyLiteral: string;
    readonly value: TXorNode | undefined;
}

export interface FieldSpecificationKeyValuePair extends IKeyValuePair<Ast.GeneralizedIdentifier> {
    readonly pairKind: PairKind.FieldSpecification;
    readonly optional: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined;
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

export enum PairKind {
    FieldSpecification = "RecordType",
    LetExpression = "LetExpression",
    Record = "Record",
    SectionMember = "Section",
}

// -------------------------------
// -------- Simple iters  --------
// -------------------------------

// Assert the existence of children for the node and that they are Ast nodes.
// Returns an array of children (which are TNodes) for the given node.
export function assertIterChildrenAst(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> {
    return NodeIdMapUtils.assertChildIds(nodeIdMapCollection.childIdsById, parentId).map((childId: number) =>
        NodeIdMapUtils.assertAst(nodeIdMapCollection, childId),
    );
}

// Assert the existence of children for the node.
// Returns an array of children (as XorNodes) for the given node.
export function assertIterChildrenXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<TXorNode> {
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);

    if (childIds === undefined) {
        return [];
    }

    return assertIterXor(nodeIdMapCollection, childIds);
}

// Given a list of nodeIds, assert the existence of then return them as XorNodes.
export function assertIterXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
): ReadonlyArray<TXorNode> {
    return nodeIds.map((nodeId: number) => NodeIdMapUtils.assertXor(nodeIdMapCollection, nodeId));
}

// If any exist, returns all Ast nodes under the given node.
export function iterChildrenAst(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
): ReadonlyArray<Ast.TNode> | undefined {
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);

    if (childIds === undefined) {
        return undefined;
    }

    return childIds.map((childId: number) => NodeIdMapUtils.assertAst(nodeIdMapCollection, childId));
}

export function nextSiblingXor(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): TXorNode | undefined {
    return nthSiblingXor(nodeIdMapCollection, nodeId, 1);
}

// Grabs the parent for the given nodeId, then returns the nth child of the parent where that child's attributeIndex is
// (givenNode.attributeIndex + offset) as an XorNode if such a child exists.
export function nthSiblingXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    offset: number,
): TXorNode | undefined {
    const childXorNode: TXorNode = NodeIdMapUtils.assertXor(nodeIdMapCollection, nodeId);

    if (childXorNode.node.attributeIndex === undefined) {
        return undefined;
    }

    const attributeIndex: number = childXorNode.node.attributeIndex + offset;

    if (attributeIndex < 0) {
        return undefined;
    }

    const parentXorNode: TXorNode = NodeIdMapUtils.assertParentXor(nodeIdMapCollection, nodeId);

    const childIds: ReadonlyArray<number> = NodeIdMapUtils.assertChildIds(
        nodeIdMapCollection.childIdsById,
        parentXorNode.node.id,
    );

    if (childIds.length >= attributeIndex) {
        return undefined;
    }

    return NodeIdMapUtils.xor(nodeIdMapCollection, childIds[attributeIndex]);
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

    if (XorNodeUtils.isAst(arrayWrapper)) {
        return (arrayWrapper.node as Ast.TCsvArray).elements.map((wrapper: Ast.TCsv) =>
            XorNodeUtils.boxAst(wrapper.node),
        );
    }

    const partial: TXorNode[] = [];

    for (const csvXorNode of assertIterChildrenXor(nodeIdMapCollection, arrayWrapper.node.id)) {
        switch (csvXorNode.kind) {
            case XorNodeKind.Ast:
                partial.push(XorNodeUtils.boxAst((csvXorNode.node as Ast.TCsv).node));
                break;

            case XorNodeKind.Context: {
                const child: TXorNode | undefined = NodeIdMapUtils.nthChildXor(
                    nodeIdMapCollection,
                    csvXorNode.node.id,
                    0,
                );

                if (child !== undefined) {
                    partial.push(child);
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
): ReadonlyArray<XorNode<Ast.FieldSelector>> {
    XorNodeUtils.assertIsNodeKind(fieldProjection, Ast.NodeKind.FieldProjection);

    const arrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.arrayWrapperContentXor(
        nodeIdMapCollection,
        fieldProjection.node.id,
    );

    if (!arrayWrapper) {
        return [];
    }

    const result: XorNode<Ast.FieldSelector>[] = [];

    for (const child of iterArrayWrapper(nodeIdMapCollection, arrayWrapper)) {
        XorNodeUtils.assertIsNodeKind<Ast.FieldSelector>(child, Ast.NodeKind.FieldSelector);

        result.push(child);
    }

    return result;
}

// Return all FieldSelector names under the given FieldProjection.
export function iterFieldProjectionFieldLiterals(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldProjection: TXorNode,
): ReadonlyArray<string> {
    const result: string[] = [];

    for (const selector of iterFieldProjection(nodeIdMapCollection, fieldProjection)) {
        const identifier: XorNode<Ast.GeneralizedIdentifier> | undefined =
            NodeIdMapUtils.wrappedContentXorChecked<Ast.GeneralizedIdentifier>(
                nodeIdMapCollection,
                selector.node.id,
                Ast.NodeKind.GeneralizedIdentifier,
            );

        if (identifier && XorNodeUtils.isAst(identifier)) {
            result.push(identifier.node.literal);
        }
    }

    return result;
}

export function iterFunctionExpressionParameters(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionExpression: TXorNode,
): ReadonlyArray<XorNode<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>> {
    XorNodeUtils.assertIsNodeKind(functionExpression, Ast.NodeKind.FunctionExpression);

    if (XorNodeUtils.isAstChecked<Ast.FunctionExpression>(functionExpression, Ast.NodeKind.FunctionExpression)) {
        return functionExpression.node.parameters.content.elements.map(
            (parameter: Ast.ICsv<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>) =>
                XorNodeUtils.boxAst(parameter.node),
        );
    }

    const parameterList: XorNode<Ast.TParameterList> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.TParameterList>(
            nodeIdMapCollection,
            functionExpression.node.id,
            0,
            Ast.NodeKind.ParameterList,
        );

    if (parameterList === undefined) {
        return [];
    }

    const result: XorNode<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>[] = [];

    for (const xorNode of iterArrayWrapperInWrappedContent(nodeIdMapCollection, parameterList)) {
        XorNodeUtils.assertIsNodeKind<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>(
            xorNode,
            Ast.NodeKind.Parameter,
        );

        result.push(xorNode);
    }

    return result;
}

export function iterFunctionExpressionParameterNames(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionExpression: TXorNode,
): ReadonlyArray<Ast.Identifier> {
    const result: Ast.Identifier[] = [];

    for (const parameter of iterFunctionExpressionParameters(nodeIdMapCollection, functionExpression)) {
        const name: Ast.Identifier | undefined = parameterIdentifier(nodeIdMapCollection, parameter);

        if (name === undefined) {
            break;
        }

        result.push(name);
    }

    return result;
}

export function iterFunctionExpressionParameterNameLiterals(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionExpression: TXorNode,
): ReadonlyArray<string> {
    return iterFunctionExpressionParameterNames(nodeIdMapCollection, functionExpression).map(
        (identifier: Ast.Identifier) => identifier.literal,
    );
}

// Return all FieldSpecification children under the given FieldSpecificationList.
export function iterFieldSpecificationList(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldSpecificationList: TXorNode,
): ReadonlyArray<FieldSpecificationKeyValuePair> {
    XorNodeUtils.assertIsNodeKind<Ast.FieldSpecificationList>(
        fieldSpecificationList,
        Ast.NodeKind.FieldSpecificationList,
    );

    const result: FieldSpecificationKeyValuePair[] = [];

    for (const fieldSpecification of iterArrayWrapperInWrappedContent(nodeIdMapCollection, fieldSpecificationList)) {
        const key: Ast.GeneralizedIdentifier | undefined = NodeIdMapUtils.nthChildAstChecked(
            nodeIdMapCollection,
            fieldSpecification.node.id,
            1,
            Ast.NodeKind.GeneralizedIdentifier,
        );

        if (key === undefined) {
            break;
        }

        const optional: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined =
            NodeIdMapUtils.nthChildAstChecked<Ast.IConstant<Constant.LanguageConstant.Optional>>(
                nodeIdMapCollection,
                fieldSpecification.node.id,
                0,
                Ast.NodeKind.Constant,
            );

        const value: XorNode<Ast.FieldSpecification> | undefined =
            NodeIdMapUtils.nthChildXorChecked<Ast.FieldSpecification>(
                nodeIdMapCollection,
                fieldSpecification.node.id,
                2,
                Ast.NodeKind.FieldSpecification,
            );

        const keyLiteral: string = key.literal;

        result.push({
            key,
            keyLiteral,
            optional,
            value,
            normalizedKeyLiteral: ResultUtils.assertOk(
                IdentifierUtils.getNormalizedIdentifier(keyLiteral, /* isGeneralizedIdentifierAllowed */ true),
            ),
            pairKind: PairKind.FieldSpecification,
            source: fieldSpecification,
        });
    }

    return result;
}

export function iterInvokeExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    invokeExpression: TXorNode,
): ReadonlyArray<TXorNode> {
    XorNodeUtils.assertIsNodeKind<Ast.InvokeExpression>(invokeExpression, Ast.NodeKind.InvokeExpression);

    return iterArrayWrapperInWrappedContent(nodeIdMapCollection, invokeExpression);
}

// Return all key-value-pair children under the given LetExpression.
export function iterLetExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    letExpression: TXorNode,
): ReadonlyArray<LetKeyValuePair> {
    XorNodeUtils.assertIsNodeKind<Ast.LetExpression>(letExpression, Ast.NodeKind.LetExpression);

    const arrayWrapper: TXorNode | undefined = NodeIdMapUtils.arrayWrapperContentXor(
        nodeIdMapCollection,
        letExpression.node.id,
    );

    if (arrayWrapper === undefined) {
        return [];
    }

    return iterKeyValuePairs<Ast.Identifier, LetKeyValuePair>(
        nodeIdMapCollection,
        arrayWrapper,
        PairKind.LetExpression,
        /* isGeneralizedIdentifierAllowed */ false,
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

    const arrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.arrayWrapperContentXor(
        nodeIdMapCollection,
        record.node.id,
    );

    if (arrayWrapper === undefined) {
        return [];
    }

    return iterKeyValuePairs<Ast.GeneralizedIdentifier, RecordKeyValuePair>(
        nodeIdMapCollection,
        arrayWrapper,
        PairKind.Record,
        /* isGeneralizedIdentifierAllowed */ true,
    );
}

export function iterRecordType(
    nodeIdMapCollection: NodeIdMap.Collection,
    recordType: TXorNode,
): ReadonlyArray<FieldSpecificationKeyValuePair> {
    XorNodeUtils.assertIsNodeKind<Ast.RecordType>(recordType, Ast.NodeKind.RecordType);

    const fields: XorNode<Ast.FieldSpecificationList> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.FieldSpecificationList>(
            nodeIdMapCollection,
            recordType.node.id,
            0,
            Ast.NodeKind.FieldSpecificationList,
        );

    if (fields === undefined) {
        return [];
    }

    return iterFieldSpecificationList(nodeIdMapCollection, fields);
}

// Return all key-value-pair children under the given Section.
export function iterSection(
    nodeIdMapCollection: NodeIdMap.Collection,
    section: TXorNode,
): ReadonlyArray<SectionKeyValuePair> {
    XorNodeUtils.assertIsNodeKind(section, Ast.NodeKind.Section);

    if (XorNodeUtils.isAstChecked<Ast.Section>(section, Ast.NodeKind.Section)) {
        return section.node.sectionMembers.elements.map((sectionMember: Ast.SectionMember) => {
            const namePairedExpression: Ast.IdentifierPairedExpression = sectionMember.namePairedExpression;
            const keyLiteral: string = namePairedExpression.key.literal;

            return {
                source: XorNodeUtils.boxAst(namePairedExpression),
                key: namePairedExpression.key,
                keyLiteral,
                normalizedKeyLiteral: ResultUtils.assertOk(
                    IdentifierUtils.getNormalizedIdentifier(keyLiteral, /* isGeneralizedIdentifierAllowed */ true),
                ),
                value: XorNodeUtils.boxAst(namePairedExpression.value),
                pairKind: PairKind.SectionMember,
            };
        });
    }

    const sectionMemberArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.TArrayWrapper>(
            nodeIdMapCollection,
            section.node.id,
            4,
            Ast.NodeKind.ArrayWrapper,
        );

    if (sectionMemberArrayWrapper === undefined) {
        return [];
    }

    const partial: SectionKeyValuePair[] = [];

    for (const sectionMember of assertIterChildrenXor(nodeIdMapCollection, sectionMemberArrayWrapper.node.id)) {
        const keyValuePair: XorNode<Ast.IdentifierPairedExpression> | undefined =
            NodeIdMapUtils.nthChildXorChecked<Ast.IdentifierPairedExpression>(
                nodeIdMapCollection,
                sectionMember.node.id,
                2,
                Ast.NodeKind.IdentifierPairedExpression,
            );

        if (keyValuePair === undefined) {
            continue;
        }

        const keyValuePairNodeId: number = keyValuePair.node.id;

        const keyKey: Ast.Identifier | undefined = NodeIdMapUtils.nthChildAstChecked(
            nodeIdMapCollection,
            keyValuePair.node.id,
            0,
            Ast.NodeKind.Identifier,
        );

        if (keyKey === undefined) {
            continue;
        }

        const key: Ast.Identifier = keyKey;
        const keyLiteral: string = key.literal;

        partial.push({
            source: keyValuePair,
            key,
            keyLiteral,
            normalizedKeyLiteral: ResultUtils.assertOk(
                IdentifierUtils.getNormalizedIdentifier(keyLiteral, /* isGeneralizedIdentifierAllowed */ true),
            ),
            value: NodeIdMapUtils.nthChildXor(nodeIdMapCollection, keyValuePairNodeId, 2),
            pairKind: PairKind.SectionMember,
        });
    }

    return partial;
}

function iterKeyValuePairs<
    Key extends Ast.GeneralizedIdentifier | Ast.Identifier,
    KVP extends TKeyValuePair & IKeyValuePair<Key>,
>(
    nodeIdMapCollection: NodeIdMap.Collection,
    arrayWrapper: TXorNode,
    pairKind: TKeyValuePair["pairKind"],
    isGeneralizedIdentifierAllowed: boolean,
): ReadonlyArray<KVP> {
    const partial: KVP[] = [];

    for (const keyValuePair of iterArrayWrapper(nodeIdMapCollection, arrayWrapper)) {
        const key: Key | undefined = NodeIdMapUtils.nthChildAstChecked(nodeIdMapCollection, keyValuePair.node.id, 0, [
            Ast.NodeKind.GeneralizedIdentifier,
            Ast.NodeKind.Identifier,
        ]);

        if (key === undefined) {
            break;
        }

        const keyLiteral: string = key.literal;

        partial.push({
            source: keyValuePair,
            key,
            keyLiteral,
            normalizedKeyLiteral: ResultUtils.assertOk(
                IdentifierUtils.getNormalizedIdentifier(keyLiteral, isGeneralizedIdentifierAllowed),
            ),
            value: NodeIdMapUtils.nthChildXor(nodeIdMapCollection, keyValuePair.node.id, 2),
            pairKind,
        } as KVP);
    }

    return partial;
}

function iterArrayWrapperInWrappedContent(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
): ReadonlyArray<TXorNode> {
    const arrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.arrayWrapperContentXor(
        nodeIdMapCollection,
        xorNode.node.id,
    );

    if (arrayWrapper === undefined) {
        return [];
    }

    return iterArrayWrapper(nodeIdMapCollection, arrayWrapper);
}
