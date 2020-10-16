// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeInspector } from "../../../language";
import { TXorNode, XorNodeUtils } from "../../../parser";
import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeFunctionExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FunctionExpression);

    const inspectedFunctionExpression: TypeInspector.InspectedFunctionExpression = TypeInspector.inspectFunctionExpression(
        state.nodeIdMapCollection,
        xorNode,
    );
    const inspectedReturnType: Type.TType = inspectedFunctionExpression.returnType;
    const expressionType: Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 3);

    // FunctionExpression.maybeFunctionReturnType doesn't always match FunctionExpression.expression.
    // By examining the expression we might get a more accurate return type (eg. Function vs DefinedFunction),
    // or discover an error (eg. maybeFunctionReturnType is Number but expression is Text).

    let returnType: Type.TType;
    // If the stated return type is Any,
    // then it might as well be the expression's type as it can't be any wider than Any.
    if (inspectedReturnType.kind === Type.TypeKind.Any) {
        returnType = expressionType;
    }
    // If the return type is Any then see if we can narrow it to the stated return type.
    else if (
        expressionType.kind === Type.TypeKind.Any &&
        expressionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
        allForAnyUnion(
            expressionType,
            (type: Type.TType) => type.kind === inspectedReturnType.kind || type.kind === Type.TypeKind.Any,
        )
    ) {
        returnType = expressionType;
    }
    // If the stated return type doesn't match the expression's type then it's None.
    else if (inspectedReturnType.kind !== expressionType.kind) {
        return Type.NoneInstance;
    }
    // If the expression's type can't be known, then assume it's the stated return type.
    else if (expressionType.kind === Type.TypeKind.Unknown) {
        returnType = inspectedReturnType;
    }
    // Else fallback to the expression's type.
    else {
        returnType = expressionType;
    }

    return {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable: false,
        parameters: inspectedFunctionExpression.parameters.map(
            (parameter: TypeInspector.InspectedFunctionParameter) => {
                return {
                    nameLiteral: parameter.name.literal,
                    isNullable: parameter.isNullable,
                    isOptional: parameter.isOptional,
                    maybeType: parameter.maybeType,
                };
            },
        ),
        returnType,
    };
}
