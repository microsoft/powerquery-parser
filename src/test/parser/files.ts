import { readdirSync, readFileSync, statSync } from "fs";
import "mocha";
import { ResultUtils } from "../../common";
import { IParser, IParserState, Parser } from "../../parser";
import { DefaultSettings, Settings } from "../../settings";
import { TriedLexParse, tryLexParse } from "../../tasks";

import * as path from "path";

const PowerQueryExtensions: ReadonlyArray<string> = [".m", ".mout", ".pq", "pqm"];

function isDirectory(maybePath: string): boolean {
    return statSync(maybePath).isDirectory();
}

function isFile(filePath: string): boolean {
    return statSync(filePath).isFile();
}

function isPowerQueryFile(filePath: string): boolean {
    return isFile && isPowerQueryExtension(path.extname(filePath));
}

function isPowerQueryExtension(extension: string): boolean {
    return PowerQueryExtensions.indexOf(extension) !== -1;
}

function getDirectoryPaths(filePath: string): ReadonlyArray<string> {
    return readdirSync(filePath)
        .map(name => path.join(filePath, name))
        .filter(isDirectory);
}

function getPowerQueryFilePaths(filePath: string): ReadonlyArray<string> {
    return readdirSync(filePath)
        .map(name => path.join(filePath, name))
        .filter(isPowerQueryFile);
}

function getPowerQueryFilesRecursively(filePath: string): ReadonlyArray<string> {
    const dirs: ReadonlyArray<string> = getDirectoryPaths(filePath);
    let files: ReadonlyArray<String> = dirs
        .map(getPowerQueryFilesRecursively) // go through each directory
        .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten

    // Get files in root folder
    files = files.concat(getPowerQueryFilePaths(filePath));

    // String -> string
    return files.map(str => str.toString());
}

function testNameFromFilePath(filePath: string): string {
    return filePath.replace(path.dirname(__filename), ".");
}

function parseAllFiles(settings: Settings, parserName: string): void {
    describe(`use ${parserName} on files directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "files");

        for (const filePath of getPowerQueryFilesRecursively(fileDirectory)) {
            const testName: string = testNameFromFilePath(filePath);

            it(testName, () => {
                let contents: string = readFileSync(filePath, "utf8");
                contents = contents.replace(/^\uFEFF/, "");

                const triedLexParse: TriedLexParse = tryLexParse(settings, contents);
                if (!ResultUtils.isOk(triedLexParse)) {
                    throw triedLexParse.error;
                }
            });
        }
    });
}

const parsers: ReadonlyArray<[string, IParser<IParserState>]> = [
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
];

for (const [parserName, parser] of parsers) {
    const settings: Settings = {
        ...DefaultSettings,
        parser,
    };
    parseAllFiles(settings, parserName);
}
