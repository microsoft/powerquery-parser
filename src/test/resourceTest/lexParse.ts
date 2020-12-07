import "mocha";
import * as path from "path";
import { DefaultSettings, Parser, ResultUtils, Settings, Task } from "../..";
import { TestFileUtils } from "../testUtils";

const parsers: ReadonlyArray<[Settings, string]> = [
    [createSettings(Parser.CombinatorialParser), "CombinatorialParser"],
    [createSettings(Parser.RecursiveDescentParser), "RecursiveDescentParser"],
];

function createSettings(parser: Parser.IParser): Settings {
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

function parseAllFiles<S extends Parser.IParseState>(settings: Settings<S>, parserName: string): void {
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
