# powerquery-parser

[![Build Status](https://dev.azure.com/ms/powerquery-parser/_apis/build/status/Microsoft.powerquery-parser?branchName=master)](https://dev.azure.com/ms/powerquery-parser/_build/latest?definitionId=134&branchName=master)

A parser for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language, written in TypeScript. Designed to be consumed by other projects.

## How to use

A minimal example can be found in [example.ts](src/example.ts) which uses the `lexAndParse` function located in [src/jobs.ts](src/jobs.ts).

## Things to note

### Language Specification

The Power Query/M language has an [official specification](https://docs.microsoft.com/en-us/powerquery-m/power-query-m-language-specification) which was used. A few differences were found between the specification used (October 2016) and by the internal parser. These differences are were marked down in [spec/notes.md](spec/notes.md)

### Error Handling

The project tries avoiding using `try/catch` blocks. Instead it prefers to use the `Result` type to carry exceptions between boundaries, and `Option` for explicit nullability. This means library users should assume public functions won't throw an uncaught exception.

## How to build

- Install NodeJS
- `npm install`
- `npm run-script build`

## How to run tests

- Install NodeJS
- `npm install`
- `npm test`

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
