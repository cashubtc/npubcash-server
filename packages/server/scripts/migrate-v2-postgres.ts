import { createHash } from "crypto";
import { Client, type QueryResultRow } from "pg";
import type { DatabaseAdapter, QueryResult } from "../src/database/adapter";
import { runMigrations } from "../src/migrations";

type Row = Record<string, unknown>;

export interface SqlClient {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

interface CliOptions {
  sourceUrl: string;
  targetUrl: string;
  dryRun: boolean;
  confirmV2Stopped: boolean;
  allowUnmigratedLegacyData: boolean;
  batchSize: number;
  reportPath?: string;
}

export interface MigrationOptions {
  dryRun: boolean;
  confirmV2Stopped: boolean;
  allowUnmigratedLegacyData: boolean;
  batchSize: number;
  sourceLabel: string;
  targetLabel: string;
}

interface TablePlan {
  name: string;
  keys: string[];
  select: string;
  orderBy: string;
  identity: boolean;
}

interface TableResult {
  rows: number;
  sourceChecksum: string;
  targetChecksum?: string;
}

export interface MigrationReport {
  version: 2;
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  source: string;
  target: string;
  status: "dry_run_completed" | "migration_completed";
  targetCommit: "not_attempted" | "confirmed";
  retrySafe: boolean;
  recoveredFromReceipt: boolean;
  operatorGuidance: string;
  sourceMigrations: string[];
  zapColumnMode: "typo" | "correct" | "both";
  tables: Record<string, TableResult>;
  legacyTables: Record<string, number>;
  warnings: string[];
}

export interface MigrationFailureReport {
  version: 2;
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  source: string;
  target: string;
  status: "failed_before_target_commit" | "target_commit_unknown";
  targetCommit: "not_attempted" | "unknown";
  retrySafe: boolean;
  operatorGuidance: string;
  error: string;
}

export type MigrationOutcomeReport = MigrationReport | MigrationFailureReport;
export type MigrationReportWriter = (
  path: string,
  contents: string,
) => Promise<unknown>;

export class MigrationExecutionError extends Error {
  constructor(
    message: string,
    readonly report: MigrationFailureReport,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MigrationExecutionError";
  }
}

const ACTIVE_TABLE_COLUMNS: Record<string, string[]> = {
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
    "locked",
  ],
  mints: ["mint_url", "last_checked", "mint_info"],
  proofs: ["id", "amount", "keyset_id", "secret", "C", "state"],
};

const LEGACY_TABLES = [
  "l_alias_requests",
  "l_claims_3",
  "l_failed_payments",
  "l_inflight",
  "l_payments",
  "l_transactions",
  "l_withdrawals",
] as const;

const MIGRATION_RECEIPT_TABLE = "_v2_migration_receipt";

class TargetNotEmptyError extends Error {}

class UnsupportedSourceSchemaError extends Error {}

class ClientDatabaseAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;

  constructor(private readonly client: SqlClient) {}

  async query<T = Row>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const result = await this.client.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async close(): Promise<void> {}
}

function usage(): string {
  return `Migrate a stopped v2 PostgreSQL database into a new, empty v3 PostgreSQL database.

Usage:
  bun run migrate:v2-postgres -- \\
    --source <v2-postgres-url> \\
    --target <empty-v3-postgres-url> \\
    --confirm-v2-stopped

Options:
  --source <url>                       v2 PostgreSQL URL (or V2_DATABASE_URL)
  --target <url>                       empty v3 PostgreSQL URL (or V3_DATABASE_URL)
  --dry-run                            validate and checksum without modifying target
  --confirm-v2-stopped                 confirm all v2 writers are stopped
  --allow-unmigrated-legacy-data       leave populated v1-only tables in source
  --batch-size <number>                rows per insert batch (default: 500)
  --report <path>                      write the JSON report to a file
  --help                               show this help

The source database is never modified. The target must be empty on the first run;
a matching completed migration receipt is recognized on later runs. Automatic
migration requires the standard v2 public schema; other schemas require a manual
migration.`;
}

function readOption(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function assertValidBatchSize(batchSize: number): void {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error("--batch-size must be an integer between 1 and 5000");
  }
}

