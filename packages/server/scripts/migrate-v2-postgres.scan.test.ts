import { describe, expect, test } from "bun:test";
import type { QueryResultRow } from "pg";
import {
  migrateV2PostgresToV3,
  type MigrationOptions,
  type SqlClient,
} from "./migrate-v2-postgres";

type Row = Record<string, unknown>;
type ActiveTable = "l_users" | "mint_quotes" | "mints" | "proofs";
type Tables = Record<ActiveTable, Row[]>;

const activeColumns: Record<ActiveTable, string[]> = {
  l_users: ["id", "created_at", "pubkey", "name", "mint_url", "lock_quote"],
  mint_quotes: [
    "id",
    "created_at",
    "unit",
    "mint_url",
    "payment_request",
    "quote_id",
    "expires_at",
    "amount",
    "pubkey",
    "state",
    "paid_at",
    "serialized_zap_request",
    "locked",
  ],
  mints: ["mint_url", "last_checked", "mint_info"],
  proofs: ["id", "amount", "keyset_id", "secret", "C", "state"],
};

const options: MigrationOptions = {
  dryRun: true,
  confirmV2Stopped: false,
  allowUnmigratedLegacyData: false,
  batchSize: 2,
  sourceLabel: "test-source",
  targetLabel: "test-target",
};

function emptyTables(): Tables {
  return {
    l_users: [],
    mint_quotes: [],
    mints: [],
    proofs: [],
  };
}

function proof(id: string, amount: number, state: string): Row {
  return {
    id,
    amount,
    keyset_id: "ks",
    secret: `s-${id}`,
    C: `c-${id}`,
    state,
  };
}

class EmptyTargetClient implements SqlClient {
  async query<T extends QueryResultRow = QueryResultRow>(): Promise<{
    rows: T[];
    rowCount: number;
  }> {
    return { rows: [], rowCount: 0 };
  }
}

class DryRunSourceClient implements SqlClient {
  readonly queries: string[] = [];
  private readonly cursors = new Map<
    string,
    { rows: Row[]; position: number }
  >();

  constructor(private readonly tables: Tables) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> {
    this.queries.push(sql);
    const normalized = sql.replaceAll(/\s+/g, " ").trim();
    let rows: Row[] = [];

    if (/^(BEGIN|COMMIT|ROLLBACK)\b/.test(normalized)) {
      return this.result<T>(rows);
    }

    if (normalized === "SELECT current_schema() AS schema_name") {
      return this.result<T>([{ schema_name: "public" }]);
    }

    if (normalized.includes("FROM pg_tables")) {
      rows = ["pgmigrations", ...Object.keys(activeColumns)].map(
        (tablename) => ({
          tablename,
        }),
      );
      return this.result<T>(rows);
    }

    if (normalized.includes("FROM information_schema.columns")) {
      const table = params[0] as ActiveTable;
      rows = activeColumns[table].map((column_name) => ({ column_name }));
      return this.result<T>(rows);
    }

    if (normalized.includes("SELECT name FROM pgmigrations")) {
      return this.result<T>(rows);
    }

    if (/SELECT COUNT\(\*\)::text AS count FROM/.test(normalized)) {
      return this.result<T>([{ count: "0" }]);
    }

    const declare = normalized.match(
      /^DECLARE "([^"]+)" NO SCROLL CURSOR FOR SELECT .+ FROM "([^"]+)" ORDER BY "([^"]+)"$/,
    );
    if (declare) {
      const table = declare[2] as ActiveTable;
      const orderBy = declare[3];
      this.cursors.set(declare[1], {
        rows: [...this.tables[table]].sort((left, right) =>
          comparePostgresValues(left[orderBy], right[orderBy]),
        ),
        position: 0,
      });
      return this.result<T>(rows);
    }

    const fetch = normalized.match(/^FETCH FORWARD (\d+) FROM "([^"]+)"$/);
    if (fetch) {
      const count = Number(fetch[1]);
      const cursor = this.cursors.get(fetch[2]);
      if (!cursor) throw new Error(`Unknown cursor: ${fetch[2]}`);
      rows = cursor.rows.slice(cursor.position, cursor.position + count);
      cursor.position += rows.length;
      return this.result<T>(rows);
    }

    const close = normalized.match(/^CLOSE "([^"]+)"$/);
    if (close) {
      this.cursors.delete(close[1]);
      return this.result<T>(rows);
    }

    const offsetScan = normalized.match(
      /FROM "([^"]+)" ORDER BY .+ LIMIT \$1 OFFSET \$2$/,
    );
    if (offsetScan) {
      const table = offsetScan[1] as ActiveTable;
      rows = this.tables[table].slice(
        Number(params[1]),
        Number(params[1]) + Number(params[0]),
      );
      return this.result<T>(rows);
    }

    throw new Error(`Unsupported query in test source: ${normalized}`);
  }

  private result<T extends QueryResultRow>(
    rows: Row[],
  ): {
    rows: T[];
    rowCount: number;
  } {
    return { rows: rows as T[], rowCount: rows.length };
  }
}

