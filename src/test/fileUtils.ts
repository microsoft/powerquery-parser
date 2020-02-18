import { readdirSync, readFileSync, statSync } from "fs";
import "mocha";
import * as path from "path";
import { LexSettings, ParseSettings } from "../settings";
import { TriedLexParse } from "../tasks";

const PowerQueryExtensions: ReadonlyArray<string> = [".m", ".mout", ".pq", "pqm"];

export function getPowerQueryFilesRecursively(rootDirectory: string): ReadonlyArray<string> {
    const dirs: ReadonlyArray<string> = getDirectoryPaths(rootDirectory);
    let files: ReadonlyArray<String> = dirs
        .map(getPowerQueryFilesRecursively) // go through each directory
        .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten

    // Get files in root folder
    files = files.concat(getPowerQueryFilePaths(rootDirectory));

    // String -> string
    return files.map(str => str.toString());
}

export function fileContents(filePath: string): string {
    const contents: string = readFileSync(filePath, "utf8");
    return contents.replace(/^\uFEFF/, "");
}

export function tryLexParse<T>(settings: LexSettings & ParseSettings<T>, filePath: string): TriedLexParse {
    const contents: string = fileContents(filePath);
    return tryLexParse(settings, contents);
}

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

function getDirectoryPaths(rootDirectory: string): ReadonlyArray<string> {
    return readdirSync(rootDirectory)
        .map(name => path.join(rootDirectory, name))
        .filter(isDirectory);
}

function getPowerQueryFilePaths(filePath: string): ReadonlyArray<string> {
    return readdirSync(filePath)
        .map(name => path.join(filePath, name))
        .filter(isPowerQueryFile);
}
