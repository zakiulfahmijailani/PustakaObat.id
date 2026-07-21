import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";
import { assertTestConnection, loadEnvFile, parseArgs } from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.env || !args["expected-host"] || args.apply !== "YES") {
  throw new Error("Usage: npm run full-label:migrate -- --env <file> --expected-host <test.neon.tech> --apply YES");
}

const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
const target = assertTestConnection(connectionString, args["expected-host"]);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationDir = path.resolve(scriptDir, "..", "..", "database", "migrations");
const migrations = [
  "013_full_label_staging_v3_2_compact.sql",
  "014_full_label_staging_v3_2_sparse_storage.sql",
  "015_full_label_staging_v3_2_compact_objects.sql",
];
const client = new Client({ connectionString });

await client.connect();
try {
  await client.query("begin");
  await client.query(`create table if not exists pb_fl32_schema_migrations (
    migration_name text primary key,
    applied_at timestamptz not null default now()
  )`);
  for (const migrationName of migrations) {
    const seen = await client.query(
      "select 1 from pb_fl32_schema_migrations where migration_name=$1",
      [migrationName],
    );
    if (seen.rowCount) continue;
    const sql = await readFile(path.join(migrationDir, migrationName), "utf8");
    await client.query(sql);
    await client.query(
      "insert into pb_fl32_schema_migrations (migration_name) values ($1)",
      [migrationName],
    );
  }
  await client.query("commit");
  const result = await client.query(`
    select count(*)::int as count
    from information_schema.tables
    where table_schema='public' and table_name like 'pb_fl32_%'
  `);
  console.log(JSON.stringify({
    status: "schema_applied",
    host: target.hostname,
    database: target.pathname.slice(1),
    full_label_tables: result.rows[0].count,
  }));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
