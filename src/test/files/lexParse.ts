import "mocha";
import { ResultUtils } from "../../common";
import { IParser, IParserState, Parser } from "../../parser";
import { DefaultSettings, Settings } from "../../settings";
import { TriedLexParse } from "../../tasks";

import * as path from "path";
import * as FileUtils from "../fileUtils";

const parsers: ReadonlyArray<[string, IParser<IParserState>]> = [
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
];

for (const [parserName, parser] of parsers) {
    const settings: Settings<IParserState> = {
        ...DefaultSettings,
        parser,
    };
    parseAllFiles(settings, parserName);
}

function testNameFromFilePath(filePath: string): string {
    return filePath.replace(path.dirname(__filename), ".");
}

function parseAllFiles<T>(settings: Settings<T>, parserName: string): void {
    describe(`use ${parserName} on files directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "lexParseResources");

        for (const filePath of FileUtils.getPowerQueryFilesRecursively(fileDirectory)) {
            const testName: string = testNameFromFilePath(filePath);

            it(testName, () => {
                const triedLexParse: TriedLexParse = FileUtils.tryLexParse(settings, filePath);
                if (!ResultUtils.isOk(triedLexParse)) {
                    throw triedLexParse.error;
                }
            });
        }
    });
}
