import "mocha";
import { Task } from "../..";
import { ResultUtils } from "../../common";
import { LexerSnapshot } from "../../lexer";
import { IParser, IParserState, IParserStateUtils, Parser } from "../../parser";
import { DefaultSettings, ParseSettings, Settings } from "../../settings";

import * as path from "path";
import { TestFileUtils } from "../testUtils";
const parsers: ReadonlyArray<[Settings, string]> = [
    [createSettings(Parser.CombinatorialParser), "CombinatorialParser"],
    [createSettings(Parser.RecursiveDescentParser), "RecursiveDescentParser"],
];

function createSettings(parser: IParser): Settings {
    return {
        ...DefaultSettings,
        parser,
    };
}

for (const [settings, parserName] of parsers) {
    parseAllFiles(settings, parserName, IParserStateUtils.stateFactory);
}

function testNameFromFilePath(filePath: string): string {
    return filePath.replace(path.dirname(__filename), ".");
}

function parseAllFiles<S extends IParserState>(
    settings: Settings<S>,
    parserName: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): void {
    describe(`Run ${parserName} on lexParseResources directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "lexParseResources");

        for (const filePath of TestFileUtils.getPowerQueryFilesRecursively(fileDirectory)) {
            const testName: string = testNameFromFilePath(filePath);

            it(testName, () => {
                const triedLexParse: Task.TriedLexParse<S> = TestFileUtils.tryLexParse(
                    settings,
                    filePath,
                    stateFactoryFn,
                );
                if (!ResultUtils.isOk(triedLexParse)) {
                    throw triedLexParse.error;
                }
            });
        }
    });
}
