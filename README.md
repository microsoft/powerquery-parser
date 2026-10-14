# powerquery-parser

[![Build Status](https://dev.azure.com/ms/powerquery-parser/_apis/build/status/microsoft.powerquery-parser?branchName=master)](https://dev.azure.com/ms/powerquery-parser/_build/latest?definitionId=134&branchName=master)

A parser for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language, written in TypeScript. Designed to be consumed by other projects.

## How to use

The most common way to consume the project is to interact with the helper functions found in [taskUtils.ts](src/powerquery-parser/task/taskUtils.ts). There are all-in-one functions, such as `tryLexParse`, which does a full pass on a given document. There are also separate lexing and parsing steps, `tryLex` and `tryParse`. Minimal code samples can be found in [example.ts](src/example.ts).

### Lexing

`Lexer.tryLex(settings, text)` lexes the complete document and returns `Result<LexerSnapshot, LexError.TLexError>`. It stops at the first lexical error, including unterminated text, quoted identifiers, and multiline comments. Errors contain one localized diagnostic, not a map of line errors. Diagnostic positions include the absolute UTF-16 offset, zero-based line offset, and grapheme column.

The lexer retains its function-based token readers. Tokens and comments are emitted directly; line information is used only for source positions and type directives. `TaskUtils.tryLex` and `TaskUtils.tryLexParse` use the same lexer, and parser inputs remain `LexerSnapshot` values.

**Breaking change:** the incremental APIs (`tryAppendLine`, `tryUpdateLine`, `tryUpdateRange`, `tryDeleteLine`), editable `State`/line/range types, line-token kinds, line-error maps and predicates, and `trySnapshot` are removed. Apply edits to the document text and call `Lexer.tryLex` again. There is no intermediate line state or separate snapshot-validation step.

Snapshots derive directive associations from their comments; the constructor no longer accepts a separate directive map. Grapheme-position queries index and cache the token's starting line, including for multiline tokens.

```typescript
import { DefaultSettings, Lexer, ResultUtils } from "@microsoft/powerquery-parser";

const updatedDocumentText = "let x = 2 in x";
const result = Lexer.tryLex(DefaultSettings, updatedDocumentText);
if (ResultUtils.isOk(result)) {
    console.log(result.value.tokens, result.value.comments);
} else {
    console.error(result.error.message);
}
```

Cancellation still returns a `CommonError` wrapping `CancellationError`; polling occurs at entry and during scanning, rather than at incremental update or snapshot stages.

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
