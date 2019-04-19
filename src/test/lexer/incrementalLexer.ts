// import { expect } from "chai";
// import "mocha";
// import { Lexer, TokenKind } from "../../lexer";
// import { touchedLexerFactory, touchedWithErrorLexerFactory } from "./common";

// describe("Lexer.IncrementalLexer", () => {
//     it("appendToDocument '1' to '!' on Touched", () => {
//         let lexer = touchedLexerFactory();
//         lexer = Lexer.remaining(lexer);
//         lexer = Lexer.appendToDocument(lexer, "1");
//         lexer = Lexer.remaining(lexer);

//         if (lexer.kind !== Lexer.LexerKind.Touched) {
//             const details = JSON.stringify(lexer, null, 4);
//             throw new Error(`expected lexer.kind === Lexer.LexerKind.Touched: ${details}`);
//         }

//         const lastRead = lexer.lastRead;
//         expect(lastRead.documentStartIndex).to.equal(1, lastRead.documentStartIndex.toString());
//         expect(lastRead.documentEndIndex).to.equal(2, lastRead.documentEndIndex.toString());
//         expect(lastRead.comments).to.length(0, lastRead.comments.length.toString());

//         expect(lastRead.tokens).to.length(1, lastRead.tokens.length.toString());
//         expect(lastRead.tokens[0].kind).to.equal(TokenKind.NumericLiteral, lastRead.tokens[0].kind);
//         expect(lastRead.tokens[0].data).to.equal("1", lastRead.tokens[0].data);
//     });

//     it("appendToDocument '1' to '0x' on TouchedError changes state", () => {
//         let lexer = touchedWithErrorLexerFactory("0x");
//         lexer = Lexer.appendToDocument(lexer, "1");
//         expect(lexer.kind).to.equal(Lexer.LexerKind.Untouched, lexer.kind);
//     })

//     it("appendToDocument '1' to '0x' on TouchedError returns Ok", () => {
//         let lexer = touchedWithErrorLexerFactory("0x");
//         lexer = Lexer.appendToDocument(lexer, "1");

//         lexer = Lexer.remaining(lexer);
//         if (lexer.kind !== Lexer.LexerKind.Touched) {
//             const details = JSON.stringify(lexer, null, 4);
//             throw new Error(`expected lexer.kind === Lexer.LexerKind.Touched: ${details}`);
//         }

//         const lastRead = lexer.lastRead;
//         expect(lastRead.documentStartIndex).to.equal(0, lastRead.documentStartIndex.toString());
//         expect(lastRead.documentEndIndex).to.equal(3, lastRead.documentEndIndex.toString());
//         expect(lastRead.comments).to.length(0, lastRead.comments.length.toString());

//         expect(lastRead.tokens).to.length(1, lastRead.tokens.length.toString());
//         expect(lastRead.tokens[0].kind).to.equal(TokenKind.HexLiteral, lastRead.tokens[0].kind);
//         expect(lastRead.tokens[0].data).to.equal("0x1", lastRead.tokens[0].data);
//     });
// })
