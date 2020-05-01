// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { CommonError, ResultUtils } from "../../common";
import { Ast } from "../../language";
import { IParserState, IParserStateUtils } from "../IParserState";
import { IParser, TriedParse } from "./IParser";

export function tryRead<State extends IParserState = IParserState>(
    state: State,
    parser: IParser<State>,
): TriedParse<State> {
    let node: Ast.TNode = parser.read(state, parser);

    try {
        node = parser.read(state, parser);
    } catch (err) {
        return ResultUtils.errFactory(CommonError.ensureCommonError(state.localizationTemplates, err));
    }

    const maybeCommonErr: CommonError.InvariantError | undefined = IParserStateUtils.testNoOpenContext(state);
    if (maybeCommonErr) {
        throw maybeCommonErr;
    }

    const maybeLeftoverErr: ParseError.UnusedTokensRemainError | undefined = IParserStateUtils.testNoMoreTokens(state);
    if (maybeLeftoverErr) {
        throw maybeLeftoverErr;
    }

    return ResultUtils.okFactory({
        ast: node,
        nodeIdMapCollection: state.contextState.nodeIdMapCollection,
        leafNodeIds: state.contextState.leafNodeIds,
        state,
    });
}
