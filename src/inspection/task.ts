import { ResultUtils } from "../common";
import { TriedExpectedType, tryExpectedType } from "../language/type/expectedType";
import { AncestryUtils, IParserState, NodeIdMap, ParseError, TXorNode } from "../parser";
import { ParseSettings } from "../settings";
import { ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { autocomplete } from "./autocomplete";
import { Inspection } from "./commonTypes";
import { TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { Position } from "./position";
import { ScopeById, TriedNodeScope, tryNodeScope } from "./scope";
import { TriedScopeType, tryScopeType } from "./type";
import { TypeCache } from "./type/commonTypes";

export function inspection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    maybeParseError: ParseError.ParseError<S> | undefined,
    position: Position,
): Inspection {
    const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parserState.contextState.leafNodeIds;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(
        parseSettings,
        nodeIdMapCollection,
        maybeActiveNode,
    );

    // Creating caches that are shared across inspections.
    const scopeById: ScopeById = new Map();
    const typeCache: TypeCache = {
        scopeById,
        typeById: new Map(),
    };

    let triedNodeScope: TriedNodeScope;
    let triedScopeType: TriedScopeType;
    let triedExpectedType: TriedExpectedType;
    if (ActiveNodeUtils.isSome(maybeActiveNode)) {
        triedNodeScope = tryNodeScope(
            parseSettings,
            nodeIdMapCollection,
            leafNodeIds,
            maybeActiveNode.ancestry[0].node.id,
            scopeById,
        );

        const ancestryLeaf: TXorNode = AncestryUtils.assertGetLeaf(maybeActiveNode.ancestry);
        triedScopeType = tryScopeType(parseSettings, nodeIdMapCollection, leafNodeIds, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(parseSettings, maybeActiveNode);
    } else {
        triedNodeScope = ResultUtils.okFactory(undefined);
        triedScopeType = ResultUtils.okFactory(undefined);
        triedExpectedType = ResultUtils.okFactory(undefined);
    }

    return {
        maybeActiveNode,
        autocomplete: autocomplete(parseSettings, parserState, typeCache, maybeActiveNode, maybeParseError),
        triedInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
    };
}
