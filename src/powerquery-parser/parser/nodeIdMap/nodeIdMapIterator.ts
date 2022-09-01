// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, MapUtils } from "../../common";
import { Ast, Constant, TextUtils } from "../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, XorNodeUtils } from ".";
import { IConstant } from "../../language/ast/ast";
import { maybeUnboxIdentifier } from "./nodeIdMapUtils";
import { XorNode } from "./xorNode";

export type TKeyValuePair = FieldSpecificationKeyValuePair | LetKeyValuePair | RecordKeyValuePair | SectionKeyValuePair;

export interface IKeyValuePair<Key extends Ast.GeneralizedIdentifier | Ast.Identifier> {
    readonly source: TXorNode;
    readonly key: Key;
    readonly pairKind: PairKind;
    readonly keyLiteral: string;
    readonly normalizedKeyLiteral: string;
    readonly maybeValue: TXorNode | undefined;
}

export interface FieldSpecificationKeyValuePair extends IKeyValuePair<Ast.GeneralizedIdentifier> {
    readonly pairKind: PairKind.FieldSpecification;
    readonly maybeOptional: IConstant<Constant.LanguageConstant.Optional> | undefined;
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
    FieldSpecification = "RecordType",
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

    return assertIterChildIds(nodeIdMapCollection.childIdsById, parentId).map((childId: number) =>
        NodeIdMapUtils.assertUnboxAst(astNodeById, childId),
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

    return assertIterXor(nodeIdMapCollection, maybeChildIds);
}

// Given a list of nodeIds, assert the existence of then return them as XorNodes.
export function assertIterXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
): ReadonlyArray<TXorNode> {
    return nodeIds.map((nodeId: number) => NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId));
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

    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;

    return maybeChildIds.map((childId: number) => NodeIdMapUtils.assertUnboxAst(astNodeById, childId));
}

export function maybeNextSiblingXor(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): TXorNode | undefined {
    return maybeNthSiblingXor(nodeIdMapCollection, nodeId, 1);
}

