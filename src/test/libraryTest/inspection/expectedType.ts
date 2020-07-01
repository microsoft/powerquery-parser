// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection, Task } from "../../..";
import { Assert } from "../../../common";
import { Position } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { NodeIdMap } from "../../../parser";
import { DefaultSettings } from "../../../settings";
import { Type } from "../../../type";
import { expectTextWithPosition } from "../../common";

function expectParseOkExpectedType(textWithPipe: string): Type.TType | undefined {
    const [textWithoutPipe, position]: [string, Position] = expectTextWithPosition(textWithPipe);
    const triedLexParse: Task.TriedLexParse = Task.tryLexParse(DefaultSettings, textWithoutPipe);
    Assert.isOk(triedLexParse);

    const nodeIdMapCollection: NodeIdMap.Collection = triedLexParse.value.state.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = triedLexParse.value.state.contextState.leafNodeIds;

    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    Assert.isDefined(maybeActiveNode);

    const triedExpectedType: Inspection.TriedExpectedType = Inspection.tryExpectedType(
        DefaultSettings,
        nodeIdMapCollection,
        maybeActiveNode.ancestry,
    );

    Assert.isOk(triedExpectedType);
    return triedExpectedType.value;
}

describe(`Inspection - Scope - ExpectedType`, () => {
    it(`1 + 1|`, () => {
        const textWithPipe: string = "1 + 1|";
        const expected: Type.TType | undefined = undefined;
        const actual: Type.TType | undefined = expectParseOkExpectedType(textWithPipe);
    });
});
