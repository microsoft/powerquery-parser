// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Pattern, StringUtils, Task, TaskUtils } from "../../..";

describe("Anchored lexer patterns", () => {
    it("retains global matching for exported patterns and the generic regex helper", () => {
        const pattern: RegExp = /b/g;
        expect(StringUtils.regexMatchLength(pattern, "ab", 0)).to.equal(undefined);
        expect(pattern.lastIndex).to.equal(2);
        expect(Pattern.Whitespace.sticky).to.equal(false);
        expect(Pattern.IdentifierStartCharacter.sticky).to.equal(false);
        expect(Pattern.IdentifierPartCharacters.sticky).to.equal(false);
    });

    it("never searches ahead for whitespace or unquoted identifiers", () => {
        const sources: Set<string> = new Set([
            Pattern.Whitespace.source,
            Pattern.IdentifierStartCharacter.source,
            Pattern.IdentifierPartCharacters.source,
        ]);

        const seen: Set<string> = new Set();
        const nonSticky: Set<string> = new Set();
        const originalExec: typeof RegExp.prototype.exec = RegExp.prototype.exec;

        RegExp.prototype.exec = function (this: RegExp, text: string): RegExpExecArray | null {
            if (sources.has(this.source)) {
                seen.add(this.source);

                if (!this.sticky) {
                    nonSticky.add(this.source);
                }
            }

            return originalExec.call(this, text);
        };

        try {
            TaskUtils.assertIsLexStageOk(TaskUtils.tryLex(DefaultSettings, "alpha + beta"));
        } finally {
            RegExp.prototype.exec = originalExec;
        }

        expect([...seen]).to.have.members([...sources]);
        expect([...nonSticky]).to.deep.equal([]);
    });

    it("accepts the language's exact whitespace set", () => {
        const whitespace: string =
            "\t\u000b\u000c \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007" +
            "\u2008\u2009\u200a\u202f\u205f\u3000";

        const lex: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, `1${whitespace}+${whitespace}2`);
        TaskUtils.assertIsLexStageOk(lex);

        expect(lex.lexerSnapshot.tokens.map((token: Language.Token.Token) => token.data)).to.deep.equal([
            "1",
            "+",
            "2",
        ]);

        TaskUtils.assertIsLexStageError(TaskUtils.tryLex(DefaultSettings, "1\uFEFF+2"));
    });

    it("stops at the cursor instead of accepting a later identifier", () => {
        expect(Language.IdentifierUtils.getIdentifierLength("1 later", 0)).to.equal(undefined);
        expect(Language.IdentifierUtils.getIdentifierLength("a+later", 0)).to.equal(1);
        expect(Language.IdentifierUtils.getIdentifierLength("9 \u{10400}x\u0301", 2)).to.equal(4);
        expect(Language.IdentifierUtils.getIdentifierLength("name..later", 0)).to.equal(4);
        expect(Language.IdentifierUtils.getIdentifierLength("name.later", 0)).to.equal(10);
        expect(Language.IdentifierUtils.getIdentifierLength("name.", 0)).to.equal(4);
        expect(Language.IdentifierUtils.getIdentifierLength("name.", 0, { allowTrailingPeriod: true })).to.equal(5);
    });
});