// Grabs the parent for the given nodeId, then returns the nth child of the parent where that child's attributeIndex is
// (givenNode.maybeAttributeIndex + offset) as an XorNode if such a child exists.
export function maybeNthSiblingXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    offset: number,
): TXorNode | undefined {
    const childXorNode: TXorNode = NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId);

    if (childXorNode.node.attributeIndex === undefined) {
        return undefined;
    }

    const attributeIndex: number = childXorNode.node.attributeIndex + offset;

    if (attributeIndex < 0) {
        return undefined;
    }

    const parentXorNode: TXorNode = NodeIdMapUtils.assertGetParentXor(nodeIdMapCollection, nodeId);
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

    if (XorNodeUtils.isAstXor(arrayWrapper)) {
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
                const maybeChild: TXorNode | undefined = NodeIdMapUtils.nthChild(
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

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.unboxArrayWrapper(
        nodeIdMapCollection,
        fieldProjection.node.id,
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
        const maybeIdentifier: XorNode<Ast.GeneralizedIdentifier> | undefined =
            NodeIdMapUtils.unboxWrappedContentChecked<Ast.GeneralizedIdentifier>(
                nodeIdMapCollection,
                selector.node.id,
                Ast.NodeKind.GeneralizedIdentifier,
            );

        if (maybeIdentifier && XorNodeUtils.isAstXor(maybeIdentifier)) {
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

    if (XorNodeUtils.isAstXorChecked<Ast.FunctionExpression>(functionExpression, Ast.NodeKind.FunctionExpression)) {
        return functionExpression.node.parameters.content.elements.map(
            (parameter: Ast.ICsv<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>) =>
                XorNodeUtils.boxAst(parameter.node),
        );
    }

    const maybeParameterList: XorNode<Ast.TParameterList> | undefined =
        NodeIdMapUtils.nthChildChecked<Ast.TParameterList>(
            nodeIdMapCollection,
            functionExpression.node.id,
            0,
            Ast.NodeKind.ParameterList,
        );

    if (maybeParameterList === undefined) {
        return [];
    }

    return iterArrayWrapperInWrappedContent(nodeIdMapCollection, maybeParameterList);
}

export function iterFunctionExpressionParameterNames(
    nodeIdMapCollection: NodeIdMap.Collection,
    functionExpression: TXorNode,
): ReadonlyArray<Ast.Identifier> {
    const result: Ast.Identifier[] = [];

    for (const parameter of iterFunctionExpressionParameters(nodeIdMapCollection, functionExpression)) {
        const maybeName: Ast.Identifier | undefined = maybeUnboxIdentifier(nodeIdMapCollection, parameter);

        if (maybeName === undefined) {
            break;
        }

        result.push(maybeName);
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
        const maybeKey: Ast.GeneralizedIdentifier | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked(
            nodeIdMapCollection,
            fieldSpecification.node.id,
            1,
            Ast.NodeKind.GeneralizedIdentifier,
        );

        if (maybeKey === undefined) {
            break;
        }

        const maybeOptional: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined =
            NodeIdMapUtils.unboxNthChildIfAstChecked<Ast.IConstant<Constant.LanguageConstant.Optional>>(
                nodeIdMapCollection,
                fieldSpecification.node.id,
                0,
                Ast.NodeKind.Constant,
            );

        const maybeValue: XorNode<Ast.FieldSpecification> | undefined =
            NodeIdMapUtils.nthChildChecked<Ast.FieldSpecification>(
                nodeIdMapCollection,
                fieldSpecification.node.id,
                2,
                Ast.NodeKind.FieldSpecification,
            );

        const keyLiteral: string = maybeKey.literal;

        result.push({
            key: maybeKey,
            keyLiteral,
            maybeOptional,
            maybeValue,
            normalizedKeyLiteral: TextUtils.normalizeIdentifier(keyLiteral),
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

    const maybeArrayWrapper: TXorNode | undefined = NodeIdMapUtils.unboxArrayWrapper(
        nodeIdMapCollection,
        letExpression.node.id,
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

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.unboxArrayWrapper(
        nodeIdMapCollection,
        record.node.id,
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

export function iterRecordType(
    nodeIdMapCollection: NodeIdMap.Collection,
    recordType: TXorNode,
): ReadonlyArray<FieldSpecificationKeyValuePair> {
    XorNodeUtils.assertIsRecordType(recordType);

    const maybeFields: XorNode<Ast.FieldSpecificationList> | undefined =
        NodeIdMapUtils.nthChildChecked<Ast.FieldSpecificationList>(
            nodeIdMapCollection,
            recordType.node.id,
            0,
            Ast.NodeKind.FieldSpecificationList,
        );

    if (maybeFields === undefined) {
        return [];
    }

    return iterFieldSpecificationList(nodeIdMapCollection, maybeFields);
}

// Return all key-value-pair children under the given Section.
export function iterSection(
    nodeIdMapCollection: NodeIdMap.Collection,
    section: TXorNode,
): ReadonlyArray<SectionKeyValuePair> {
    XorNodeUtils.assertIsNodeKind(section, Ast.NodeKind.Section);

    if (XorNodeUtils.isAstXorChecked<Ast.Section>(section, Ast.NodeKind.Section)) {
        return section.node.sectionMembers.elements.map((sectionMember: Ast.SectionMember) => {
            const namePairedExpression: Ast.IdentifierPairedExpression = sectionMember.namePairedExpression;
            const keyLiteral: string = namePairedExpression.key.literal;

            return {
                source: XorNodeUtils.boxAst(namePairedExpression),
                key: namePairedExpression.key,
                keyLiteral,
                normalizedKeyLiteral: TextUtils.normalizeIdentifier(keyLiteral),
                maybeValue: XorNodeUtils.boxAst(namePairedExpression.value),
                pairKind: PairKind.SectionMember,
            };
        });
    }

    const maybeSectionMemberArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined =
        NodeIdMapUtils.nthChildChecked<Ast.TArrayWrapper>(
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
        const maybeKeyValuePair: XorNode<Ast.IdentifierPairedExpression> | undefined =
            NodeIdMapUtils.nthChildChecked<Ast.IdentifierPairedExpression>(
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

        const maybeKey: Ast.Identifier | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked(
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
            normalizedKeyLiteral: TextUtils.normalizeIdentifier(keyLiteral),
            maybeValue: NodeIdMapUtils.nthChild(nodeIdMapCollection, keyValuePairNodeId, 2),
            pairKind: PairKind.SectionMember,
        });
    }

    return partial;
}

function iterKeyValuePairs<
    Key extends Ast.GeneralizedIdentifier | Ast.Identifier,
    KVP extends TKeyValuePair & IKeyValuePair<Key>,
>(nodeIdMapCollection: NodeIdMap.Collection, arrayWrapper: TXorNode, pairKind: KVP["pairKind"]): ReadonlyArray<KVP> {
    const partial: KVP[] = [];

    for (const keyValuePair of iterArrayWrapper(nodeIdMapCollection, arrayWrapper)) {
        const maybeKey: Key | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked(
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
            normalizedKeyLiteral: TextUtils.normalizeIdentifier(keyLiteral),
            maybeValue: NodeIdMapUtils.nthChild(nodeIdMapCollection, keyValuePair.node.id, 2),
            pairKind,
        } as KVP);
    }

    return partial;
}

function iterArrayWrapperInWrappedContent(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.unboxArrayWrapper(
        nodeIdMapCollection,
        xorNode.node.id,
    );

    if (maybeArrayWrapper === undefined) {
        return [];
    }

    return iterArrayWrapper(nodeIdMapCollection, maybeArrayWrapper);
}