export function parseArgs(
  args: string[],
  env: Record<string, string | undefined> = process.env,
): CliOptions {
  let sourceUrl = env.V2_DATABASE_URL;
  let targetUrl = env.V3_DATABASE_URL;
  let dryRun = false;
  let confirmV2Stopped = false;
  let allowUnmigratedLegacyData = false;
  let batchSize = 500;
  let reportPath: string | undefined;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--source") {
      sourceUrl = readOption(args, index, arg);
      index++;
    } else if (arg.startsWith("--source=")) {
      sourceUrl = arg.slice("--source=".length);
    } else if (arg === "--target") {
      targetUrl = readOption(args, index, arg);
      index++;
    } else if (arg.startsWith("--target=")) {
      targetUrl = arg.slice("--target=".length);
    } else if (arg === "--batch-size") {
      batchSize = Number(readOption(args, index, arg));
      index++;
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = Number(arg.slice("--batch-size=".length));
    } else if (arg === "--report") {
      reportPath = readOption(args, index, arg);
      index++;
    } else if (arg.startsWith("--report=")) {
      reportPath = arg.slice("--report=".length);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--confirm-v2-stopped") {
      confirmV2Stopped = true;
    } else if (arg === "--allow-unmigrated-legacy-data") {
      allowUnmigratedLegacyData = true;
    } else if (arg === "--help") {
      throw new Error(usage());
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!sourceUrl) {
    throw new Error("Missing --source or V2_DATABASE_URL");
  }
  if (!targetUrl) {
    throw new Error("Missing --target or V3_DATABASE_URL");
  }
  assertValidBatchSize(batchSize);
  if (!dryRun && !confirmV2Stopped) {
    throw new Error(
      "Refusing to migrate without --confirm-v2-stopped. Stop every v2 instance first.",
    );
  }

  assertPostgresUrl(sourceUrl, "source");
  assertPostgresUrl(targetUrl, "target");
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) {
    throw new Error("Source and target must be different PostgreSQL databases");
  }

  return {
    sourceUrl,
    targetUrl,
    dryRun,
    confirmV2Stopped,
    allowUnmigratedLegacyData,
    batchSize,
    reportPath,
  };
}

function assertPostgresUrl(value: string, name: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} URL is invalid`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${name} URL must use postgres:// or postgresql://`);
  }
}

function databaseIdentity(value: string): string {
  const url = new URL(value);
  return [
    url.hostname.toLowerCase(),
    url.port || "5432",
    decodeURIComponent(url.pathname),
  ].join(":");
}

function describeDatabase(value: string): string {
  const url = new URL(value);
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${url.hostname}${port}${url.pathname}`;
}

async function assertConnectedDatabasesDiffer(
  source: SqlClient,
  target: SqlClient,
): Promise<void> {
  type IdentityRow = {
    database_name: string;
    schema_name: string;
    server_address: string | null;
    server_port: number | null;
  };
  const identityQuery = `
    SELECT
      current_database() AS database_name,
      current_schema() AS schema_name,
      inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port
  `;
  const [sourceResult, targetResult] = await Promise.all([
    source.query<IdentityRow>(identityQuery),
    target.query<IdentityRow>(identityQuery),
  ]);
  const sourceIdentity = sourceResult.rows[0];
  const targetIdentity = targetResult.rows[0];
  if (
    sourceIdentity &&
    targetIdentity &&
    sourceIdentity.database_name === targetIdentity.database_name &&
    sourceIdentity.schema_name === targetIdentity.schema_name &&
    sourceIdentity.server_address === targetIdentity.server_address &&
    sourceIdentity.server_port === targetIdentity.server_port
  ) {
    throw new Error("Source and target connections resolve to the same database");
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }
  return value;
}

function updateChecksum(
  checksum: ReturnType<typeof createHash>,
  rows: Row[],
): void {
  for (const row of rows) {
    checksum.update(JSON.stringify(canonicalize(row)));
    checksum.update("\n");
  }
}

async function getTables(client: SqlClient): Promise<Set<string>> {
  const result = await client.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
  `);
  return new Set(result.rows.map((row) => row.tablename));
}

async function getColumns(client: SqlClient, table: string): Promise<Set<string>> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function assertStandardSourceSchema(source: SqlClient): Promise<void> {
  const result = await source.query<{ schema_name: string | null }>(`
    SELECT current_schema() AS schema_name
  `);
  const schema = result.rows[0]?.schema_name ?? "unknown";
  if (schema !== "public") {
    throw new UnsupportedSourceSchemaError(
      `Source database schema "${schema}" is non-standard. Automatic migration only supports the v2 "public" schema; this database requires a manual migration.`,
    );
  }
}

