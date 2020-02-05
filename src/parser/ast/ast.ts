// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TokenRange } from "../../lexer/token";

export const enum NodeKind {
    ArithmeticExpression = "ArithmeticExpression",
    ArrayWrapper = "ArrayWrapper",
    AsExpression = "AsExpression",
    AsNullablePrimitiveType = "AsNullablePrimitiveType",
    AsType = "AsType",
    Constant = "Constant",
    Csv = "Csv",
    EachExpression = "EachExpression",
    EqualityExpression = "EqualityExpression",
    ErrorHandlingExpression = "ErrorHandlingExpression",
    ErrorRaisingExpression = "ErrorRaisingExpression",
    FieldProjection = "FieldProjection",
    FieldSelector = "FieldSelector",
    FieldSpecification = "FieldSpecification",
    FieldSpecificationList = "FieldSpecificationList",
    FieldTypeSpecification = "FieldTypeSpecification",
    FunctionExpression = "FunctionExpression",
    FunctionType = "FunctionType",
    GeneralizedIdentifier = "GeneralizedIdentifier",
    GeneralizedIdentifierPairedAnyLiteral = "GeneralizedIdentifierPairedAnyLiteral",
    GeneralizedIdentifierPairedExpression = "GeneralizedIdentifierPairedExpression",
    Identifier = "Identifier",
    IdentifierExpression = "IdentifierExpression",
    IdentifierExpressionPairedExpression = "IdentifierExpressionPairedExpression",
    IdentifierPairedExpression = "IdentifierPairedExpression",
    IfExpression = "IfExpression",
    InvokeExpression = "InvokeExpression",
    IsExpression = "IsExpression",
    IsNullablePrimitiveType = "IsNullablePrimitiveType",
    ItemAccessExpression = "ItemAccessExpression",
    LetExpression = "LetExpression",
    ListExpression = "ListExpression",
    ListLiteral = "ListLiteral",
    ListType = "ListType",
    LiteralExpression = "LiteralExpression",
    LogicalExpression = "LogicalExpression",
    MetadataExpression = "MetadataExpression",
    NotImplementedExpression = "NotImplementedExpression",
    NullablePrimitiveType = "NullablePrimitiveType",
    NullableType = "NullableType",
    OtherwiseExpression = "OtherwiseExpression",
    Parameter = "Parameter",
    ParameterList = "ParameterList",
    ParenthesizedExpression = "ParenthesizedExpression",
    PrimitiveType = "PrimitiveType",
    RangeExpression = "RangeExpression",
    RecordExpression = "RecordExpression",
    RecordLiteral = "RecordLiteral",
    RecordType = "RecordType",
    RecursivePrimaryExpression = "RecursivePrimaryExpression",
    RecursivePrimaryExpressionArray = "RecursivePrimaryExpressionArray",
    RelationalExpression = "RelationalExpression",
    Section = "Section",
    SectionMember = "SectionMember",
    TableType = "TableType",
    TypePrimaryType = "TypePrimaryType",
    UnaryExpression = "UnaryExpression",
}

// -------------------------------------
// ---------- INode and TNode ----------
// -------------------------------------

export interface INode {
    readonly kind: NodeKind;
    readonly id: number;
    readonly maybeAttributeIndex: number | undefined;
    // The [start, end) range of a Ast.TNode.
    readonly tokenRange: TokenRange;
    readonly isLeaf: boolean;
}

export type TNode = TDocument | TAuxiliaryNodes;

// ----------------------------------------
// ---------- Non-standard Nodes ----------
// ----------------------------------------
// These don't fit into a standard node hierarchy,
// but are still considered a TNode.

export type TAuxiliaryNodes =
    | Constant
    | FieldSpecification
    | FieldSpecificationList
    | FieldTypeSpecification
    | GeneralizedIdentifier
    | Identifier
    | SectionMember
    | TAnyLiteral
    | TArrayWrapper
    | TBinOpExpression
    | TCsv
    | TKeyValuePair
    | TListItem
    | TNullablePrimitiveType
    | TPairedConstant
    | TParameter
    | TParameterList
    | TType
    | TWrapped;

