import { Assert, ResultUtils } from "../common";
import { Keyword } from "../language";
import { TriedExpectedType, tryExpectedType } from "../language/type/expectedType";
import { AncestryUtils, IParserState, NodeIdMap, ParseError, TXorNode } from "../parser";
import { ParseSettings } from "../settings";
import { ActiveNode, ActiveNodeUtils } from "./activeNode";
import { Autocomplete, autocomplete } from "./autocomplete";
import { TriedInspection } from "./commonTypes";
import { TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { Position } from "./position";
import { NodeScope, ScopeById, TriedScope, tryScope } from "./scope";
import { TriedScopeType, tryScopeType } from "./type";
import { TypeCache } from "./type/commonTypes";

export function tryInspection<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    maybeParseError: ParseError.ParseError<S> | undefined,
    position: Position,
): TriedInspection {
    const nodeIdMapCollection: NodeIdMap.Collection = parserState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parserState.contextState.leafNodeIds;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return ResultUtils.okFactory({
            maybeActiveNode,
            autocomplete: {
                triedFieldAccess: ResultUtils.okFactory(undefined),
                triedKeyword: ResultUtils.okFactory(Keyword.StartOfDocumentKeywords),
                triedLanguageConstant: ResultUtils.okFactory(undefined),
                triedPrimitiveType: ResultUtils.okFactory([]),
            },
            maybeInvokeExpression: undefined,
            nodeScope: new Map(),
            scopeType: new Map(),
            maybeExpectedType: undefined,
        });
    }
    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<TXorNode> = maybeActiveNode.ancestry;
    const ancestryLeaf: TXorNode = AncestryUtils.assertGetLeaf(ancestry);

    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(
        parseSettings,
        nodeIdMapCollection,
        activeNode,
    );
    if (ResultUtils.isErr(triedInvokeExpression)) {
        return triedInvokeExpression;
    }

    const triedScope: TriedScope = tryScope(parseSettings, nodeIdMapCollection, leafNodeIds, ancestry, undefined);
    if (ResultUtils.isErr(triedScope)) {
        return triedScope;
    }
    const scopeById: ScopeById = triedScope.value;
    const maybeNodeScope: NodeScope | undefined = scopeById.get(ancestryLeaf.node.id);
    Assert.isDefined(maybeNodeScope, `assert nodeId in scopeById`, { nodeId: ancestryLeaf.node.id });
    const nodeScope: NodeScope = maybeNodeScope;

    const typeCache: TypeCache = {
        scopeById,
        typeById: new Map(),
    };
    const triedScopeType: TriedScopeType = tryScopeType(
        parseSettings,
        nodeIdMapCollection,
        leafNodeIds,
        ancestryLeaf.node.id,
        typeCache,
    );
    if (ResultUtils.isErr(triedScopeType)) {
        return triedScopeType;
    }

    const triedExpectedType: TriedExpectedType = tryExpectedType(parseSettings, activeNode);
    if (ResultUtils.isErr(triedExpectedType)) {
        return triedExpectedType;
    }

    const autocompleted: Autocomplete = autocomplete(
        parseSettings,
        parserState,
        typeCache,
        activeNode,
        maybeParseError,
    );

    return ResultUtils.okFactory({
        maybeActiveNode,
        autocomplete: autocompleted,
        maybeInvokeExpression: triedInvokeExpression.value,
        nodeScope,
        scopeType: triedScopeType.value,
        maybeExpectedType: triedExpectedType.value,
    });
}
