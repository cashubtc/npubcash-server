import { Client } from "pg";
import { migrateV2PostgresToV3 } from "./migrate-v2-postgres";

const rowCounts = [25_000, 50_000, 100_000];
const repetitions = 3;
const batchSize = 500;

interface BenchmarkResult {
  rows: number;
  medianMs: number;
  microsecondsPerRow: number;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function createV2Fixture(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE pgmigrations (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      run_on TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE l_users (
      id BIGINT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      pubkey TEXT NOT NULL,
      name TEXT,
      mint_url TEXT,
      lock_quote BOOLEAN
    );
    CREATE TABLE mint_quotes (
      id BIGINT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      unit TEXT NOT NULL,
      mint_url TEXT NOT NULL,
      payment_request TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      amount INTEGER NOT NULL,
      pubkey TEXT NOT NULL,
      state TEXT NOT NULL,
      paid_at TIMESTAMPTZ,
      serialized_zap_request TEXT,
      locked BOOLEAN NOT NULL
    );
    CREATE TABLE mints (
      mint_url TEXT PRIMARY KEY,
      last_checked TIMESTAMPTZ NOT NULL,
      mint_info JSONB NOT NULL
    );
    CREATE TABLE proofs (
      id BIGINT PRIMARY KEY,
      amount INTEGER NOT NULL,
      keyset_id TEXT NOT NULL,
      secret TEXT NOT NULL,
      "C" TEXT NOT NULL,
      state TEXT NOT NULL
    );
  `);
}

async function assertEmptyPublicSchema(client: Client): Promise<void> {
  const result = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
  `);
  if (result.rows[0]?.count !== "0") {
    throw new Error(
      "MIGRATION_BENCH_DATABASE_URL must name a database with an empty public schema",
    );
  }
}

async function replaceProofFixture(
  client: Client,
  rows: number,
): Promise<void> {
  await client.query("TRUNCATE proofs");
  await client.query(
    `INSERT INTO proofs (id, amount, keyset_id, secret, "C", state)
     SELECT id, 1, 'keyset', 'secret-' || id, 'c-' || id, 'UNSPENT'
     FROM generate_series(1, $1::integer) AS id`,
    [rows],
  );
}

async function runBenchmark(databaseUrl: string): Promise<BenchmarkResult[]> {
  const suffix = `${process.pid}_${Date.now()}`;
  const sourceSchema = "public";
  const targetSchema = `migration_cursor_bench_target_${suffix}`;
  const source = new Client({ connectionString: databaseUrl });
  const target = new Client({ connectionString: databaseUrl });
  let ownsSourceFixture = false;

  await Promise.all([source.connect(), target.connect()]);
  try {
    await assertEmptyPublicSchema(source);
    ownsSourceFixture = true;
    await source.query(`CREATE SCHEMA ${quoteIdentifier(targetSchema)}`);
    await source.query(`SET search_path TO ${quoteIdentifier(sourceSchema)}`);
    await target.query(`SET search_path TO ${quoteIdentifier(targetSchema)}`);
    await createV2Fixture(source);

    const results: BenchmarkResult[] = [];
    for (const rows of rowCounts) {
      await replaceProofFixture(source, rows);
      const samples: number[] = [];
      for (let run = 0; run < repetitions; run++) {
        const startedAt = performance.now();
        const report = await migrateV2PostgresToV3(source, target, {
          dryRun: true,
          confirmV2Stopped: false,
          allowUnmigratedLegacyData: false,
          batchSize,
          sourceLabel: sourceSchema,
          targetLabel: targetSchema,
        });
        samples.push(performance.now() - startedAt);
        if (report.tables.proofs.rows !== rows) {
          throw new Error(
            `Expected ${rows} proofs, scanned ${report.tables.proofs.rows}`,
          );
        }
      }
      const medianMs = median(samples);
      results.push({
        rows,
        medianMs,
        microsecondsPerRow: (medianMs * 1000) / rows,
      });
    }
    return results;
  } finally {
    await Promise.allSettled([
      source.query("RESET search_path"),
      target.query("RESET search_path"),
    ]);
    if (ownsSourceFixture) {
      await source.query(
        "DROP TABLE IF EXISTS proofs, mints, mint_quotes, l_users, pgmigrations CASCADE",
      );
    }
    await Promise.allSettled([
      source.query(
        `DROP SCHEMA IF EXISTS ${quoteIdentifier(targetSchema)} CASCADE`,
      ),
    ]);
    await Promise.allSettled([source.end(), target.end()]);
  }
}

function assertApproximatelyLinear(results: BenchmarkResult[]): void {
  for (let index = 1; index < results.length; index++) {
    const previous = results[index - 1];
    const current = results[index];
    const rowGrowth = current.rows / previous.rows;
    const timeGrowth = current.medianMs / previous.medianMs;
    if (timeGrowth > rowGrowth * 1.75) {
      throw new Error(
        `Scan time grew ${timeGrowth.toFixed(2)}x while rows grew ${rowGrowth.toFixed(2)}x`,
      );
    }
  }
}

if (import.meta.main) {
  const databaseUrl = process.env.MIGRATION_BENCH_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Set MIGRATION_BENCH_DATABASE_URL to a disposable PostgreSQL database",
    );
  }
  const results = await runBenchmark(databaseUrl);
  console.table(results);
  assertApproximatelyLinear(results);
}
