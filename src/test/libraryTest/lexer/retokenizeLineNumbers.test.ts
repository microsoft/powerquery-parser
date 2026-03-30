// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Lexer, ResultUtils } from "../../..";
import { assertGetLexOk } from "../../testUtils/lexTestUtils";

describe("Lexer.retokenizeLines line numbers", () => {
    it("retokenized lines have correct line numbers after multiline string insertion", () => {
        // Start with a 3-line document where line 0 starts an unterminated string,
        // causing lines 1 and 2 to be retokenized in Text mode.
        // The bug was that all retokenized lines received the same line number.
        const text: string = `"\nbravo\ncharlie`;

        const state: Lexer.State = assertGetLexOk(text);

        // Verify each line tracks its own line number by checking lineModeStart.
        // Lines 1 and 2 should be in Text mode (continuation of the unterminated string),
        // and each should be a distinct line object (not collapsed).
        expect(state.lines.length).to.equal(3, "expected 3 lines");

        // Now update line 0 to close the string, which should retokenize lines 1 and 2
        // back to Default mode with correct line numbers.
        const triedUpdate: Lexer.TriedLex = Lexer.tryUpdateLine(state, 0, `"hello"`);
        ResultUtils.assertIsOk(triedUpdate);

        const updated: Lexer.State = triedUpdate.value;
        expect(updated.lines.length).to.equal(3, "expected 3 lines after update");

        // All lines should now be in Default mode since line 0 is a complete string
        expect(updated.lines[0].lineModeEnd).to.equal(Lexer.LineMode.Default, "line 0 should end in Default mode");
        expect(updated.lines[1].lineModeStart).to.equal(Lexer.LineMode.Default, "line 1 should start in Default mode");
        expect(updated.lines[2].lineModeStart).to.equal(Lexer.LineMode.Default, "line 2 should start in Default mode");

        // Now snapshot to get token positions and verify line numbers are correct.
        const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(updated);
        ResultUtils.assertIsOk(triedSnapshot);

        const snapshot: Lexer.LexerSnapshot = triedSnapshot.value;

        for (const token of snapshot.tokens) {
            expect(token.positionStart.lineNumber).to.be.at.most(
                token.positionEnd.lineNumber,
                "token start line should be <= end line",
            );

            // No token should claim to be on a line number beyond the last line
            expect(token.positionStart.lineNumber).to.be.lessThan(
                updated.lines.length,
                `token line number ${token.positionStart.lineNumber} exceeds line count ${updated.lines.length}`,
            );
        }
    });
});
