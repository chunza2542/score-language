import {
  Binary,
  Expr,
  Grouping,
  Literal,
  Unary,
  ExplicitType,
  Variable,
} from "./Expr";
import { Stmt, Expression, VarStatement } from "./Stmt";
import { Token } from "./Token";
import { TokenType } from "./TokenType";
import { CompilationErrorInterface, SyntaxError } from "./Error";

export class Parser {
  private readonly tokens: Token[];
  private current: number = 0;
  private errors: CompilationErrorInterface[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;

      try {
        statements.push(this.statement());
      } catch (e) {
        this.errors.push(e);
      }
    }

    if (this.errors.length > 0) {
      throw new Error("failed to parse tokens");
    }

    return statements;
  }

  getErrors(): CompilationErrorInterface[] {
    return this.errors;
  }

  private statement(): Stmt {
    if (this.match(TokenType.VAR)) {
      return this.varStatement();
    }
    return this.expressionStatement();
  }

  private varStatement(): Stmt {
    const variableName: Token = this.consume(
      TokenType.IDENTIFIER,
      "expect an identifier after 'var' keyword"
    );
    let initializer: Expr = new Literal(null);
    if (this.match(TokenType.EQUAL)) {
      initializer = this.expression();
    }
    return new VarStatement(variableName, initializer);
  }

  private expressionStatement(): Stmt {
    const value: Expr = this.expression();
    this.consume(TokenType.NEWLINE, "expect 'new line' after value.");
    return new Expression(value);
  }

  private expression(): Expr {
    return this.equality();
  }

  private equality(): Expr {
    let expr: Expr = this.comparison();

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator: Token = this.previous();
      const right: Expr = this.comparison();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private comparison(): Expr {
    let expr: Expr = this.term();

    while (
      this.match(
        TokenType.GREATER,
        TokenType.GREATER_EQUAL,
        TokenType.LESS,
        TokenType.LESS_EQUAL
      )
    ) {
      const operator: Token = this.previous();
      const right: Expr = this.term();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private term(): Expr {
    let expr: Expr = this.factor();

    while (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const operator: Token = this.previous();
      const right: Expr = this.term();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private factor(): Expr {
    let expr: Expr = this.unary();

    while (this.match(TokenType.SLASH, TokenType.STAR)) {
      const operator: Token = this.previous();
      const right: Expr = this.term();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(TokenType.NOT, TokenType.MINUS, TokenType.PLUS)) {
      const operator: Token = this.previous();
      const right: Expr = this.unary();
      return new Unary(operator, right);
    }

    return this.primary();
  }

  private primary(): Expr {
    if (this.match(TokenType.IDENTIFIER)) {
      return new Variable(this.previous());
    }
    if (this.match(TokenType.FALSE)) {
      return new Literal(false);
    }
    if (this.match(TokenType.TRUE)) {
      return new Literal(true);
    }
    if (this.match(TokenType.NULL)) {
      return new Literal(null);
    }
    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return new Literal(this.previous().literal);
    }
    if (
      this.match(
        TokenType.TYPE_BOOLEAN,
        TokenType.TYPE_STRING,
        TokenType.TYPE_NUMBER
      )
    ) {
      return new ExplicitType(this.previous().type);
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RIGHT_PAREN, "expect ')' after expression");
      return new Grouping(expr);
    }

    throw this.error(this.peek(), "invalid statement");
  }

  private consume(type: TokenType, message: string) {
    if (this.check(type)) return this.advance();

    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string) {
    // synchornize until it has found statement boundary
    this.synchornize();

    return new SyntaxError(token.lexeme, token.line, message);
  }
  private synchornize() {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type == TokenType.NEWLINE) return;
      this.advance();
    }
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type == type;
  }
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  private isAtEnd(): boolean {
    return this.peek().type == TokenType.EOF;
  }
  private peek(): Token {
    return this.tokens[this.current];
  }
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}