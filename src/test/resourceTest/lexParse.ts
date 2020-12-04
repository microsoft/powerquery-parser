import "mocha";
import { Task } from "../..";
import { ResultUtils } from "../../powerquery-parser/common";
import { CombinatorialParser, IParser, IParseState, RecursiveDescentParser } from "../../powerquery-parser/parser";
import { DefaultSettings, Settings } from "../../powerquery-parser/settings";

import * as path from "path";
import { TestFileUtils } from "../testUtils";
const parsers: ReadonlyArray<[Settings, string]> = [
    [createSettings(CombinatorialParser), "CombinatorialParser"],
    [createSettings(RecursiveDescentParser), "RecursiveDescentParser"],
];

function createSettings(parser: IParser): Settings {
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

function parseAllFiles<S extends IParseState>(settings: Settings<S>, parserName: string): void {
    describe(`Run ${parserName} on lexParseResources directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "lexParseResources");

        for (const filePath of TestFileUtils.getPowerQueryFilesRecursively(fileDirectory)) {
            const testName: string = testNameFromFilePath(filePath);

            it(testName, () => {
                const triedLexParse: Task.TriedLexParse<S> = TestFileUtils.tryLexParse(settings, filePath);
                if (!ResultUtils.isOk(triedLexParse)) {
                    throw triedLexParse.error;
                }
            });
        }
    });
}