function comparePostgresValues(left: unknown, right: unknown): number {
  if (
    typeof left === "string" &&
    typeof right === "string" &&
    /^-?\d+$/.test(left) &&
    /^-?\d+$/.test(right)
  ) {
    const leftInteger = BigInt(left);
    const rightInteger = BigInt(right);
    return leftInteger < rightInteger ? -1 : leftInteger > rightInteger ? 1 : 0;
  }
  return String(left).localeCompare(String(right));
}

describe("v2 PostgreSQL migration table scanning", () => {
  test("rejects an invalid programmatic batch size before issuing SQL", async () => {
    const source = new DryRunSourceClient(emptyTables());

    await expect(
      migrateV2PostgresToV3(source, new EmptyTargetClient(), {
        ...options,
        batchSize: 1.5,
      }),
    ).rejects.toThrow("--batch-size must be an integer between 1 and 5000");
    expect(source.queries).toHaveLength(0);
  });

  test("scans empty active tables with transaction-scoped cursors and no OFFSET", async () => {
    const source = new DryRunSourceClient(emptyTables());

    const report = await migrateV2PostgresToV3(
      source,
      new EmptyTargetClient(),
      options,
    );

    expect(Object.values(report.tables).map((table) => table.rows)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(source.queries.some((query) => /\bOFFSET\b/.test(query))).toBe(
      false,
    );
    expect(
      source.queries.filter((query) => /^\s*DECLARE\b/.test(query)),
    ).toHaveLength(4);
    expect(
      source.queries.filter((query) => /^\s*CLOSE\b/.test(query)),
    ).toHaveLength(4);
  });

  test("scans an exact batch boundary before detecting the end", async () => {
    const tables = emptyTables();
    tables.proofs = [proof("10", 1, "UNSPENT"), proof("20", 2, "SPENT")];
    const source = new DryRunSourceClient(tables);

    const report = await migrateV2PostgresToV3(
      source,
      new EmptyTargetClient(),
      options,
    );

    expect(report.tables.proofs).toEqual({
      rows: 2,
      sourceChecksum:
        "941390d0eaad95b0b06b666f543f3b6cac2ad2d41d7d855fa0c127e4b6fd6e30",
    });
    expect(
      source.queries.filter((query) =>
        /^\s*FETCH FORWARD 2 FROM "migration_proofs_scan"/.test(query),
      ),
    ).toHaveLength(2);
  });

  test("scans multiple batches with non-contiguous IDs deterministically", async () => {
    const tables = emptyTables();
    tables.proofs = [
      proof("1000", 8, "PENDING"),
      proof("1", 1, "UNSPENT"),
      proof("9000", 16, "UNSPENT"),
      proof("25", 4, "UNSPENT"),
      proof("4", 2, "SPENT"),
    ];
    const batchTwoSource = new DryRunSourceClient(tables);
    const batchThreeSource = new DryRunSourceClient(tables);

    const [batchTwoReport, batchThreeReport] = await Promise.all([
      migrateV2PostgresToV3(batchTwoSource, new EmptyTargetClient(), options),
      migrateV2PostgresToV3(batchThreeSource, new EmptyTargetClient(), {
        ...options,
        batchSize: 3,
      }),
    ]);

    expect(batchTwoReport.tables.proofs.rows).toBe(5);
    expect(batchThreeReport.tables.proofs.rows).toBe(5);
    expect(batchTwoReport.tables.proofs.sourceChecksum).toBe(
      batchThreeReport.tables.proofs.sourceChecksum,
    );
    expect(batchTwoReport.tables.proofs.sourceChecksum).toBe(
      "1001ffe9b9671944c54aaceea457ae7f6fa964e94a289c9cf8d9ffbf2458f3d4",
    );
    expect(
      batchTwoSource.queries.filter((query) =>
        /^\s*FETCH FORWARD 2 FROM "migration_proofs_scan"/.test(query),
      ),
    ).toHaveLength(3);
    expect(
      batchThreeSource.queries.filter((query) =>
        /^\s*FETCH FORWARD 3 FROM "migration_proofs_scan"/.test(query),
      ),
    ).toHaveLength(2);
  });

  test("uses linearly scaling cursor fetches for large tables", async () => {
    const fetchCountFor = async (rowCount: number): Promise<number> => {
      const tables = emptyTables();
      tables.proofs = Array.from({ length: rowCount }, (_, index) =>
        proof(String(index * 3 + 1), index + 1, "UNSPENT"),
      );
      const source = new DryRunSourceClient(tables);

      const report = await migrateV2PostgresToV3(
        source,
        new EmptyTargetClient(),
        { ...options, batchSize: 128 },
      );

      expect(report.tables.proofs.rows).toBe(rowCount);
      return source.queries.filter((query) =>
        /^\s*FETCH FORWARD 128 FROM "migration_proofs_scan"/.test(query),
      ).length;
    };

    expect(await fetchCountFor(4_097)).toBe(33);
    expect(await fetchCountFor(8_193)).toBe(65);
  });
});
