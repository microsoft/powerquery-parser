// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Constant } from "..";
import { TokenRange } from "../token";

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
    NullCoalescingExpression = "NullCoalescingExpression",
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
    | TConstant
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
    | IArrayWrapper<IConstant<Constant.UnaryOperator>>
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
    | NodeKind.NullCoalescingExpression
    | NodeKind.MetadataExpression
    | NodeKind.RelationalExpression;

export type TKeyValuePair =
    | GeneralizedIdentifierPairedAnyLiteral
    | GeneralizedIdentifierPairedExpression
    | IdentifierPairedExpression;
export type TKeyValuePairNodeKind =
    | NodeKind.GeneralizedIdentifierPairedAnyLiteral
    | NodeKind.GeneralizedIdentifierPairedExpression
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
    readonly sectionConstant: IConstant<Constant.KeywordConstant.Section>;
    readonly maybeName: Identifier | undefined;
    readonly semicolonConstant: IConstant<Constant.MiscConstant.Semicolon>;
    readonly sectionMembers: IArrayWrapper<SectionMember>;
}

export interface SectionMember extends INode {
    readonly kind: NodeKind.SectionMember;
    readonly isLeaf: false;
    readonly maybeLiteralAttributes: RecordLiteral | undefined;
    readonly maybeSharedConstant: IConstant<Constant.KeywordConstant.Shared> | undefined;
    readonly namePairedExpression: IdentifierPairedExpression;
    readonly semicolonConstant: IConstant<Constant.MiscConstant.Semicolon>;
}

// ------------------------------------------
// ---------- 12.2.3.1 Expressions ----------
// ------------------------------------------

export type TExpression =
    | TNullCoalescingExpression
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

export type NullablePrimitiveType = IPairedConstant<
    NodeKind.NullablePrimitiveType,
    Constant.LanguageConstant.Nullable,
    PrimitiveType
>;

export type IsNullablePrimitiveType = IPairedConstant<
    NodeKind.IsNullablePrimitiveType,
    Constant.KeywordConstant.Is,
    TNullablePrimitiveType
>;

