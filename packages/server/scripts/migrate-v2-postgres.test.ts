import { describe, expect, test } from "bun:test";
import type { QueryResultRow } from "pg";
import {
  MigrationExecutionError,
  migrateV2PostgresToV3,
  parseArgs,
  persistMigrationReport,
  type MigrationOptions,
  type SqlClient,
} from "./migrate-v2-postgres";

const source = "postgres://user:secret@source.example/v2";
const target = "postgres://user:secret@target.example/v3";

const migrationOptions: MigrationOptions = {
  dryRun: false,
  confirmV2Stopped: true,
  allowUnmigratedLegacyData: false,
  batchSize: 500,
  sourceLabel: "postgres://source.example/v2",
  targetLabel: "postgres://target.example/v3",
};

class EmptySourceClient implements SqlClient {
  constructor(
    private readonly failCleanup = false,
    private readonly schema = "public",
    private readonly failSchemaInspection = false,
  ) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (
      this.failCleanup &&
      (normalized === "COMMIT" || normalized === "ROLLBACK")
    ) {
      throw new Error("source connection lost during cleanup");
    }
    if (normalized.includes("current_schema() AS schema_name")) {
      if (this.failSchemaInspection) {
        throw new Error("source connection timed out");
      }
      return result<T>([{ schema_name: this.schema }]);
    }
    if (normalized.includes("FROM pg_tables")) {
      return result<T>([
        { tablename: "pgmigrations" },
        { tablename: "l_users" },
        { tablename: "mint_quotes" },
        { tablename: "mints" },
        { tablename: "proofs" },
      ]);
    }
    if (normalized.includes("FROM information_schema.columns")) {
      const columns: Record<string, string[]> = {
        l_users: [
          "id",
          "created_at",
          "pubkey",
          "name",
          "mint_url",
          "lock_quote",
        ],
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
      return result<T>(
        (columns[String(params?.[0])] ?? []).map((column_name) => ({ column_name })),
      );
    }
    return result<T>([]);
  }
}

class EmptyTargetClient implements SqlClient {
  committed = false;
  receiptReadFails = false;
  private pendingReceipt?: unknown;
  private receipt?: unknown;

  constructor(private readonly loseCommitAcknowledgement = false) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("FROM pg_class")) {
      return result<T>(
        this.committed
          ? [
              { relation_name: "_migrations" },
              { relation_name: "_v2_migration_receipt" },
              { relation_name: "l_users" },
              { relation_name: "mint_quotes" },
              { relation_name: "mints" },
              { relation_name: "proofs" },
            ]
          : [],
      );
    }
    if (normalized.startsWith("INSERT INTO _v2_migration_receipt")) {
      this.pendingReceipt =
        typeof params?.[0] === "string" ? JSON.parse(params[0]) : params?.[0];
    }
    if (normalized.includes("FROM _v2_migration_receipt")) {
      if (this.receiptReadFails) {
        throw new Error("receipt query timed out");
      }
      return result<T>(this.receipt ? [{ report: this.receipt }] : []);
    }
    if (normalized === "COMMIT") {
      this.committed = true;
      this.receipt = this.pendingReceipt;
      if (this.loseCommitAcknowledgement) {
        throw new Error("connection lost while awaiting COMMIT");
      }
    }
    if (normalized === "ROLLBACK") {
      this.committed = false;
      this.pendingReceipt = undefined;
    }
    return result<T>([]);
  }
}

function result<T extends QueryResultRow>(
  rows: QueryResultRow[],
): { rows: T[]; rowCount: number } {
  return { rows: rows as T[], rowCount: rows.length };
}

describe("migrate-v2-postgres CLI", () => {
  test("accepts a dry run without the stopped-writers confirmation", () => {
    const options = parseArgs(
      ["--source", source, "--target", target, "--dry-run"],
      {},
    );

    expect(options.dryRun).toBe(true);
    expect(options.confirmV2Stopped).toBe(false);
    expect(options.batchSize).toBe(500);
  });

  test("requires confirmation before modifying the target", () => {
    expect(() => parseArgs(["--source", source, "--target", target], {})).toThrow(
      "--confirm-v2-stopped",
    );
  });

  test("reads URLs from environment variables", () => {
    const options = parseArgs(["--dry-run"], {
      V2_DATABASE_URL: source,
      V3_DATABASE_URL: target,
    });

    expect(options.sourceUrl).toBe(source);
    expect(options.targetUrl).toBe(target);
  });

  test("rejects the same source and target database", () => {
    expect(() =>
      parseArgs(
        [
          "--source",
          source,
          "--target",
          "postgres://other:credentials@source.example/v2",
          "--dry-run",
        ],
        {},
      ),
    ).toThrow("Source and target must be different");
  });

  test("rejects invalid batch sizes and non-PostgreSQL URLs", () => {
    expect(() =>
      parseArgs(
        [
          "--source",
          source,
          "--target",
          target,
          "--batch-size",
          "0",
          "--dry-run",
        ],
        {},
      ),
    ).toThrow("--batch-size");
    expect(() =>
      parseArgs(
        ["--source", "./v2.db", "--target", target, "--dry-run"],
        {},
      ),
    ).toThrow("source URL is invalid");
  });
});

