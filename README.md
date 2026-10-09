# powerquery-parser

[![Build Status](https://dev.azure.com/ms/powerquery-parser/_apis/build/status/microsoft.powerquery-parser?branchName=master)](https://dev.azure.com/ms/powerquery-parser/_build/latest?definitionId=134&branchName=master)

A parser for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language, written in TypeScript. Designed to be consumed by other projects.

## How to use

The most common way to consume the project is to interact with the helper functions found in [taskUtils.ts](src/powerquery-parser/task/taskUtils.ts). There are all-in-one functions, such as `tryLexParse`, which does a full pass on a given document. There are also incremental functions, such as `tryLex` and `tryParse`, which perform one step at a time. Minimal code samples can be found in [example.ts](src/example.ts).

## Related projects

- [powerquery-formatter](https://github.com/microsoft/powerquery-formatter): A code formatter for Power Query which is bundled in the VSCode extension.
- [powerquery-language-services](https://github.com/microsoft/powerquery-language-services): A high level library that wraps the parser for external projects, such as the VSCode extension. Includes features such as Intellisense.
- [vscode-powerquery](https://github.com/microsoft/vscode-powerquery): The VSCode extension for Power Query language support.
- [vscode-powerquery-sdk](https://github.com/microsoft/vscode-powerquery-sdk): The VSCode extension for Power Query connector SDK.

## Things to note

### Parser

The parser started off as a naive recursive descent parser with limited backtracking. It mostly followed the [official specification](https://docs.microsoft.com/en-us/powerquery-m/power-query-m-language-specification) released in October 2016. Deviations from the specification should be marked down in [specification.md](specification.md). A combinatorial parser has since been added which uses the naive parser as its base.

### Style

This project uses [prettier](https://github.com/prettier/prettier) as the primary source of style enforcement. Additional style requirements are located in [style.md](style.md).

## How to build

- Install NodeJS
- `npm install`
- `npm run-script build`

## How to run tests

- Install NodeJS
- `npm install`
- `npm test`

## Parser performance benchmarks

Build once, then run the compiled harness to exclude TypeScript compilation from the measurements:

```powershell
npm run build
node lib\test\scripts\benchmarkLexParse.js Q:\src\DataConnectors 7 12 > benchmark-results.json
```

The arguments are the source directory, number of largest `.pq` files, and measured iterations.
Directories named `Tests` are excluded. File I/O and leading BOM removal are outside the timers.
Each file receives two warmups. The fastest and slowest samples are dropped from each reported mean;
all raw samples and source SHA-256 hashes are retained.

`lex` measures the full lexing task. `parse` repeatedly parses one snapshot (including its mutable
grapheme cache); `parseFreshSnapshot` lexes a fresh snapshot outside each parse timer. The aggregate
contains sums of per-file means, not a single end-to-end measurement. Natural garbage collection is
included; timings are sensitive to machine load and allocation history. Failed parses are reported
as failures rather than accepted as faster results.

Recorded investigations are in [benchmarks/parser/index.json](benchmarks/parser/index.json), with
raw per-attempt results alongside it. The first investigation compares commit `99b7fd7` with bounded
checkpoint rollback and indexed diagnostic line lookups. It includes separate-process repeats and
an alternating same-process comparison; improvements are concentrated in the two largest connectors,
and the results do not demonstrate a uniform speedup on smaller files.

A second investigation measures direct construction of identifier, literal, and constant leaves,
avoiding temporary parse contexts for successful child reads. It also records two rejected
child-list ownership experiments, whose bookkeeping cost outweighed reduced array copying.
Leaf timings are compared against the already optimized parser, including reverse-order
separate-process repeats; root nodes and failing reads retain the normal context lifecycle.

A third investigation evaluated bypassing impossible speculative primitive-type reads. That
optimization was subsequently removed by user choice; its measurements and findings remain
as historical records. The retained implementation includes the direct lexer, bounded rollback,
indexed line lookups, and direct-leaf construction.

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