export type TArrayWrapper =
    | IArrayWrapper<AsNullablePrimitiveType>
    | IArrayWrapper<Constant>
    | IArrayWrapper<IsNullablePrimitiveType>
    | IArrayWrapper<SectionMember>
    | IArrayWrapper<TRecursivePrimaryExpression>
    | TCsvArray;

export type TCsvArray = ICsvArray<TCsvType>;
export type TCsv = ICsv<TCsvType>;
export type TCsvType =
    | FieldSelector
    | FieldSpecification
    | GeneralizedIdentifierPairedAnyLiteral
    | GeneralizedIdentifierPairedExpression
    | IdentifierPairedExpression
    | TParameter
    | TAnyLiteral
    | TExpression
    | TListItem;

export type TParameter = IParameter<TParameterType>;
export type TParameterList = IParameterList<TParameterType>;

export type TRecursivePrimaryExpression =
    | RecursivePrimaryExpression
    | InvokeExpression
    | ItemAccessExpression
    | TFieldAccessExpression;

// -----------------------------------
// ---------- Node subtypes ----------
// -----------------------------------

export type TBinOpExpressionNodeKind =
    | NodeKind.ArithmeticExpression
    | NodeKind.AsExpression
    | NodeKind.EqualityExpression
    | NodeKind.IsExpression
    | NodeKind.LogicalExpression
    | NodeKind.MetadataExpression
    | NodeKind.RelationalExpression;

export type TKeyValuePair =
    | GeneralizedIdentifierPairedAnyLiteral
    | GeneralizedIdentifierPairedExpression
    | IdentifierExpressionPairedExpression
    | IdentifierPairedExpression;
export type TKeyValuePairNodeKind =
    | NodeKind.GeneralizedIdentifierPairedAnyLiteral
    | NodeKind.GeneralizedIdentifierPairedExpression
    | NodeKind.IdentifierExpressionPairedExpression
    | NodeKind.IdentifierPairedExpression;

export type TPairedConstant =
    | AsNullablePrimitiveType
    | AsType
    | EachExpression
    | ErrorRaisingExpression
    | IsNullablePrimitiveType
    | NullablePrimitiveType
    | NullableType
    | OtherwiseExpression
    | TypePrimaryType;
export type TPairedConstantNodeKind =
    | NodeKind.AsNullablePrimitiveType
    | NodeKind.AsType
    | NodeKind.EachExpression
    | NodeKind.ErrorRaisingExpression
    | NodeKind.IsNullablePrimitiveType
    | NodeKind.NullablePrimitiveType
    | NodeKind.NullableType
    | NodeKind.OtherwiseExpression
    | NodeKind.TypePrimaryType;

// TWrapped where Content is TCsv[] and no extra attributes
export type TWrapped =
    | InvokeExpression
    | ListExpression
    | ListLiteral
    | RecordExpression
    | RecordLiteral
    | TParameterList
    | FieldProjection
    | FieldSelector
    | FieldSpecificationList
    | ItemAccessExpression
    | ListType
    | ParenthesizedExpression;
export type TWrappedNodeKind =
    | NodeKind.FieldProjection
    | NodeKind.FieldSelector
    | NodeKind.FieldSpecificationList
    | NodeKind.InvokeExpression
    | NodeKind.ItemAccessExpression
    | NodeKind.ListExpression
    | NodeKind.ListLiteral
    | NodeKind.ListType
    | NodeKind.ParameterList
    | NodeKind.ParenthesizedExpression
    | NodeKind.RecordExpression
    | NodeKind.RecordLiteral;

// --------------------------------------
// ---------- 12.2.1 Documents ----------
// --------------------------------------

export type TDocument = Section | TExpression;

// ----------------------------------------------
// ---------- 12.2.2 Section Documents ----------
// ----------------------------------------------

