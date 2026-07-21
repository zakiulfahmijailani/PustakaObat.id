import { Client } from "pg";
import { assertTestConnection, loadEnvFile, parseArgs } from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.env || !args["expected-host"]) {
  throw new Error("Usage: node inspect-storage.mjs --env <file> --expected-host <host>");
}

const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);

const client = new Client({ connectionString });
await client.connect();
try {
  const tables = await client.query(`
    select relname,
      pg_size_pretty(pg_total_relation_size(relid)) as total,
      pg_total_relation_size(relid)::bigint as bytes
    from pg_stat_user_tables
    where relname like 'pb_fl32_%'
    order by bytes desc
  `);
  const database = await client.query(`
    select pg_size_pretty(pg_database_size(current_database())) as size,
      pg_database_size(current_database())::bigint as bytes
  `);
  console.table(tables.rows);
  console.log(database.rows[0]);
} finally {
  await client.end();
}
