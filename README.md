# powerquery-parser

[![Build Status](https://dev.azure.com/ms/powerquery-parser/_apis/build/status/microsoft.powerquery-parser?branchName=master)](https://dev.azure.com/ms/powerquery-parser/_build/latest?definitionId=134&branchName=master)

A parser for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language, written in TypeScript. Designed to be consumed by other projects.

## How to use

The most common way to consume the project is to interact with the helper functions found in [taskUtils.ts](src/powerquery-parser/task/taskUtils.ts). There are all-in-one functions, such as `tryLexParse`, which does a full pass on a given document. There are also separate lexing and parsing steps, `tryLex` and `tryParse`. Minimal code samples can be found in [example.ts](src/example.ts).

### Lexing

`Lexer.tryLex(settings, text)` scans the complete document directly into a `LexerSnapshot`, emitting final tokens, comments, and optional type directives. `TaskUtils.tryLex` and `TaskUtils.tryLexParse` use this same lexer. Task success objects and parser APIs are unchanged.

Comments remain separate from grammar tokens. Snapshots derive directive associations from the comments unless an explicit map is supplied. Comment text, source positions, directive-to-comment references, and existing directive attachment rules are preserved.

**Breaking migration:** `Lexer.TriedLex` now contains a `LexerSnapshot`, not a line-state object. Apply edits to your document text and call `Lexer.tryLex` again with the complete updated text:

```typescript
import { DefaultSettings, Lexer, ResultUtils } from "@microsoft/powerquery-parser";

const updatedDocumentText = "let x = 2 in x";
const result = Lexer.tryLex(DefaultSettings, updatedDocumentText);
if (ResultUtils.isOk(result)) {
    const snapshot = result.value;
    console.log(snapshot.tokens, snapshot.comments);
} else {
    console.error(result.error.message);
}
```

The incremental APIs (`tryAppendLine`, `tryUpdateLine`, `tryUpdateRange`, `tryDeleteLine`), line-state types (`TLine` and its variants, `LineKind`, `LineMode`, `Range`, `RangePosition`), state/line/token equality helpers, and line-error predicates/maps are removed. The exported `State` interface now describes document-scanning state rather than editable lines. `Lexer.trySnapshot` and `TriedLexerSnapshot` are also removed: there is no intermediate line-token flattening or multiline-token collapse. The `LineToken`, `LineTokenKind`, and `LineTokenKindAdditions` types are removed in favor of final `Token` values and the separate comments collection. There is no separate direct lexer or `tryLexSnapshot` API.

Malformed input returns the **first lexical diagnostic directly**, wrapped in `LexError`, using `ExpectedError`, `UnexpectedReadError`, `UnexpectedEofError`, or `UnterminatedMultilineTokenError`. It does not return partial state, collect later line errors, or re-lex for diagnostics. The incremental-only `BadLineNumberError`, `BadRangeError`, `BadStateError`, `EndOfStreamError`, and `ErrorLineMapError` types (and their associated enums/localization helpers) are removed. Diagnostic messages remain localized; positions are zero-based and now always include the absolute UTF-16 `codeUnit` offset, along with line offsets and grapheme columns. An invalid code unit inside a grapheme reports its containing column rather than an invariant failure. Unterminated-token errors point to the opening delimiter.

Cancellation remains supported and returns `CommonError` wrapping `CancellationError`. It is checked at entry and during scanning, including multiline tokens; polling granularity and check counts differ from the retired incremental pipeline. Other unexpected exceptions remain common errors.

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
