import { Ast, ParserError } from "..";
import { CommonError, isNever, Result, ResultKind } from "../../common";
import { BracketDisambiguation, IParser } from "../IParser";
import { IParserState } from "../IParserState";

export function readBracketDisambiguation(
    state: IParserState,
    parser: IParser<IParserState>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression {
    const triedDisambiguation: Result<
        BracketDisambiguation,
        ParserError.UnterminatedBracketError
    > = parser.disambiguateBracket(state, parser);
    if (triedDisambiguation.kind === ResultKind.Err) {
        throw triedDisambiguation.error;
    }
    const disambiguation: BracketDisambiguation = triedDisambiguation.value;
    if (allowedVariants.indexOf(disambiguation) === -1) {
        throw new CommonError.InvariantError(
            `grammer doesn't allow remaining BracketDisambiguation: ${disambiguation}`,
        );
    }

    switch (disambiguation) {
        case BracketDisambiguation.FieldProjection:
            return parser.readFieldProjection(state, parser);

        case BracketDisambiguation.FieldSelection:
            return parser.readFieldSelection(state, parser);

        case BracketDisambiguation.Record:
            return parser.readRecordExpression(state, parser);

        default:
            throw isNever(disambiguation);
    }
}