export interface Section extends INode {
    readonly kind: NodeKind.Section;
    readonly isLeaf: false;
    readonly maybeLiteralAttributes: RecordLiteral | undefined;
    readonly sectionConstant: Constant;
    readonly maybeName: Identifier | undefined;
    readonly semicolonConstant: Constant;
    readonly sectionMembers: IArrayWrapper<SectionMember>;
}

export interface SectionMember extends INode {
    readonly kind: NodeKind.SectionMember;
    readonly isLeaf: false;
    readonly maybeLiteralAttributes: RecordLiteral | undefined;
    readonly maybeSharedConstant: Constant | undefined;
    readonly namePairedExpression: IdentifierPairedExpression;
    readonly semicolonConstant: Constant;
}

// ------------------------------------------
// ---------- 12.2.3.1 Expressions ----------
// ------------------------------------------

export type TExpression =
    | TLogicalExpression
    | EachExpression
    | FunctionExpression
    | LetExpression
    | IfExpression
    | ErrorRaisingExpression
    | ErrorHandlingExpression;

// --------------------------------------------------
// ---------- 12.2.3.2 Logical expressions ----------
// --------------------------------------------------

export type TLogicalExpression = LogicalExpression | TIsExpression;

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

export type TIsExpression = IsExpression | TAsExpression;

export type TNullablePrimitiveType = NullablePrimitiveType | PrimitiveType;

export interface NullablePrimitiveType extends IPairedConstant<NodeKind.NullablePrimitiveType, PrimitiveType> {}

export interface IsNullablePrimitiveType
    extends IPairedConstant<NodeKind.IsNullablePrimitiveType, TNullablePrimitiveType> {}