describe("migrateV2PostgresToV3", () => {
  test("a non-standard source schema requires manual migration", async () => {
    const targetClient = new EmptyTargetClient();

    try {
      await migrateV2PostgresToV3(
        new EmptySourceClient(false, "tenant_v2"),
        targetClient,
        migrationOptions,
      );
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      expect((error as MigrationExecutionError).report).toMatchObject({
        status: "failed_before_target_commit",
        targetCommit: "not_attempted",
        error:
          'Source database schema "tenant_v2" is non-standard. Automatic migration only supports the v2 "public" schema; this database requires a manual migration.',
      });
    }

    expect(targetClient.committed).toBe(false);
  });

  test("a source schema query failure is safe to retry", async () => {
    try {
      await migrateV2PostgresToV3(
        new EmptySourceClient(false, "public", true),
        new EmptyTargetClient(),
        migrationOptions,
      );
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      expect((error as MigrationExecutionError).report).toMatchObject({
        status: "failed_before_target_commit",
        targetCommit: "not_attempted",
        retrySafe: true,
      });
      expect((error as MigrationExecutionError).report.operatorGuidance).toContain(
        "Restore source database connectivity and retry",
      );
    }
  });

  test("a source cleanup failure leaves the target uncommitted and safe to retry", async () => {
    const targetClient = new EmptyTargetClient();

    try {
      await migrateV2PostgresToV3(
        new EmptySourceClient(true),
        targetClient,
        migrationOptions,
      );
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      expect((error as MigrationExecutionError).report).toMatchObject({
        status: "failed_before_target_commit",
        targetCommit: "not_attempted",
        retrySafe: true,
      });
      expect((error as MigrationExecutionError).report.operatorGuidance).toContain(
        "safe to retry",
      );
    }

    expect(targetClient.committed).toBe(false);

    const retryReport = await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
    );
    expect(retryReport.status).toBe("migration_completed");
  });

  test("a completed migration reports a confirmed target commit", async () => {
    const targetClient = new EmptyTargetClient();

    const report = await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
    );

    expect(report).toMatchObject({
      version: 2,
      status: "migration_completed",
      targetCommit: "confirmed",
      retrySafe: false,
    });
    expect(targetClient.committed).toBe(true);
  });

  test("retrying a completed migration recovers its receipt without copying again", async () => {
    const targetClient = new EmptyTargetClient();
    await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
    );

    const recovered = await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
    );

    expect(recovered).toMatchObject({
      status: "migration_completed",
      targetCommit: "confirmed",
      retrySafe: false,
      recoveredFromReceipt: true,
    });
  });

  test("a receipt is not accepted for a non-standard source schema", async () => {
    const targetClient = new EmptyTargetClient();
    await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
    );

    try {
      await migrateV2PostgresToV3(
        new EmptySourceClient(false, "tenant_v2"),
        targetClient,
        migrationOptions,
      );
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      expect((error as MigrationExecutionError).report.error).toBe(
        'Source database schema "tenant_v2" is non-standard. Automatic migration only supports the v2 "public" schema; this database requires a manual migration.',
      );
    }
  });

  test("a receipt read failure reports an unknown commit instead of a generic failure", async () => {
    const targetClient = new EmptyTargetClient();
    await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
    );
    targetClient.receiptReadFails = true;

    try {
      await migrateV2PostgresToV3(
        new EmptySourceClient(),
        targetClient,
        migrationOptions,
      );
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      expect((error as MigrationExecutionError).report).toMatchObject({
        status: "target_commit_unknown",
        targetCommit: "unknown",
        retrySafe: false,
      });
    }
  });

  test("a lost commit acknowledgement is recovered from the durable receipt", async () => {
    const targetClient = new EmptyTargetClient(true);

    const report = await migrateV2PostgresToV3(
      new EmptySourceClient(),
      targetClient,
      migrationOptions,
      targetClient,
    );

    expect(report).toMatchObject({
      status: "migration_completed",
      targetCommit: "confirmed",
      retrySafe: false,
      recoveredFromReceipt: true,
    });
    expect(report.warnings).toContain(
      "The target committed, but the original connection did not acknowledge COMMIT.",
    );
  });

  test("an unverified commit failure tells the operator not to retry", async () => {
    try {
      await migrateV2PostgresToV3(
        new EmptySourceClient(),
        new EmptyTargetClient(true),
        migrationOptions,
      );
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      expect((error as MigrationExecutionError).report).toMatchObject({
        status: "target_commit_unknown",
        targetCommit: "unknown",
        retrySafe: false,
      });
      expect((error as MigrationExecutionError).report.operatorGuidance).toContain(
        "Do not retry",
      );
    }
  });

  test("report persistence failure after commit is a success warning", async () => {
    const report = await migrateV2PostgresToV3(
      new EmptySourceClient(),
      new EmptyTargetClient(),
      migrationOptions,
    );

    const warning = await persistMigrationReport(
      report,
      "unwritable/report.json",
      async () => {
        throw new Error("permission denied");
      },
    );

    expect(warning).toBe(
      "Migration completed and the target commit is confirmed, but the report could not be written to unwritable/report.json: permission denied",
    );
  });
});