async function findCompletedMigration(
  target: SqlClient,
  options: MigrationOptions,
): Promise<MigrationReport | undefined> {
  const result = await target.query<{ relation_name: string }>(`
    SELECT c.relname AS relation_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
    ORDER BY c.relname
  `);
  if (result.rows.length === 0) return undefined;

  const relations = result.rows.map((row) => row.relation_name);
  if (relations.includes(MIGRATION_RECEIPT_TABLE)) {
    const receiptResult = await target.query<{ report: unknown }>(
      `SELECT report FROM ${MIGRATION_RECEIPT_TABLE} WHERE id = TRUE`,
    );
    const storedReport = receiptResult.rows[0]?.report;
    if (isMigrationReport(storedReport)) {
      if (
        storedReport.source !== options.sourceLabel ||
        storedReport.target !== options.targetLabel
      ) {
        throw new Error(
          "Target contains a completed migration receipt for different source or target labels",
        );
      }
      return {
        ...storedReport,
        recoveredFromReceipt: true,
        operatorGuidance:
          "The target receipt confirms this migration already committed. Do not run it again.",
        warnings: [
          ...storedReport.warnings,
          "A completed migration receipt was found; no data was copied.",
        ],
      };
    }
    throw new Error("Target contains an unreadable migration receipt");
  }

  throw new TargetNotEmptyError(
    `Target database is not empty. Found: ${relations.join(", ")}`,
  );
}

function isMigrationReport(value: unknown): value is MigrationReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<MigrationReport>;
  return (
    report.version === 2 &&
    report.status === "migration_completed" &&
    report.targetCommit === "confirmed" &&
    typeof report.source === "string" &&
    typeof report.target === "string" &&
    Array.isArray(report.warnings)
  );
}

async function storeMigrationReceipt(
  target: SqlClient,
  report: MigrationReport,
): Promise<void> {
  await target.query(`
    CREATE TABLE ${MIGRATION_RECEIPT_TABLE} (
      id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
      report JSONB NOT NULL
    )
  `);
  await target.query(
    `INSERT INTO ${MIGRATION_RECEIPT_TABLE} (id, report) VALUES (TRUE, $1::jsonb)`,
    [JSON.stringify(report)],
  );
}

