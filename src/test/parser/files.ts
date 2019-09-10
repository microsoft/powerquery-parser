import { readdirSync, readFileSync, statSync } from "fs";
import "mocha";
import * as path from "path";
import { ResultKind } from "../../common";
import { TriedLexAndParse, tryLexAndParse } from "../../jobs";
import { CombinatorialParser, RecursiveDescentParser } from "../../parser/parsers";

const PowerQueryExtensions: ReadonlyArray<string> = [".m", ".mout", ".pq", "pqm"];

function isDirectory(maybePath: string): boolean {
    return statSync(maybePath).isDirectory();
}

function isFile(filepath: string): boolean {
    return statSync(filepath).isFile();
}

function isPowerQueryFile(filepath: string): boolean {
    return isFile && isPowerQueryExtension(path.extname(filepath));
}

function isPowerQueryExtension(extension: string): boolean {
    return PowerQueryExtensions.indexOf(extension) !== -1;
}

function getDirectoryPaths(filePath: string): ReadonlyArray<string> {
    return readdirSync(filePath)
        .map(name => path.join(filePath, name))
        .filter(isDirectory);
}

function getPowerQueryFilePaths(filepath: string): ReadonlyArray<string> {
    return readdirSync(filepath)
        .map(name => path.join(filepath, name))
        .filter(isPowerQueryFile);
}

function getPowerQueryFilesRecursively(filepath: string): ReadonlyArray<string> {
    const dirs: ReadonlyArray<string> = getDirectoryPaths(filepath);
    let files: ReadonlyArray<String> = dirs
        .map(getPowerQueryFilesRecursively) // go through each directory
        .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten

    // Get files in root folder
    files = files.concat(getPowerQueryFilePaths(filepath));

    // String -> string
    return files.map(str => str.toString());
}

function testNameFromFilePath(filepath: string): string {
    return filepath.replace(path.dirname(__filename), ".");
}

describe("abc123 files1", () => {
    const start: number = new Date().getTime();
    const fileDirectory: string = path.join(path.dirname(__filename), "files");

    for (const filepath of getPowerQueryFilesRecursively(fileDirectory)) {
        const testName: string = testNameFromFilePath(filepath);

        it(testName, () => {
            let contents: string = readFileSync(filepath, "utf8");
            contents = contents.replace(/^\uFEFF/, "");

            for (let _: number = 0; _ < 12; _ += 1) {
                const triedLexAndParse: TriedLexAndParse = tryLexAndParse(contents, RecursiveDescentParser);
                if (!(triedLexAndParse.kind === ResultKind.Ok)) {
                    throw triedLexAndParse.error;
                }
            }
        });
    }

    const finish: number = new Date().getTime();
    const delta: number = finish - start;
    // tslint:disable-next-line: no-console
    console.log(`RecursiveDescentParser timing: ${delta}`);
});

describe("abc123 files2", () => {
    const start: number = new Date().getTime();
    const fileDirectory: string = path.join(path.dirname(__filename), "files");

    for (const filepath of getPowerQueryFilesRecursively(fileDirectory)) {
        const testName: string = testNameFromFilePath(filepath);

        it(testName, () => {
            let contents: string = readFileSync(filepath, "utf8");
            contents = contents.replace(/^\uFEFF/, "");

            for (let _: number = 0; _ < 12; _ += 1) {
                const triedLexAndParse: TriedLexAndParse = tryLexAndParse(contents, CombinatorialParser);
                if (!(triedLexAndParse.kind === ResultKind.Ok)) {
                    throw triedLexAndParse.error;
                }
            }
        });
    }

    const finish: number = new Date().getTime();
    const delta: number = finish - start;
    // tslint:disable-next-line: no-console
    console.log(`CombinatorialParser timing: ${delta}`);
});
