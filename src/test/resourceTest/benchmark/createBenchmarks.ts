import * as fs from "fs";
import * as path from "path";

import { TestFileUtils } from "../../testUtils";

import { DefaultSettings, Settings } from "../../..";
import { BenchmarkTraceManager } from "../../../powerquery-parser/common/trace";

const NumberOfRunsPerFile: number = 10;
const ResourceDirectory: string = path.dirname(__filename);
const SourceFilesDirectory: string = path.join(ResourceDirectory, "sourceFiles");
const OutputDirectory: string = path.join(ResourceDirectory, "logs");

function createOutputStream(filePath: string, iteration: number): fs.WriteStream {
    const iterationFilePath: string = path.join(
        OutputDirectory,
        `file_${path.parse(filePath).name}_iteration_${iteration}.log`,
    );

    // tslint:disable-next-line: non-literal-fs-path
    if (!fs.existsSync(OutputDirectory)) {
        // tslint:disable-next-line: non-literal-fs-path
        fs.mkdirSync(OutputDirectory, { recursive: true });
    }

    return fs.createWriteStream(iterationFilePath, { flags: "w" });
}

for (const filePath of TestFileUtils.getPowerQueryFilesRecursively(SourceFilesDirectory)) {
    for (let iteration: number = 0; iteration < NumberOfRunsPerFile; iteration += 1) {
        const stream: fs.WriteStream = createOutputStream(filePath, iteration);

        stream.on("open", () => {
            if (iteration % 10 === 0 || iteration === NumberOfRunsPerFile - 1) {
                console.log(
                    `Running iteration ${iteration + 1} out of ${NumberOfRunsPerFile} for ${path.basename(filePath)}`,
                );
            }

            const benchmarkSettings: Settings = {
                ...DefaultSettings,
                traceManager: new BenchmarkTraceManager((message: string) => stream.write(message)),
            };

            TestFileUtils.tryLexParse(benchmarkSettings, filePath);
        });
    }
}