async function inspectSource(source: SqlClient): Promise<{
  sourceMigrations: string[];
  zapColumnMode: MigrationReport["zapColumnMode"];
  zapExpression: string;
  legacyTables: Record<string, number>;
}> {
  const tables = await getTables(source);
  const requiredTables = ["pgmigrations", ...Object.keys(ACTIVE_TABLE_COLUMNS)];
  const missingTables = requiredTables.filter((table) => !tables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Source is missing required v2 tables: ${missingTables.join(", ")}`);
  }

  for (const [table, requiredColumns] of Object.entries(ACTIVE_TABLE_COLUMNS)) {
    const columns = await getColumns(source, table);
    const missingColumns = requiredColumns.filter((column) => !columns.has(column));
    if (missingColumns.length > 0) {
      throw new Error(
        `Source table ${table} is missing required columns: ${missingColumns.join(", ")}`,
      );
    }
  }

  const mintQuoteColumns = await getColumns(source, "mint_quotes");
  const hasTypoColumn = mintQuoteColumns.has("serialzed_zap_request");
  const hasCorrectColumn = mintQuoteColumns.has("serialized_zap_request");
  if (!hasTypoColumn && !hasCorrectColumn) {
    throw new Error(
      "Source mint_quotes has neither serialzed_zap_request nor serialized_zap_request",
    );
  }

  let zapColumnMode: MigrationReport["zapColumnMode"];
  let zapExpression: string;
  if (hasTypoColumn && hasCorrectColumn) {
    const conflicts = await source.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM mint_quotes
      WHERE serialzed_zap_request IS NOT NULL
        AND serialized_zap_request IS NOT NULL
        AND serialzed_zap_request <> serialized_zap_request
    `);
    if (Number(conflicts.rows[0]?.count ?? 0) > 0) {
      throw new Error(
        "Source has conflicting values in the two zap-request columns",
      );
    }
    zapColumnMode = "both";
    zapExpression =
      "COALESCE(serialized_zap_request, serialzed_zap_request) AS serialized_zap_request";
  } else if (hasCorrectColumn) {
    zapColumnMode = "correct";
    zapExpression = "serialized_zap_request";
  } else {
    zapColumnMode = "typo";
    zapExpression = "serialzed_zap_request AS serialized_zap_request";
  }

  const migrationResult = await source.query<{ name: string }>(`
    SELECT name FROM pgmigrations ORDER BY run_on, id
  `);

  const legacyTables: Record<string, number> = {};
  for (const table of LEGACY_TABLES) {
    if (!tables.has(table)) {
      legacyTables[table] = 0;
      continue;
    }
    const countResult = await source.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)}`,
    );
    legacyTables[table] = Number(countResult.rows[0]?.count ?? 0);
  }

  return {
    sourceMigrations: migrationResult.rows.map((row) => row.name),
    zapColumnMode,
    zapExpression,
    legacyTables,
  };
}

function createTablePlans(zapExpression: string): TablePlan[] {
  const bigintIdentity = `${quoteIdentifier("id")}::bigint AS ${quoteIdentifier("id")}`;

  return [
    {
      name: "l_users",
      keys: ACTIVE_TABLE_COLUMNS.l_users,
      select: [
        bigintIdentity,
        ...ACTIVE_TABLE_COLUMNS.l_users.slice(1).map(quoteIdentifier),
      ].join(", "),
      orderBy: quoteIdentifier("id"),
      identity: true,
    },
    {
      name: "mint_quotes",
      keys: [
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
      select: [
        bigintIdentity,
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
        zapExpression,
        "locked",
      ].join(", "),
      orderBy: quoteIdentifier("id"),
      identity: true,
    },
    {
      name: "mints",
      keys: ACTIVE_TABLE_COLUMNS.mints,
      select: ACTIVE_TABLE_COLUMNS.mints.map(quoteIdentifier).join(", "),
      orderBy: quoteIdentifier("mint_url"),
      identity: false,
    },
    {
      name: "proofs",
      keys: ACTIVE_TABLE_COLUMNS.proofs,
      select: [
        bigintIdentity,
        ...ACTIVE_TABLE_COLUMNS.proofs.slice(1).map(quoteIdentifier),
      ].join(", "),
      orderBy: quoteIdentifier("id"),
      identity: true,
    },
  ];
}

async function insertRows(
  target: SqlClient,
  plan: TablePlan,
  rows: Row[],
): Promise<void> {
  if (rows.length === 0) return;

  const values: unknown[] = [];
  let parameterIndex = 1;
  const valueGroups = rows.map((row) => {
    const placeholders = plan.keys.map((key) => {
      values.push(row[key] ?? null);
      return `$${parameterIndex++}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  await target.query(
    `INSERT INTO ${quoteIdentifier(plan.name)} (${plan.keys
      .map(quoteIdentifier)
      .join(", ")}) VALUES ${valueGroups.join(", ")}`,
    values,
  );
}

async function scanTable(
  client: SqlClient,
  plan: TablePlan,
  batchSize: number,
  onRows?: (rows: Row[]) => Promise<void>,
): Promise<{ rows: number; checksum: string }> {
  const checksum = createHash("sha256");
  let rowCount = 0;
  const cursorName = quoteIdentifier(`migration_${plan.name}_scan`);

  await client.query(
    `DECLARE ${cursorName} NO SCROLL CURSOR FOR
     SELECT ${plan.select}
     FROM ${quoteIdentifier(plan.name)}
     ORDER BY ${plan.orderBy}`,
  );

  while (true) {
    const result = await client.query<Row>(
      `FETCH FORWARD ${batchSize} FROM ${cursorName}`,
    );
    const rows = result.rows as Row[];
    updateChecksum(checksum, rows);
    if (onRows) {
      await onRows(rows);
    }
    rowCount += rows.length;
    if (rows.length < batchSize) break;
  }

  await client.query(`CLOSE ${cursorName}`);

  return { rows: rowCount, checksum: checksum.digest("hex") };
}

async function resetIdentity(target: SqlClient, table: string): Promise<void> {
  await target.query(
    `SELECT setval(
       pg_get_serial_sequence($1, 'id'),
       COALESCE(MAX(id), 1),
       COUNT(*) > 0
     )
     FROM ${quoteIdentifier(table)}`,
    [table],
  );
}

async function rollbackQuietly(client: SqlClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {}
}

