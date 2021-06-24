import "mocha";
import * as path from "path";
import { DefaultSettings, Parser, Settings, Task } from "../..";
import { TaskUtils } from "../../powerquery-parser";
import { TestFileUtils } from "../testUtils";

const parsers: ReadonlyArray<[Settings, string]> = [
    [createSettings(Parser.CombinatorialParser), "CombinatorialParser"],
    [createSettings(Parser.RecursiveDescentParser), "RecursiveDescentParser"],
];

function createSettings(parser: Parser.Parser): Settings {
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

function parseAllFiles(settings: Settings, parserName: string): void {
    describe(`Run ${parserName} on lexParseResources directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "lexParseResources");

        for (const filePath of TestFileUtils.getPowerQueryFilesRecursively(fileDirectory)) {
            const testName: string = testNameFromFilePath(filePath);

            it(testName, () => {
                const triedLexParseTask: Task.TriedLexParseTask = TestFileUtils.tryLexParse(settings, filePath);
                TaskUtils.assertIsParseStageOk(triedLexParseTask);
            });
        }
    });
}
