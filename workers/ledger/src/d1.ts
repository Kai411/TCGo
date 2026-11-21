// The slice of Cloudflare's D1 API this Worker uses. Declared here instead of
// pulling in @cloudflare/workers-types, and small enough that the tests can
// back it with node:sqlite (see test/ledger-worker.test.ts).

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(sql: string): D1StatementLike;
  /** One SQL transaction: every statement commits, or none does. */
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
}
