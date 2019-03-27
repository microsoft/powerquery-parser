import { ResultKind } from "./common";
import { lexAndParse } from "./jobs";

// an example on how to consume the package.
const document = `if true then x else y`;
const lexResult = lexAndParse(document);
if (lexResult.kind === ResultKind.Ok) {
    console.log(JSON.stringify(lexResult.value, null, 4));
}
else {
    console.log(lexResult.error.message);
    console.log(JSON.stringify(lexResult.error, null, 4));
}