export interface PrimitiveType extends INode {
    readonly kind: NodeKind.PrimitiveType;
    readonly isLeaf: false;
    readonly primitiveType: Constant;
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export type TAsExpression = AsExpression | TEqualityExpression;

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

export type TEqualityExpression = EqualityExpression | TRelationalExpression;

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ----------------------------------------------------

export type TRelationalExpression = RelationalExpression | TArithmeticExpression;

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

export type TArithmeticExpression = ArithmeticExpression | TMetadataExpression;

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

export type TMetadataExpression = MetadataExpression | TUnaryExpression;

export interface MetadataExpression
    extends IBinOpExpression<NodeKind.MetadataExpression, TUnaryExpression, ConstantKind.Meta, TUnaryExpression> {}

// -----------------------------------------------
// ---------- 12.2.3.9 Unary expression ----------
// -----------------------------------------------

export type TUnaryExpression = UnaryExpression | TTypeExpression;

export interface UnaryExpression extends INode {
    readonly kind: NodeKind.UnaryExpression;
    readonly isLeaf: false;
    readonly operators: IArrayWrapper<Constant>;
    readonly typeExpression: TTypeExpression;
}

export const enum UnaryOperator {
    Positive = "+",
    Negative = "-",
    Not = "not",
}

// --------------------------------------------------
// ---------- 12.2.3.10 Primary expression ----------
// --------------------------------------------------

export type TPrimaryExpression =
    | LiteralExpression
    | ListExpression
    | RecordExpression
    | IdentifierExpression
    // SectionAccessExpression
    | ParenthesizedExpression
    | TFieldAccessExpression
    | TRecursivePrimaryExpression
    | NotImplementedExpression;

// --------------------------------------------------
// ---------- 12.2.3.11 Literal expression ----------
// --------------------------------------------------

export interface LiteralExpression extends INode {
    readonly kind: NodeKind.LiteralExpression;
    readonly isLeaf: true;
    readonly literal: string;
    readonly literalKind: LiteralKind;
}

export const enum LiteralKind {
    Logical = "Logical",
    Null = "Null",
    Numeric = "Numeric",
    Str = "Str",
    Record = "Record",
    List = "List",
}

// -----------------------------------------------------
// ---------- 12.2.3.12 Identifier expression ----------
// -----------------------------------------------------

export interface IdentifierExpression extends INode {
    readonly kind: NodeKind.IdentifierExpression;
    readonly isLeaf: false;
    readonly maybeInclusiveConstant: Constant | undefined;
    readonly identifier: Identifier;
}

// --------------------------------------------------------
// ---------- 12.2.3.14 Parenthesized expression ----------
// --------------------------------------------------------

export interface ParenthesizedExpression extends IWrapped<NodeKind.ParenthesizedExpression, TExpression> {}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export interface NotImplementedExpression extends INode {
    readonly kind: NodeKind.NotImplementedExpression;
    readonly isLeaf: false;
    readonly ellipsisConstant: Constant;
}

// -------------------------------------------------
// ---------- 12.2.3.16 Invoke expression ----------
// -------------------------------------------------

export interface InvokeExpression extends IWrapped<NodeKind.InvokeExpression, ICsvArray<TExpression>> {}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export type TListItem = TExpression | RangeExpression;

export interface ListExpression extends IWrapped<NodeKind.ListExpression, ICsvArray<TListItem>> {}

export interface RangeExpression extends INode {
    readonly kind: NodeKind.RangeExpression;
    readonly isLeaf: false;
    readonly left: TExpression;
    readonly rangeConstant: Constant;
    readonly right: TExpression;
}

// -------------------------------------------------
// ---------- 12.2.3.18 Record expression ----------
// -------------------------------------------------

export interface RecordExpression
    extends IWrapped<NodeKind.RecordExpression, ICsvArray<GeneralizedIdentifierPairedExpression>> {}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export interface ItemAccessExpression extends IWrapped<NodeKind.ItemAccessExpression, TExpression> {
    // located after closeWrapperConstant
    readonly maybeOptionalConstant: Constant | undefined;
}

// --------------------------------------------------------
// ---------- 12.2.3.20 Field access expressions ----------
// --------------------------------------------------------

export type TFieldAccessExpression = FieldSelector | FieldProjection;

export interface FieldSelector extends IWrapped<NodeKind.FieldSelector, GeneralizedIdentifier> {
    // located after closeWrapperConstant
    readonly maybeOptionalConstant: Constant | undefined;
}

export interface FieldProjection extends IWrapped<NodeKind.FieldProjection, ICsvArray<FieldSelector>> {
    // located after closeWrapperConstant
    readonly maybeOptionalConstant: Constant | undefined;
}

// ---------------------------------------------------
// ---------- 12.2.3.22 Function expression ----------
// ---------------------------------------------------

export interface FunctionExpression extends INode {
    readonly kind: NodeKind.FunctionExpression;
    readonly isLeaf: false;
    readonly parameters: IParameterList<AsNullablePrimitiveType | undefined>;
    readonly maybeFunctionReturnType: AsNullablePrimitiveType | undefined;
    readonly fatArrowConstant: Constant;
    readonly expression: TExpression;
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export interface EachExpression extends IPairedConstant<NodeKind.EachExpression, TExpression> {}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export interface LetExpression extends INode {
    readonly kind: NodeKind.LetExpression;
    readonly letConstant: Constant;
    readonly variableList: ICsvArray<IdentifierPairedExpression>;
    readonly inConstant: Constant;
    readonly expression: TExpression;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

export interface IfExpression extends INode {
    readonly kind: NodeKind.IfExpression;
    readonly isLeaf: false;
    readonly ifConstant: Constant;
    readonly condition: TExpression;
    readonly thenConstant: Constant;
    readonly trueExpression: TExpression;
    readonly elseConstant: Constant;
    readonly falseExpression: TExpression;
}

// -----------------------------------------------
// ---------- 12.2.3.25 Type expression ----------
// -----------------------------------------------

export type TTypeExpression = TPrimaryExpression | TypePrimaryType;

// Technically TExpression should be ParenthesizedExpression, but I'm matching Microsoft's C# parser.
export type TType = TExpression | TPrimaryType;

export type TPrimaryType = PrimitiveType | FunctionType | ListType | NullableType | RecordType | TableType;

export interface FunctionType extends INode {
    readonly kind: NodeKind.FunctionType;
    readonly isLeaf: false;
    readonly functionConstant: Constant;
    readonly parameters: IParameterList<AsType>;
    readonly functionReturnType: AsType;
}

export interface ListType extends IWrapped<NodeKind.ListType, TType> {}

export interface NullableType extends IPairedConstant<NodeKind.NullableType, TType> {}

export interface RecordType extends INode {
    readonly kind: NodeKind.RecordType;
    readonly isLeaf: false;
    readonly fields: FieldSpecificationList;
}

export interface TableType extends INode {
    readonly kind: NodeKind.TableType;
    readonly isLeaf: false;
    readonly tableConstant: Constant;
    readonly rowType: FieldSpecificationList | TPrimaryExpression;
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export interface ErrorRaisingExpression extends IPairedConstant<NodeKind.ErrorRaisingExpression, TExpression> {}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export interface ErrorHandlingExpression extends INode {
    readonly kind: NodeKind.ErrorHandlingExpression;
    readonly isLeaf: false;
    readonly tryConstant: Constant;
    readonly protectedExpression: TExpression;
    readonly maybeOtherwiseExpression: OtherwiseExpression | undefined;
}

export interface OtherwiseExpression extends IPairedConstant<NodeKind.OtherwiseExpression, TExpression> {}

export interface RecursivePrimaryExpression extends INode {
    readonly kind: NodeKind.RecursivePrimaryExpression;
    readonly isLeaf: false;
    readonly head: TPrimaryExpression;
    readonly recursiveExpressions: IArrayWrapper<TRecursivePrimaryExpression>;
}

export interface TypePrimaryType extends IPairedConstant<NodeKind.TypePrimaryType, TPrimaryType> {}

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

export type TAnyLiteral = ListLiteral | LiteralExpression | RecordLiteral;

export interface ListLiteral extends IWrapped<NodeKind.ListLiteral, ICsvArray<TAnyLiteral>> {
    readonly literalKind: LiteralKind.List;
}

export interface RecordLiteral
    extends IWrapped<NodeKind.RecordLiteral, ICsvArray<GeneralizedIdentifierPairedAnyLiteral>> {
    readonly literalKind: LiteralKind.Record;
}

// -----------------------------------------
// ---------- Abstract interfaces ----------
// -----------------------------------------

// Allows the ReadonlyArray to be treated as a TNode.
// Without this wrapper ParserContext couldn't save partial progress for parsing an array.
export interface IArrayWrapper<T> extends INode {
    readonly kind: NodeKind.ArrayWrapper;
    readonly elements: ReadonlyArray<T>;
}

export interface ICsvArray<T> extends IArrayWrapper<ICsv<T & TCsvType>> {}

export interface ICsv<T> extends INode {
    readonly kind: NodeKind.Csv;
    readonly node: T;
    readonly maybeCommaConstant: Constant | undefined;
}

export interface IKeyValuePair<Kind, Key, Value> extends INode {
    readonly kind: Kind & TKeyValuePairNodeKind;
    readonly key: Key;
    readonly equalConstant: Constant;
    readonly value: Value;
}

// A [Constant, T] tuple
// eg. EachExpression is a `each` Constant paired with a TExpression
export interface IPairedConstant<Kind, Paired> extends INode {
    readonly kind: Kind & TPairedConstantNodeKind;
    readonly constant: Constant;
    readonly paired: Paired;
}

export interface IWrapped<Kind, Content> extends INode {
    readonly kind: Kind & TWrappedNodeKind;
    readonly openWrapperConstant: Constant;
    readonly content: Content;
    readonly closeWrapperConstant: Constant;
}

// --------------------------------------
// ---------- IBinOpExpression ----------
// --------------------------------------

export type TBinOpExpression =
    | ArithmeticExpression
    | AsExpression
    | EqualityExpression
    | IsExpression
    | LogicalExpression
    | MetadataExpression
    | RelationalExpression
    | TBinOpExpressionSubtype;

// The following types are needed for recursiveReadBinOpExpressionHelper,
// and are created by converting IBinOpExpression<A, B, C, D> to IBinOpExpression<A, D, C, D>.
export type TBinOpExpressionSubtype =
    | IBinOpExpression<NodeKind.AsExpression, TNullablePrimitiveType, ConstantKind.As, TNullablePrimitiveType>
    | IBinOpExpression<NodeKind.IsExpression, TNullablePrimitiveType, ConstantKind.Is, TNullablePrimitiveType>;

export interface IBinOpExpression<Kind, Left, Operator, Right> extends INode {
    readonly kind: Kind & TBinOpExpressionNodeKind;
    readonly left: Left;
    readonly operator: Operator;
    readonly operatorConstant: Constant;
    readonly right:
        | Left
        | Right
        | IBinOpExpression<Kind, Left, Operator, Right>
        | IBinOpExpression<Kind, Right, Operator, Right>;
}

export interface ArithmeticExpression
    extends IBinOpExpression<
        NodeKind.ArithmeticExpression,
        TArithmeticExpression,
        ArithmeticOperator,
        TArithmeticExpression
    > {}

export interface AsExpression
    extends IBinOpExpression<NodeKind.AsExpression, TEqualityExpression, ConstantKind.As, TNullablePrimitiveType> {}

export interface EqualityExpression
    extends IBinOpExpression<NodeKind.EqualityExpression, TEqualityExpression, EqualityOperator, TEqualityExpression> {}

export interface IsExpression
    extends IBinOpExpression<NodeKind.IsExpression, TAsExpression, ConstantKind.Is, TNullablePrimitiveType> {}

export interface LogicalExpression
    extends IBinOpExpression<NodeKind.LogicalExpression, TLogicalExpression, LogicalOperator, TLogicalExpression> {}

export interface RelationalExpression
    extends IBinOpExpression<
        NodeKind.RelationalExpression,
        TRelationalExpression,
        RelationalOperator,
        TRelationalExpression
    > {}

// ------------------------------------------------
// ---------- IBinOpExpression Operators ----------
// ------------------------------------------------

export type TBinOpExpressionOperator =
    | ArithmeticOperator
    | EqualityOperator
    | LogicalOperator
    | RelationalOperator
    | ConstantKind.As
    | ConstantKind.Is
    | ConstantKind.Meta;

export const enum ArithmeticOperator {
    Multiplication = "*",
    Division = "/",
    Addition = "+",
    Subtraction = "-",
    And = "&",
}

export const enum EqualityOperator {
    EqualTo = "=",
    NotEqualTo = "<>",
}

export const enum LogicalOperator {
    And = "and",
    Or = "or",
}

export const enum RelationalOperator {
    LessThan = "<",
    LessThanEqualTo = "<=",
    GreaterThan = ">",
    GreaterThanEqualTo = ">=",
}

// ------------------------------------------
// ---------- Key value pair nodes ----------
// ------------------------------------------

export interface GeneralizedIdentifierPairedAnyLiteral
    extends IKeyValuePair<NodeKind.GeneralizedIdentifierPairedAnyLiteral, GeneralizedIdentifier, TAnyLiteral> {}

export interface GeneralizedIdentifierPairedExpression
    extends IKeyValuePair<NodeKind.GeneralizedIdentifierPairedExpression, GeneralizedIdentifier, TExpression> {}

export interface IdentifierPairedExpression
    extends IKeyValuePair<NodeKind.IdentifierPairedExpression, Identifier, TExpression> {}

export interface IdentifierExpressionPairedExpression
    extends IKeyValuePair<NodeKind.IdentifierExpressionPairedExpression, IdentifierExpression, TExpression> {}

// ---------------------------------------
// ---------- Parameter related ----------
// ---------------------------------------

export type TParameterType = AsType | AsNullablePrimitiveType | undefined;

export interface IParameterList<T>
    extends IWrapped<NodeKind.ParameterList, ICsvArray<IParameter<T & TParameterType>>> {}

export interface IParameter<T> extends INode {
    readonly kind: NodeKind.Parameter;
    readonly isLeaf: false;
    readonly maybeOptionalConstant: Constant | undefined;
    readonly name: Identifier;
    readonly maybeParameterType: T & TParameterType;
}

export interface AsNullablePrimitiveType
    extends IPairedConstant<NodeKind.AsNullablePrimitiveType, TNullablePrimitiveType> {}

export interface AsType extends IPairedConstant<NodeKind.AsType, TType> {}

// ----------------------------------------
// ---------- Re-used interfaces ----------
// ----------------------------------------

export interface Constant extends INode {
    readonly kind: NodeKind.Constant;
    readonly isLeaf: true;
    readonly constantKind: ConstantKind;
}

export interface FieldSpecification extends INode {
    readonly kind: NodeKind.FieldSpecification;
    readonly isLeaf: false;
    readonly maybeOptionalConstant: Constant | undefined;
    readonly name: GeneralizedIdentifier;
    readonly maybeFieldTypeSpeification: FieldTypeSpecification | undefined;
}
export interface FieldSpecificationList
    extends IWrapped<NodeKind.FieldSpecificationList, ICsvArray<FieldSpecification>> {
    // located between content and closeWrapperConstant
    readonly maybeOpenRecordMarkerConstant: Constant | undefined;
}

export interface FieldTypeSpecification extends INode {
    readonly kind: NodeKind.FieldTypeSpecification;
    readonly equalConstant: Constant;
    readonly fieldType: TType;
}

export interface GeneralizedIdentifier extends INode {
    readonly kind: NodeKind.GeneralizedIdentifier;
    readonly isLeaf: true;
    readonly literal: string;
}

export interface Identifier extends INode {
    readonly kind: NodeKind.Identifier;
    readonly isLeaf: true;
    readonly literal: string;
}

// ---------------------------------
// ---------- const enums ----------
// ---------------------------------

export const enum ConstantKind {
    // TokenKind
    As = "as",
    AtSign = "@",
    Comma = ",",
    DotDot = "..",
    Each = "each",
    Ellipsis = "...",
    Else = "else",
    Equal = "=",
    Error = "error",
    FatArrow = "=>",
    If = "if",
    In = "in",
    Is = "is",
    Section = "section",
    Semicolon = ";",
    Shared = "shared",
    LeftBrace = "{",
    LeftBracket = "[",
    LeftParenthesis = "(",
    Let = "let",
    Meta = "meta",
    Null = "null",
    Otherwise = "otherwise",
    QuestionMark = "?",
    RightBrace = "}",
    RightBracket = "]",
    RightParenthesis = ")",
    Then = "then",
    Try = "try",
    Type = "type",

    // IdentifierConstant
    Action = "action",
    Any = "any",
    AnyNonNull = "anynonnull",
    Binary = "binary",
    Date = "date",
    DateTime = "datetime",
    DateTimeZone = "datetimezone",
    Duration = "duration",
    Function = "function",
    List = "list",
    Logical = "logical",
    None = "none",
    Nullable = "nullable",
    Number = "number",
    Optional = "optional",
    Record = "record",
    Table = "table",
    Text = "text",
    Time = "time",

    // ArithmeticOperator
    Asterisk = "*",
    Division = "/",
    Plus = "+",
    Minus = "-",

    // LogicalOperator
    And = "and",
    Or = "or",

    // RelationalOperator
    LessThan = "<",
    LessThanEqualTo = "<=",
    GreaterThan = ">",
    GreaterThanEqualTo = ">=",

    // UnaryOperator
    Not = "not",
}

export const enum IdentifierConstant {
    Action = "action",
    Any = "any",
    AnyNonNull = "anynonnull",
    Binary = "binary",
    Date = "date",
    DateTime = "datetime",
    DateTimeZone = "datetimezone",
    Duration = "duration",
    Function = "function",
    List = "list",
    Logical = "logical",
    None = "none",
    Nullable = "nullable",
    Number = "number",
    Optional = "optional",
    Record = "record",
    Table = "table",
    Text = "text",
    Time = "time",
}
