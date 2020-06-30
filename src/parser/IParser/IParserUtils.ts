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
    let root: Ast.TNode;

    try {
        root = parser.read(state, parser);
    } catch (err) {
        let convertedError: ParseError.TParseError<State>;
        if (ParseError.isTInnerParseError(err)) {
            convertedError = new ParseError.ParseError(err, state);
        } else {
            convertedError = CommonError.ensureCommonError(state.localizationTemplates, err);
        }
        return ResultUtils.errFactory(convertedError);
    }

    const maybeCommonErr: CommonError.InvariantError | undefined = IParserStateUtils.testNoOpenContext(state);
    if (maybeCommonErr) {
        return ResultUtils.errFactory(new CommonError.CommonError(maybeCommonErr));
    }

    const maybeLeftoverErr: ParseError.UnusedTokensRemainError | undefined = IParserStateUtils.testNoMoreTokens(state);
    if (maybeLeftoverErr) {
        return ResultUtils.errFactory(new ParseError.ParseError(maybeLeftoverErr, state));
    }

    return ResultUtils.okFactory({
        root,
        nodeIdMapCollection: state.contextState.nodeIdMapCollection,
        leafNodeIds: state.contextState.leafNodeIds,
        state,
    });
}