export async function migrateV2PostgresToV3(
  source: SqlClient,
  target: SqlClient,
  options: MigrationOptions,
  commitVerifier?: SqlClient,
): Promise<MigrationReport> {
  assertValidBatchSize(options.batchSize);
  if (!options.dryRun && !options.confirmV2Stopped) {
    throw new Error("All v2 writers must be stopped before migration");
  }

  const startedAt = new Date().toISOString();
  try {
    await assertStandardSourceSchema(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unsupportedSchema = error instanceof UnsupportedSourceSchemaError;
    throw new MigrationExecutionError(
      message,
      {
        version: 2,
        startedAt,
        completedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        source: options.sourceLabel,
        target: options.targetLabel,
        status: "failed_before_target_commit",
        targetCommit: "not_attempted",
        retrySafe: !unsupportedSchema,
        operatorGuidance: unsupportedSchema
          ? "This source uses an unsupported schema and requires a manual migration. Do not retry automatic migration with this source."
          : "The target was not modified. Restore source database connectivity and retry.",
        error: message,
      },
      error instanceof Error ? { cause: error } : undefined,
    );
  }
  let completedMigration: MigrationReport | undefined;
  try {
    completedMigration = await findCompletedMigration(target, options);
  } catch (error) {
    if (error instanceof TargetNotEmptyError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new MigrationExecutionError(
      message,
      {
        version: 2,
        startedAt,
        completedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        source: options.sourceLabel,
        target: options.targetLabel,
        status: "target_commit_unknown",
        targetCommit: "unknown",
        retrySafe: false,
        operatorGuidance:
          "The target receipt could not be verified. Do not retry until the target database can be inspected successfully.",
        error: message,
      },
      error instanceof Error ? { cause: error } : undefined,
    );
  }
  if (completedMigration) return completedMigration;

  let sourceTransaction = false;
  let targetTransaction = false;
  let targetCommit: MigrationFailureReport["targetCommit"] = "not_attempted";
  try {
    await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransaction = true;

    const sourceInfo = await inspectSource(source);
    const populatedLegacyTables = Object.entries(sourceInfo.legacyTables).filter(
      ([, count]) => count > 0,
    );
    if (
      populatedLegacyTables.length > 0 &&
      !options.allowUnmigratedLegacyData &&
      !options.dryRun
    ) {
      throw new Error(
        `Source contains v1-only data that v3 cannot use: ${populatedLegacyTables
          .map(([table, count]) => `${table}=${count}`)
          .join(", ")}. Re-run only after reviewing it, with --allow-unmigrated-legacy-data.`,
      );
    }

    const plans = createTablePlans(sourceInfo.zapExpression);
    const tables: Record<string, TableResult> = {};

    if (options.dryRun) {
      for (const plan of plans) {
        const sourceResult = await scanTable(source, plan, options.batchSize);
        tables[plan.name] = {
          rows: sourceResult.rows,
          sourceChecksum: sourceResult.checksum,
        };
      }
      await source.query("ROLLBACK");
      sourceTransaction = false;
      return createReport(startedAt, options, sourceInfo, tables);
    }

    await target.query("BEGIN");
    targetTransaction = true;
    await runMigrations(new ClientDatabaseAdapter(target));

    for (const plan of plans) {
      const sourceResult = await scanTable(
        source,
        plan,
        options.batchSize,
        async (rows) => insertRows(target, plan, rows),
      );
      const targetPlan = {
        ...plan,
        select: plan.keys.map(quoteIdentifier).join(", "),
      };
      const targetResult = await scanTable(target, targetPlan, options.batchSize);
      if (
        sourceResult.rows !== targetResult.rows ||
        sourceResult.checksum !== targetResult.checksum
      ) {
        throw new Error(`Validation failed after copying ${plan.name}`);
      }
      tables[plan.name] = {
        rows: sourceResult.rows,
        sourceChecksum: sourceResult.checksum,
        targetChecksum: targetResult.checksum,
      };
    }

    for (const plan of plans.filter((plan) => plan.identity)) {
      await resetIdentity(target, plan.name);
    }

    const report = createReport(startedAt, options, sourceInfo, tables);
    await storeMigrationReceipt(target, report);
    await source.query("ROLLBACK");
    sourceTransaction = false;
    targetCommit = "unknown";
    await target.query("COMMIT");
    targetTransaction = false;

    return report;
  } catch (error) {
    if (targetTransaction && targetCommit === "not_attempted") {
      await rollbackQuietly(target);
    }
    if (sourceTransaction) await rollbackQuietly(source);
    const message = error instanceof Error ? error.message : String(error);
    const commitUnknown = targetCommit === "unknown";
    if (commitUnknown && commitVerifier) {
      try {
        const completed = await findCompletedMigration(commitVerifier, options);
        if (completed) {
          return {
            ...completed,
            warnings: [
              ...completed.warnings,
              "The target committed, but the original connection did not acknowledge COMMIT.",
            ],
          };
        }
      } catch {}
    }
    throw new MigrationExecutionError(
      message,
      {
        version: 2,
        startedAt,
        completedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        source: options.sourceLabel,
        target: options.targetLabel,
        status: commitUnknown
          ? "target_commit_unknown"
          : "failed_before_target_commit",
        targetCommit,
        retrySafe: !commitUnknown,
        operatorGuidance: commitUnknown
          ? "Do not retry until the target database has been inspected for a completed migration."
          : "The target was not committed. It is safe to retry after correcting the reported error.",
        error: message,
      },
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}

function createReport(
  startedAt: string,
  options: MigrationOptions,
  sourceInfo: Awaited<ReturnType<typeof inspectSource>>,
  tables: Record<string, TableResult>,
): MigrationReport {
  const warnings: string[] = [];
  const populatedLegacyTables = Object.entries(sourceInfo.legacyTables).filter(
    ([, count]) => count > 0,
  );
  if (populatedLegacyTables.length > 0) {
    warnings.push(
      `Legacy tables were not copied: ${populatedLegacyTables
        .map(([table, count]) => `${table}=${count}`)
        .join(", ")}`,
    );
  }
  if (options.dryRun) {
    warnings.push("Dry run only; the target database was not modified");
  }

  return {
    version: 2,
    startedAt,
    completedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    source: options.sourceLabel,
    target: options.targetLabel,
    status: options.dryRun ? "dry_run_completed" : "migration_completed",
    targetCommit: options.dryRun ? "not_attempted" : "confirmed",
    retrySafe: options.dryRun,
    recoveredFromReceipt: false,
    operatorGuidance: options.dryRun
      ? "The target was not modified. A migration can be run after reviewing this report."
      : "The target commit completed. Do not run the migration again against this target.",
    sourceMigrations: sourceInfo.sourceMigrations,
    zapColumnMode: sourceInfo.zapColumnMode,
    tables,
    legacyTables: sourceInfo.legacyTables,
    warnings,
  };
}

export async function persistMigrationReport(
  report: MigrationOutcomeReport,
  path: string,
  writer: MigrationReportWriter = async (outputPath, contents) => {
    await Bun.write(outputPath, contents);
  },
): Promise<string | undefined> {
  try {
    await writer(path, `${JSON.stringify(report, null, 2)}\n`);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (report.targetCommit === "confirmed") {
      return `Migration completed and the target commit is confirmed, but the report could not be written to ${path}: ${message}`;
    }
    return `The migration report could not be written to ${path}: ${message}`;
  }
}

async function outputMigrationReport(
  report: MigrationOutcomeReport,
  reportPath?: string,
): Promise<void> {
  console.log(JSON.stringify(report, null, 2));
  if (!reportPath) return;
  const warning = await persistMigrationReport(report, reportPath);
  if (warning) console.error(`WARNING: ${warning}`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log(usage());
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const source = new Client({ connectionString: options.sourceUrl });
  const target = new Client({ connectionString: options.targetUrl });
  const commitVerifier = new Client({ connectionString: options.targetUrl });

  try {
    await Promise.all([
      source.connect(),
      target.connect(),
      commitVerifier.connect(),
    ]);
    await assertConnectedDatabasesDiffer(source, target);
    try {
      const report = await migrateV2PostgresToV3(
        source,
        target,
        {
          dryRun: options.dryRun,
          confirmV2Stopped: options.confirmV2Stopped,
          allowUnmigratedLegacyData: options.allowUnmigratedLegacyData,
          batchSize: options.batchSize,
          sourceLabel: describeDatabase(options.sourceUrl),
          targetLabel: describeDatabase(options.targetUrl),
        },
        commitVerifier,
      );
      await outputMigrationReport(report, options.reportPath);
    } catch (error) {
      if (!(error instanceof MigrationExecutionError)) throw error;
      await outputMigrationReport(error.report, options.reportPath);
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled([
      source.end(),
      target.end(),
      commitVerifier.end(),
    ]);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
