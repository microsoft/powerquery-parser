import { Assert, ResultUtils } from "../common";
import { Keyword } from "../language";
import { TriedExpectedType, tryExpectedType } from "../language/type/expectedType";
import { AncestryUtils, IParserState, NodeIdMap, ParseError, TXorNode } from "../parser";
import { CommonSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { TriedAutocomplete, tryAutocomplete } from "./autocomplete";
import { TriedInspection } from "./commonTypes";
import { TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { Position } from "./position";
import { ScopeById, ScopeItemByKey, TriedScope, tryScope } from "./scope";
import { TriedScopeType, tryScopeType } from "./type";

export function tryInspection<S extends IParserState = IParserState>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeParseError: ParseError.ParseError<S> | undefined,
    position: Position,
): TriedInspection {
    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return ResultUtils.okFactory({
            maybeActiveNode,
            autocomplete: Keyword.StartOfDocumentKeywords,
            maybeInvokeExpression: undefined,
            scope: new Map(),
            scopeType: new Map(),
            maybeExpectedType: undefined,
        });
    }
    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<TXorNode> = maybeActiveNode.ancestry;
    const ancestryLeaf: TXorNode = AncestryUtils.assertGetLeaf(ancestry);

    const triedAutocomplete: TriedAutocomplete = tryAutocomplete(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNode,
        maybeParseError,
    );
    if (ResultUtils.isErr(triedAutocomplete)) {
        return triedAutocomplete;
    }

    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(settings, nodeIdMapCollection, activeNode);
    if (ResultUtils.isErr(triedInvokeExpression)) {
        return triedInvokeExpression;
    }

    const triedScope: TriedScope = tryScope(settings, nodeIdMapCollection, leafNodeIds, ancestry, undefined);
    if (ResultUtils.isErr(triedScope)) {
        return triedScope;
    }
    const scopeById: ScopeById = triedScope.value;
    const maybeScope: ScopeItemByKey | undefined = scopeById.get(ancestryLeaf.node.id);
    Assert.isDefined(maybeScope, `assert nodeId in scopeById`, { nodeId: ancestryLeaf.node.id });
    const scope: ScopeItemByKey = maybeScope;

    const triedScopeType: TriedScopeType = tryScopeType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        ancestryLeaf.node.id,
        {
            scopeById,
            typeById: new Map(),
        },
    );
    if (ResultUtils.isErr(triedScopeType)) {
        return triedScopeType;
    }

    const triedExpectedType: TriedExpectedType = tryExpectedType(settings, activeNode);
    if (ResultUtils.isErr(triedExpectedType)) {
        return triedExpectedType;
    }

    return ResultUtils.okFactory({
        maybeActiveNode,
        autocomplete: triedAutocomplete.value,
        maybeInvokeExpression: triedInvokeExpression.value,
        scope,
        scopeType: triedScopeType.value,
        maybeExpectedType: triedExpectedType.value,
    });
}
