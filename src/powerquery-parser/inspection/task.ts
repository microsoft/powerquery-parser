import { ResultUtils } from "../common";
import { TriedExpectedType, tryExpectedType } from "../language/type/expectedType";
import { AncestryUtils, IParseState, NodeIdMap, ParseError, TXorNode } from "../parser";
import { InspectionSettings, ParseSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { autocomplete } from "./autocomplete";
import { Inspection } from "./commonTypes";
import { TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { Position } from "./position";
import { ScopeById, TriedNodeScope, tryNodeScope } from "./scope";
import { TriedScopeType, tryScopeType } from "./type";
import { TypeCache } from "./type/commonTypes";

export function inspection<S extends IParseState = IParseState>(
    settings: ParseSettings<S> & InspectionSettings,
    parseState: S,
    maybeParseError: ParseError.ParseError<S> | undefined,
    position: Position,
): Inspection {
    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseState.contextState.leafNodeIds;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(
        settings,
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
    if (ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        const activeNode: ActiveNode = maybeActiveNode;

        triedNodeScope = tryNodeScope(
            settings,
            nodeIdMapCollection,
            leafNodeIds,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            scopeById,
        );

        const ancestryLeaf: TXorNode = AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, leafNodeIds, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = ResultUtils.okFactory(new Map());
        triedScopeType = ResultUtils.okFactory(new Map());
        triedExpectedType = ResultUtils.okFactory(undefined);
    }

    return {
        maybeActiveNode,
        autocomplete: autocomplete(settings, parseState, typeCache, maybeActiveNode, maybeParseError),
        triedInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
    };
}
