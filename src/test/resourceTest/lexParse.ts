import "mocha";
import { ResultUtils } from "../../common";
import { IParser, IParserState, Parser } from "../../parser";
import { DefaultSettings, Settings } from "../../settings";
import { TriedLexParse } from "../../tasks";

import * as path from "path";
import * as FileUtils from "../fileUtils";

const parsers: ReadonlyArray<[Settings<IParserState>, string]> = [
    [createSettings(Parser.CombinatorialParser), "CombinatorialParser"],
    [createSettings(Parser.RecursiveDescentParser), "RecursiveDescentParser"],
];

function createSettings(parser: IParser<IParserState>): Settings<IParserState> {
    return {
        ...DefaultSettings,
        parser,
    };
}

for (const [settings, parserName] of parsers) {
    parseAllFiles(settings, parserName);
}

function testNameFromFilePath(filePath: string): string {
    return filePath.replace(path.dirname(__filename), ".");
}

function parseAllFiles<S>(settings: Settings<S>, parserName: string): void {
    describe(`Run ${parserName} on lexParseResources directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "lexParseResources");

        for (const filePath of FileUtils.getPowerQueryFilesRecursively(fileDirectory)) {
            const testName: string = testNameFromFilePath(filePath);

            it(testName, () => {
                const triedLexParse: TriedLexParse<S> = FileUtils.tryLexParse(settings, filePath);
                if (!ResultUtils.isOk(triedLexParse)) {
                    throw triedLexParse.error;
                }
            });
        }
    });
}
