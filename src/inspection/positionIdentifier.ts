import { Ast, NodeIdMap } from "../parser";

export type TPositionIdentifier = LocalIdentifier | UndefinedIdentifier;

export const enum PositionIdentifierKind {
    Local = "Local",
    Undefined = "Undefined",
}

export interface IPositionIdentifier {
    readonly kind: PositionIdentifierKind;
    readonly identifier: Ast.Identifier;
}

export interface LocalIdentifier extends IPositionIdentifier {
    readonly kind: PositionIdentifierKind.Local;
    readonly defiinition: NodeIdMap.TXorNode;
}

export interface UndefinedIdentifier extends IPositionIdentifier {
    readonly kind: PositionIdentifierKind.Undefined;
}
