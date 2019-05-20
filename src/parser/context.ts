import { Option } from "../common";
import { Ast } from "./ast";

export namespace ParserContext {
    export interface ContextNode {
        readonly id: number,
        readonly codeUnitStart: number,
        maybeCodeUnitEnd: Option<number>,
        maybeParent: Option<ContextNode>,
        children: ContextNode[],
        maybeAstNode: Option<Ast.TNode>,
    }
}