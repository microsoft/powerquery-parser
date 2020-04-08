import "mocha";
import { Task } from "..";
import { IParserState } from "../parser";
import { LexSettings, ParseSettings } from "../settings";

import * as fs from "fs";
import * as path from "path";

const PowerQueryExtensions: ReadonlyArray<string> = [".m", ".mout", ".pq", "pqm"];

export function getPowerQueryFilesRecursively(rootDirectory: string): ReadonlyArray<string> {
    const dirs: ReadonlyArray<string> = getDirectoryPaths(rootDirectory);
    let files: ReadonlyArray<string> = dirs
        .map(getPowerQueryFilesRecursively) // go through each directory
        .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten

    // Get files in root folder
    files = files.concat(getPowerQueryFilePaths(rootDirectory));

    return files;
}

export function readContents(filePath: string): string {
    // tslint:disable-next-line: non-literal-fs-path
    const contents: string = fs.readFileSync(filePath, "utf8");
    return contents.replace(/^\uFEFF/, "");
}

export function writeContents(filePath: string, contents: string): void {
    const dirPath: string = path.dirname(filePath);

    // tslint:disable-next-line: non-literal-fs-path
    if (!fs.existsSync(dirPath)) {
        // tslint:disable-next-line: non-literal-fs-path
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // tslint:disable-next-line: non-literal-fs-path
    fs.writeFile(filePath, contents, { encoding: "utf8" }, (err: NodeJS.ErrnoException | null) => {
        if (err !== null) {
            throw err;
        }
    });
}

export function tryLexParse<S = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    filePath: string
): Task.TriedLexParse<S> {
    const contents: string = readContents(filePath);
    return Task.tryLexParse(settings, contents);
}

function isDirectory(maybePath: string): boolean {
    // tslint:disable-next-line: non-literal-fs-path
    return fs.statSync(maybePath).isDirectory();
}

function isFile(filePath: string): boolean {
    // tslint:disable-next-line: non-literal-fs-path
    return fs.statSync(filePath).isFile();
}

function isPowerQueryFile(filePath: string): boolean {
    return isFile && isPowerQueryExtension(path.extname(filePath));
}

function isPowerQueryExtension(extension: string): boolean {
    return PowerQueryExtensions.indexOf(extension) !== -1;
}

function getDirectoryPaths(rootDirectory: string): ReadonlyArray<string> {
    // tslint:disable-next-line: non-literal-fs-path
    return (
        fs
            // tslint:disable-next-line: non-literal-fs-path
            .readdirSync(rootDirectory)
            .map(name => path.join(rootDirectory, name))
            .filter(isDirectory)
    );
}

function getPowerQueryFilePaths(filePath: string): ReadonlyArray<string> {
    // tslint:disable-next-line: non-literal-fs-path
    return (
        fs
            // tslint:disable-next-line: non-literal-fs-path
            .readdirSync(filePath)
            .map(name => path.join(filePath, name))
            .filter(isPowerQueryFile)
    );
}
