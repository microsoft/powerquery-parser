// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as fs from "fs";
import * as path from "path";

import { LexSettings, ParseSettings, Task } from "../..";
import { TaskUtils } from "../../powerquery-parser";

const PowerQueryExtensions: ReadonlyArray<string> = [".m", ".mout", ".pq", "pqm"];

export function getPowerQueryFilesRecursively(rootDirectory: string): ReadonlyArray<string> {
    const dirs: ReadonlyArray<string> = getDirectoryPaths(rootDirectory);

    let files: ReadonlyArray<string> = dirs
        // go through each directory
        .map(getPowerQueryFilesRecursively)
        // map returns a 2d array (array of file arrays) so flatten
        .reduce((a: ReadonlyArray<string>, b: ReadonlyArray<string>) => a.concat(b), []);

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

export async function tryLexParse(
    settings: LexSettings & ParseSettings,
    filePath: string,
): Promise<Task.TriedLexParseTask> {
    const contents: string = readContents(filePath);

    return await TaskUtils.tryLexParse(settings, contents);
}

function isDirectory(path: string): boolean {
    // tslint:disable-next-line: non-literal-fs-path
    return fs.statSync(path).isDirectory();
}

function isFile(filePath: string): boolean {
    // tslint:disable-next-line: non-literal-fs-path
    return fs.statSync(filePath).isFile();
}

function isPowerQueryFile(filePath: string): boolean {
    return isFile(filePath) && isPowerQueryExtension(path.extname(filePath));
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
            .map((name: string) => path.join(rootDirectory, name))
            .filter(isDirectory)
    );
}

function getPowerQueryFilePaths(filePath: string): ReadonlyArray<string> {
    // tslint:disable-next-line: non-literal-fs-path
    return (
        fs
            // tslint:disable-next-line: non-literal-fs-path
            .readdirSync(filePath)
            .map((name: string) => path.join(filePath, name))
            .filter(isPowerQueryFile)
    );
}