export interface PrimitiveType extends INode {
    readonly kind: NodeKind.PrimitiveType;
    readonly isLeaf: true;
    readonly primitiveTypeKind: Constant.PrimitiveTypeConstant;
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

export type MetadataExpression = IBinOpExpression<
    NodeKind.MetadataExpression,
    TUnaryExpression,
    Constant.KeywordConstant.Meta,
    TUnaryExpression
>;

// -----------------------------------------------
// ---------- 12.2.3.9 Unary expression ----------
// -----------------------------------------------

export type TUnaryExpression = UnaryExpression | TTypeExpression;

export interface UnaryExpression extends INode {
    readonly kind: NodeKind.UnaryExpression;
    readonly isLeaf: false;
    readonly operators: IArrayWrapper<IConstant<Constant.UnaryOperator>>;
    readonly typeExpression: TTypeExpression;
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

export const enum LiteralKind {
    List = "List",
    Logical = "Logical",
    Null = "Null",
    Numeric = "Numeric",
    Record = "Record",
    Text = "Text",
}

export interface LiteralExpression extends INode {
    readonly kind: NodeKind.LiteralExpression;
    readonly isLeaf: true;
    readonly literal: string;
    readonly literalKind: Exclude<LiteralKind, LiteralKind.Record>;
}

// -----------------------------------------------------
// ---------- 12.2.3.12 Identifier expression ----------
// -----------------------------------------------------

export interface IdentifierExpression extends INode {
    readonly kind: NodeKind.IdentifierExpression;
    readonly isLeaf: false;
    readonly maybeInclusiveConstant: IConstant<Constant.MiscConstant.AtSign> | undefined;
    readonly identifier: Identifier;
}

// --------------------------------------------------------
// ---------- 12.2.3.14 Parenthesized expression ----------
// --------------------------------------------------------

export type ParenthesizedExpression = IParenthesisWrapped<NodeKind.ParenthesizedExpression, TExpression>;

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export interface NotImplementedExpression extends INode {
    readonly kind: NodeKind.NotImplementedExpression;
    readonly isLeaf: false;
    readonly ellipsisConstant: IConstant<Constant.MiscConstant.Ellipsis>;
}

// -------------------------------------------------
// ---------- 12.2.3.16 Invoke expression ----------
// -------------------------------------------------

export type InvokeExpression = IParenthesisWrapped<NodeKind.InvokeExpression, ICsvArray<TExpression>>;

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export type TListItem = TExpression | RangeExpression;

export type ListExpression = IBraceWrapped<NodeKind.ListExpression, ICsvArray<TListItem>>;

export interface RangeExpression extends INode {
    readonly kind: NodeKind.RangeExpression;
    readonly isLeaf: false;
    readonly left: TExpression;
    readonly rangeConstant: IConstant<Constant.MiscConstant.DotDot>;
    readonly right: TExpression;
}

// -------------------------------------------------
// ---------- 12.2.3.18 Record expression ----------
// -------------------------------------------------

export type RecordExpression = IBracketWrapped<
    NodeKind.RecordExpression,
    ICsvArray<GeneralizedIdentifierPairedExpression>
>;

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export interface ItemAccessExpression extends IBraceWrapped<NodeKind.ItemAccessExpression, TExpression> {
    // located after closeWrapperConstant
    readonly maybeOptionalConstant: IConstant<Constant.MiscConstant.QuestionMark> | undefined;
}

// --------------------------------------------------------
// ---------- 12.2.3.20 Field access expressions ----------
// --------------------------------------------------------

export type TFieldAccessExpression = FieldSelector | FieldProjection;

export interface FieldSelector extends IBracketWrapped<NodeKind.FieldSelector, GeneralizedIdentifier> {
    // located after closeWrapperConstant
    readonly maybeOptionalConstant: IConstant<Constant.MiscConstant.QuestionMark> | undefined;
}

export interface FieldProjection extends IBracketWrapped<NodeKind.FieldProjection, ICsvArray<FieldSelector>> {
    // located after closeWrapperConstant
    readonly maybeOptionalConstant: IConstant<Constant.MiscConstant.QuestionMark> | undefined;
}

// ---------------------------------------------------
// ---------- 12.2.3.22 Function expression ----------
// ---------------------------------------------------

export interface FunctionExpression extends INode {
    readonly kind: NodeKind.FunctionExpression;
    readonly isLeaf: false;
    readonly parameters: IParameterList<AsNullablePrimitiveType | undefined>;
    readonly maybeFunctionReturnType: AsNullablePrimitiveType | undefined;
    readonly fatArrowConstant: IConstant<Constant.MiscConstant.FatArrow>;
    readonly expression: TExpression;
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export type EachExpression = IPairedConstant<NodeKind.EachExpression, Constant.KeywordConstant.Each, TExpression>;

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export interface LetExpression extends INode {
    readonly kind: NodeKind.LetExpression;
    readonly letConstant: IConstant<Constant.KeywordConstant.Let>;
    readonly variableList: ICsvArray<IdentifierPairedExpression>;
    readonly inConstant: IConstant<Constant.KeywordConstant.In>;
    readonly expression: TExpression;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

export interface IfExpression extends INode {
    readonly kind: NodeKind.IfExpression;
    readonly isLeaf: false;
    readonly ifConstant: IConstant<Constant.KeywordConstant.If>;
    readonly condition: TExpression;
    readonly thenConstant: IConstant<Constant.KeywordConstant.Then>;
    readonly trueExpression: TExpression;
    readonly elseConstant: IConstant<Constant.KeywordConstant.Else>;
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
    readonly functionConstant: IConstant<Constant.PrimitiveTypeConstant.Function>;
    readonly parameters: IParameterList<AsType>;
    readonly functionReturnType: AsType;
}

export type ListType = IBraceWrapped<NodeKind.ListType, TType>;

export type NullableType = IPairedConstant<NodeKind.NullableType, Constant.LanguageConstant.Nullable, TType>;

export interface RecordType extends INode {
    readonly kind: NodeKind.RecordType;
    readonly isLeaf: false;
    readonly fields: FieldSpecificationList;
}

export interface TableType extends INode {
    readonly kind: NodeKind.TableType;
    readonly isLeaf: false;
    readonly tableConstant: IConstant<Constant.PrimitiveTypeConstant.Table>;
    readonly rowType: FieldSpecificationList | TPrimaryExpression;
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export type ErrorRaisingExpression = IPairedConstant<
    NodeKind.ErrorRaisingExpression,
    Constant.KeywordConstant.Error,
    TExpression
>;

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export interface ErrorHandlingExpression extends INode {
    readonly kind: NodeKind.ErrorHandlingExpression;
    readonly isLeaf: false;
    readonly tryConstant: IConstant<Constant.KeywordConstant.Try>;
    readonly protectedExpression: TExpression;
    readonly maybeOtherwiseExpression: OtherwiseExpression | undefined;
}

export type OtherwiseExpression = IPairedConstant<
    NodeKind.OtherwiseExpression,
    Constant.KeywordConstant.Otherwise,
    TExpression
>;

export interface RecursivePrimaryExpression extends INode {
    readonly kind: NodeKind.RecursivePrimaryExpression;
    readonly isLeaf: false;
    readonly head: TPrimaryExpression;
    readonly recursiveExpressions: IArrayWrapper<InvokeExpression | ItemAccessExpression | TFieldAccessExpression>;
}

export type TypePrimaryType = IPairedConstant<NodeKind.TypePrimaryType, Constant.KeywordConstant.Type, TPrimaryType>;

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

export type TAnyLiteral = ListLiteral | LiteralExpression | RecordLiteral;

export interface ListLiteral extends IBraceWrapped<NodeKind.ListLiteral, ICsvArray<TAnyLiteral>> {
    readonly literalKind: LiteralKind.List;
}

export interface RecordLiteral
    extends IBracketWrapped<NodeKind.RecordLiteral, ICsvArray<GeneralizedIdentifierPairedAnyLiteral>> {
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

export type ICsvArray<T extends TCsvType> = IArrayWrapper<ICsv<T>>;

export interface ICsv<T> extends INode {
    readonly kind: NodeKind.Csv;
    readonly node: T;
    readonly maybeCommaConstant: IConstant<Constant.MiscConstant.Comma> | undefined;
}

export interface IKeyValuePair<Kind extends TKeyValuePairNodeKind, Key, Value> extends INode {
    readonly kind: Kind;
    readonly key: Key;
    readonly equalConstant: IConstant<Constant.MiscConstant.Equal>;
    readonly value: Value;
}

// A [Constant, T] tuple
// eg. EachExpression is a `each` Constant paired with a TExpression
export interface IPairedConstant<Kind extends TPairedConstantNodeKind, ConstantKind extends Constant.TConstant, Paired>
    extends INode {
    readonly kind: Kind;
    readonly constant: IConstant<ConstantKind>;
    readonly paired: Paired;
}

export interface IWrapped<
    Kind extends TWrappedNodeKind,
    Open extends Constant.WrapperConstant,
    Content,
    Close extends Constant.WrapperConstant,
> extends INode {
    readonly kind: Kind;
    readonly openWrapperConstant: IConstant<Open>;
    readonly content: Content;
    readonly closeWrapperConstant: IConstant<Close>;
}

export interface IBraceWrapped<Kind extends TWrappedNodeKind, Content>
    extends IWrapped<Kind, Constant.WrapperConstant.LeftBrace, Content, Constant.WrapperConstant.RightBrace> {}

export interface IBracketWrapped<Kind extends TWrappedNodeKind, Content>
    extends IWrapped<Kind, Constant.WrapperConstant.LeftBracket, Content, Constant.WrapperConstant.RightBracket> {}

export interface IParenthesisWrapped<Kind extends TWrappedNodeKind, Content>
    extends IWrapped<
        Kind,
        Constant.WrapperConstant.LeftParenthesis,
        Content,
        Constant.WrapperConstant.RightParenthesis
    > {}

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
    | NullCoalescingExpression
    | RelationalExpression
    | TBinOpExpressionSubtype;

// The following types are needed for recursiveReadBinOpExpressionHelper,
// and are created by converting IBinOpExpression<A, B, C, D> to IBinOpExpression<A, D, C, D>.
export type TBinOpExpressionSubtype =
    | IBinOpExpression<
          NodeKind.AsExpression,
          TNullablePrimitiveType,
          Constant.KeywordConstant.As,
          TNullablePrimitiveType
      >
    | IBinOpExpression<
          NodeKind.IsExpression,
          TNullablePrimitiveType,
          Constant.KeywordConstant.Is,
          TNullablePrimitiveType
      >;

export interface IBinOpExpression<
    Kind extends TBinOpExpressionNodeKind,
    Left,
    OperatorKind extends Constant.TBinOpExpressionOperator,
    Right,
> extends INode {
    readonly kind: Kind;
    readonly left: Left;
    readonly operatorConstant: IConstant<OperatorKind>;
    readonly right:
        | Left
        | Right
        | IBinOpExpression<Kind, Left, OperatorKind, Right>
        | IBinOpExpression<Kind, Right, OperatorKind, Right>;
}

export type ArithmeticExpression = IBinOpExpression<
    NodeKind.ArithmeticExpression,
    TArithmeticExpression,
    Constant.ArithmeticOperator,
    TArithmeticExpression
>;

export type AsExpression = IBinOpExpression<
    NodeKind.AsExpression,
    TEqualityExpression,
    Constant.KeywordConstant.As,
    TNullablePrimitiveType
>;

export type EqualityExpression = IBinOpExpression<
    NodeKind.EqualityExpression,
    TEqualityExpression,
    Constant.EqualityOperator,
    TEqualityExpression
>;

export type IsExpression = IBinOpExpression<
    NodeKind.IsExpression,
    TAsExpression,
    Constant.KeywordConstant.Is,
    TNullablePrimitiveType
>;

export type LogicalExpression = IBinOpExpression<
    NodeKind.LogicalExpression,
    TLogicalExpression,
    Constant.LogicalOperator,
    TLogicalExpression
>;

export type RelationalExpression = IBinOpExpression<
    NodeKind.RelationalExpression,
    TRelationalExpression,
    Constant.RelationalOperator,
    TRelationalExpression
>;

// ------------------------------------------
// ---------- Key value pair nodes ----------
// ------------------------------------------

export type GeneralizedIdentifierPairedAnyLiteral = IKeyValuePair<
    NodeKind.GeneralizedIdentifierPairedAnyLiteral,
    GeneralizedIdentifier,
    TAnyLiteral
>;

export type GeneralizedIdentifierPairedExpression = IKeyValuePair<
    NodeKind.GeneralizedIdentifierPairedExpression,
    GeneralizedIdentifier,
    TExpression
>;

export type IdentifierPairedExpression = IKeyValuePair<NodeKind.IdentifierPairedExpression, Identifier, TExpression>;

// ---------------------------------------
// ---------- Parameter related ----------
// ---------------------------------------

export type TParameterType = AsType | AsNullablePrimitiveType | undefined;

export type IParameterList<T extends TParameterType> = IParenthesisWrapped<
    NodeKind.ParameterList,
    ICsvArray<IParameter<T>>
>;

export interface IParameter<T extends TParameterType> extends INode {
    readonly kind: NodeKind.Parameter;
    readonly isLeaf: false;
    readonly maybeOptionalConstant: IConstant<Constant.LanguageConstant.Optional> | undefined;
    readonly name: Identifier;
    readonly maybeParameterType: T;
}

export type AsNullablePrimitiveType = IPairedConstant<
    NodeKind.AsNullablePrimitiveType,
    Constant.KeywordConstant.As,
    TNullablePrimitiveType
>;

export type AsType = IPairedConstant<NodeKind.AsType, Constant.KeywordConstant.As, TType>;

// ------------------------------
// ---------- Constant ----------
// ------------------------------

export interface IConstant<ConstantKind extends Constant.TConstant> extends INode {
    readonly kind: NodeKind.Constant;
    readonly isLeaf: true;
    readonly constantKind: ConstantKind;
}

export type TConstant = IConstant<Constant.TConstant>;

// ----------------------------------------------
// ---------- NullCoalescingExpression ----------
// ----------------------------------------------

// This currently doesn't have a spot under the specification.
// For now we'll dump it here.
// TODO: find the proper place for these.

export type TNullCoalescingExpression = NullCoalescingExpression | TLogicalExpression;

export type NullCoalescingExpression = IBinOpExpression<
    NodeKind.NullCoalescingExpression,
    TLogicalExpression,
    Constant.MiscConstant.NullCoalescingOperator,
    TLogicalExpression
>;

// ----------------------------------------
// ---------- Re-used interfaces ----------
// ----------------------------------------

export interface FieldSpecification extends INode {
    readonly kind: NodeKind.FieldSpecification;
    readonly isLeaf: false;
    readonly maybeOptionalConstant: IConstant<Constant.LanguageConstant.Optional> | undefined;
    readonly name: GeneralizedIdentifier;
    readonly maybeFieldTypeSpecification: FieldTypeSpecification | undefined;
}
export interface FieldSpecificationList
    extends IBracketWrapped<NodeKind.FieldSpecificationList, ICsvArray<FieldSpecification>> {
    // located between content and closeWrapperConstant
    readonly maybeOpenRecordMarkerConstant: IConstant<Constant.MiscConstant.Ellipsis> | undefined;
}

export interface FieldTypeSpecification extends INode {
    readonly kind: NodeKind.FieldTypeSpecification;
    readonly equalConstant: IConstant<Constant.MiscConstant.Equal>;
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
