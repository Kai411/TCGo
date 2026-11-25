// The small database API the ledger code uses, and an adapter that runs it on
// a libSQL client (Turso in production, a local file or :memory: in tests).
// The ledger code never sees the client itself, so the tests can also back it
// with node:sqlite (see test/ledger.test.ts).

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

/** The part of @libsql/client's Client the adapter needs. */
export interface LibsqlClientLike {
  execute(stmt: { sql: string; args: any[] }): Promise<{ rows: any[]; columns: string[] }>;
  batch(stmts: { sql: string; args: any[] }[], mode: "write"): Promise<unknown[]>;
}

// libSQL rows are arrays with column names as extra keys; copy them into
// plain objects so callers get ordinary JSON.
const plain = (columns: string[], row: any): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  columns.forEach((c, i) => {
    const v = row[i];
    out[c] = typeof v === "bigint" ? Number(v) : v;
  });
  return out;
};

type Stmt = D1StatementLike & { toLibsql(): { sql: string; args: any[] } };

export const fromLibsql = (client: LibsqlClientLike): D1Like => {
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    first: async <T,>() => {
      const r = await client.execute({ sql, args: args as any[] });
      return (r.rows.length ? plain(r.columns, r.rows[0]) : null) as T | null;
    },
    all: async <T,>() => {
      const r = await client.execute({ sql, args: args as any[] });
      return { results: r.rows.map((row) => plain(r.columns, row)) as T[] };
    },
    run: () => client.execute({ sql, args: args as any[] }),
    toLibsql: () => ({ sql, args: args as any[] }),
  });
  return {
    prepare: (sql) => stmt(sql),
    // "write" mode runs the statements in one transaction (BEGIN IMMEDIATE),
    // so a failed assert rolls the whole batch back.
    batch: (statements) => client.batch(statements.map((s) => (s as Stmt).toLibsql()), "write"),
  };
};
