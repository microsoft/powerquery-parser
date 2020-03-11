import { CommonError, isNever } from "../common";
import { isDefined } from "../common/typeUtils";
import { Ast, NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../parser";
import { Type, TypeUtils } from "./type";

export interface FunctionExpression {
    readonly parameters: ReadonlyArray<FunctionParameter>;
    readonly isReturnNullale: boolean;
    readonly maybeReturnType: undefined | Ast.AsNullablePrimitiveType;
}

export interface FunctionParameter {
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: undefined | Type.TypeKind;
}

export function examineFunctionExpression(nodeIdMapCollection: NodeIdMap.Collection, fnExpr: TXorNode): void {
    if (fnExpr.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExpr, Ast.NodeKind.FunctionExpression);
    }

    const examinedParameters: FunctionParameter[] = [];

    // Iterates all parameters as TXorNodes if they exist, otherwise early exists from an empty list.
    for (const parameter of functionParameterXorNodes(nodeIdMapCollection, fnExpr)) {
        // A parameter isn't examinable if it doesn't have an Ast.Identifier for its name.
        const maybeExaminable: undefined | FunctionParameter = examineParameter(nodeIdMapCollection, parameter);
        if (maybeExaminable !== undefined) {
            examinedParameters.push(maybeExaminable);
        }
    }

    const maybeReturnType: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        fnExpr.node.id,
        1,
        [Ast.NodeKind.AsNullablePrimitiveType],
    );

    // if (maybeReturnType !== undefined) {

    // }
    // else {

    // }
}

export function expectedNodeKindError(xorNode: TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
    const details: {} = {
        xorNodeId: xorNode.node.id,
        expectedNodeKind: expected,
        actualNodeKind: xorNode.node.kind,
    };
    return new CommonError.InvariantError(`${expectedNodeKindError}`, details);
}

function functionParameterXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): ReadonlyArray<TXorNode> {
    if (fnExpr.node.kind !== Ast.NodeKind.FunctionExpression) {
        throw expectedNodeKindError(fnExpr, Ast.NodeKind.FunctionExpression);
    }

    let parameters: ReadonlyArray<TXorNode>;
    if (fnExpr.kind === XorNodeKind.Context) {
        const maybeParameterList:
            | undefined
            | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, fnExpr.node.id, 1, [
            Ast.NodeKind.ParameterList,
        ]);

        if (maybeParameterList !== undefined) {
            const maybeCsvArray:
                | undefined
                | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(
                nodeIdMapCollection,
                maybeParameterList.node.id,
                1,
                [Ast.NodeKind.ArrayWrapper],
            );
            if (maybeCsvArray !== undefined) {
                parameters =
                    // Grab all csv elements in the array
                    NodeIdMapUtils.expectXorChildren(nodeIdMapCollection, maybeCsvArray.node.id)
                        // Grab the value out of the csv (if it exists)
                        .map((csv: TXorNode) =>
                            NodeIdMapUtils.maybeXorChildByAttributeIndex(
                                nodeIdMapCollection,
                                csv.node.id,
                                0,
                                undefined,
                            ),
                        )
                        // Drop those that didn't start parsing their children.
                        // This should only happen at most once at the last node.
                        .filter(isDefined);
            } else {
                parameters = [];
            }
        } else {
            parameters = [];
        }
    } else {
        parameters = (fnExpr.node as Ast.FunctionExpression).parameters.content.elements.map(
            (csv: Ast.ICsv<Ast.IParameter<Ast.TParameterType>>) => NodeIdMapUtils.xorNodeFromAst(csv.node),
        );
    }

    return parameters;
}

function examineParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: TXorNode,
): undefined | FunctionParameter {
    switch (parameter.kind) {
        case XorNodeKind.Ast:
            return examineAstParameter(parameter.node as Ast.IParameter<Ast.AsNullablePrimitiveType>);

        case XorNodeKind.Context:
            return examineContextParameter(nodeIdMapCollection, parameter.node);

        default:
            throw isNever(parameter);
    }
}

function examineAstParameter(node: Ast.IParameter<Ast.AsNullablePrimitiveType>): FunctionParameter {
    let isNullable: boolean;
    let maybeType: undefined | Type.TypeKind;

    const maybeParameterType: Ast.AsNullablePrimitiveType | undefined = node.maybeParameterType;
    if (maybeParameterType !== undefined) {
        const simplified: Type.SimplifiedNullablePrimitiveType = TypeUtils.simplifyNullablePrimitiveType(
            maybeParameterType,
        );
        isNullable = simplified.isNullable;
        maybeType = simplified.pqType;
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        name: node.name,
        isOptional: node.maybeOptionalConstant !== undefined,
        isNullable,
        maybeType,
    };
}

function examineContextParameter(
    nodeIdMapCollection: NodeIdMap.Collection,
    parameter: ParseContext.Node,
): undefined | FunctionParameter {
    let name: Ast.Identifier;
    let isOptional: boolean;
    let isNullable: boolean;
    let maybeType: undefined | Type.TypeKind;

    const maybeName: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        1,
        [Ast.NodeKind.Identifier],
    );
    if (maybeName === undefined) {
        return undefined;
    }
    name = maybeName as Ast.Identifier;

    const maybeOptional: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        0,
        [Ast.NodeKind.Constant],
    );
    isOptional = maybeOptional !== undefined;

    const maybeParameterType: undefined | Ast.TNode = NodeIdMapUtils.maybeAstChildByAttributeIndex(
        nodeIdMapCollection,
        parameter.id,
        2,
        undefined,
    );
    if (maybeParameterType !== undefined) {
        const parameterType: Ast.AsNullablePrimitiveType = maybeParameterType as Ast.AsNullablePrimitiveType;
        const simplified: Type.SimplifiedNullablePrimitiveType = TypeUtils.simplifyNullablePrimitiveType(parameterType);
        isNullable = simplified.isNullable;
        maybeType = simplified.pqType;
    } else {
        isNullable = true;
        maybeType = undefined;
    }

    return {
        name,
        isOptional,
        isNullable,
        maybeType,
    };
}
