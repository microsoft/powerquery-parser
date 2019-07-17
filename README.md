# powerquery-parser

[![Build Status](https://dev.azure.com/ms/powerquery-parser/_apis/build/status/Microsoft.powerquery-parser?branchName=master)](https://dev.azure.com/ms/powerquery-parser/_build/latest?definitionId=134&branchName=master)

A parser for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language, written in TypeScript. Designed to be consumed by other projects.

## How to use

A few minimal code samples can be found in [example.ts](src/example.ts).

If you're planning on parsing static documents then you should use the `tryLexAndParse` function located in [src/jobs.ts](src/jobs.ts). This function attempts to lex a document, pass the results to the parser, and then return the outcome.

If you're planning to perform repeated lexing and parses, such as being a part of a Visual Studi Code extension, then for performance reasons you should avoid the `tryLexAndParse` helper function. Instead you should create a Lexer instance and as your text changes update the lexer using the public APIs located in [src/lexer/lexer.ts](src/lexer/lexer.ts). Once you need to parse the document follow the same steps in `src/jobs.ts`; create a LexerSnapshot and pass the result to the parser.

## Things to note

### Parser

The parser is a rather naive recursive descent parser with limited backtracking. It mostly follows [official specification](https://docs.microsoft.com/en-us/powerquery-m/power-query-m-language-specification) released in October 2016. Deviations from the specification should be marked down in [spec/notes.md](spec/notes.md)

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
