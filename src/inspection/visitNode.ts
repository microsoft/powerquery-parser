import { CommonError, isNever, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { Position, State } from "./inspection";

export function visitNode(xorNode: NodeIdMap.TXorNode, state: State): void {
    // tslint:disable-next-line: switch-default
    switch (xorNode.node.kind) {
        case Ast.NodeKind.IdentifierExpression:
            inspectIdentifierExpression(state, xorNode);
            break;
    }
}

function inspectIdentifierExpression(state: State, xorNode: NodeIdMap.TXorNode): void {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            if (xorNode.node.kind !== Ast.NodeKind.IdentifierExpression) {
                throw expectedNodeKindError(xorNode, Ast.NodeKind.IdentifierExpression);
            }

            const identifierExpression: Ast.IdentifierExpression = xorNode.node;
            let key: string = identifierExpression.identifier.literal;
            if (identifierExpression.maybeInclusiveConstant) {
                const inclusiveConstant: Ast.Constant = identifierExpression.maybeInclusiveConstant;
                key = inclusiveConstant.literal + key;
            }

            addAstToScopeIfNew(state, key, identifierExpression);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            let key: string = "";
            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

            // Add the optional inclusive constant `@` if it was parsed.
            const maybeInclusiveConstant: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                nodeIdMapCollection,
                xorNode.node.id,
                0,
                Ast.NodeKind.Constant,
            );
            if (maybeInclusiveConstant !== undefined) {
                const inclusiveConstant: Ast.Constant = maybeInclusiveConstant.node as Ast.Constant;
                key += inclusiveConstant.literal;
            }

            const maybeIdentifier: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeChildByAttributeIndex(
                nodeIdMapCollection,
                xorNode.node.id,
                1,
                Ast.NodeKind.Identifier,
            );
            if (maybeIdentifier !== undefined) {
                const identifier: Ast.Identifier = maybeIdentifier.node as Ast.Identifier;
                key += identifier.literal;
            }

            if (key.length) {
                addContextToScopeIfNew(state, key, xorNode.node);
            }

            break;
        }

        default:
            throw isNever(xorNode);
    }
}

function expectedNodeKindError(xorNode: NodeIdMap.TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
    const details: {} = { xorNode };
    return new CommonError.InvariantError(`expected xorNode to be of kind ${expected}`, details);
}

function isParentOfNodeKind(
    nodeIdMapCollection: NodeIdMap.Collection,
    childId: number,
    parentNodeKind: Ast.NodeKind,
): boolean {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(childId);
    if (maybeParentNodeId === undefined) {
        return false;
    }
    const parentNodeId: number = maybeParentNodeId;

    const maybeParentNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNode(nodeIdMapCollection, parentNodeId);
    if (maybeParentNode === undefined) {
        return false;
    }
    const parent: NodeIdMap.TXorNode = maybeParentNode;

    switch (parent.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return parent.node.kind === parentNodeKind;

        case NodeIdMap.XorNodeKind.Context:
            return parent.node.kind === parentNodeKind;

        default:
            throw isNever(parent);
    }
}

function isInTokenRange(position: Position, tokenRange: Ast.TokenRange): boolean {
    const tokenRangePositionStart: TokenPosition = tokenRange.positionStart;
    const tokenRangePositionEnd: TokenPosition = tokenRange.positionEnd;

    if (
        position.lineNumber < tokenRangePositionStart.lineNumber ||
        position.lineNumber > tokenRangePositionEnd.lineNumber
    ) {
        return false;
    } else if (
        position.lineNumber === tokenRangePositionStart.lineNumber &&
        position.lineCodeUnit < tokenRangePositionStart.lineCodeUnit
    ) {
        return false;
    } else if (
        position.lineNumber === tokenRangePositionEnd.lineNumber &&
        position.lineCodeUnit >= tokenRangePositionEnd.lineCodeUnit
    ) {
        return false;
    } else {
        return true;
    }
}

export function isTokenPositionOnPosition(tokenPosition: TokenPosition, position: Position): boolean {
    return position.lineNumber !== tokenPosition.lineNumber && position.lineCodeUnit !== tokenPosition.lineCodeUnit;
}

function isTokenPositionBeforePostiion(tokenPosition: TokenPosition, position: Position): boolean {
    return (
        tokenPosition.lineNumber < position.lineNumber ||
        (tokenPosition.lineNumber === position.lineNumber && tokenPosition.lineCodeUnit < position.lineCodeUnit)
    );
}

function addToScopeIfNew(state: State, key: string, xorNode: NodeIdMap.TXorNode): void {
    const scopeMap: Map<string, NodeIdMap.TXorNode> = state.result.scope;
    if (!scopeMap.has(key)) {
        scopeMap.set(key, xorNode);
    }
}

function addAstToScopeIfNew(state: State, key: string, astNode: Ast.TNode): void {
    addToScopeIfNew(state, key, {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: astNode,
    });
}

function addContextToScopeIfNew(state: State, key: string, contextNode: ParserContext.Node): void {
    addToScopeIfNew(state, key, {
        kind: NodeIdMap.XorNodeKind.Context,
        node: contextNode,
    });
}

// Same as TCsvArray.elements.map(csv => csv.node), plus TXorNode handling.
export function csvArrayChildrenXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    root: NodeIdMap.TXorNode,
): ReadonlyArray<NodeIdMap.TXorNode> {
    switch (root.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            if (root.node.kind !== Ast.NodeKind.CsvArray) {
                const details: {} = { root };
                throw new CommonError.InvariantError(
                    `root must have a Ast.NodeKind of ${Ast.NodeKind.CsvArray}`,
                    details,
                );
            }

            return root.node.elements.map(csv => {
                return {
                    kind: NodeIdMap.XorNodeKind.Ast,
                    node: csv.node,
                };
            });

        case NodeIdMap.XorNodeKind.Context: {
            if (root.node.kind !== Ast.NodeKind.CsvArray) {
                const details: {} = { root };
                throw new CommonError.InvariantError(
                    `root must have a Ast.NodeKind of ${Ast.NodeKind.CsvArray}`,
                    details,
                );
            }
            const csvArrayContextNode: ParserContext.Node = root.node;

            const result: NodeIdMap.TXorNode[] = [];

            const maybeCsvArrayChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(
                csvArrayContextNode.id,
            );
            if (maybeCsvArrayChildIds !== undefined) {
                const csvArrayChildIds: ReadonlyArray<number> = maybeCsvArrayChildIds;

                for (const csvId of csvArrayChildIds) {
                    const maybeCsvChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(csvId);
                    if (maybeCsvChildIds !== undefined) {
                        const csvChildIds: ReadonlyArray<number> = maybeCsvChildIds;
                        result.push(NodeIdMap.expectXorNode(nodeIdMapCollection, csvChildIds[0]));
                    }
                }
            }

            return result;
        }

        default:
            throw isNever(root);
    }
}
