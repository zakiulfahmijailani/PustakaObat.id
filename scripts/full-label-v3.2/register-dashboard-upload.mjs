import path from "node:path";
import { Client } from "pg";
import {
  assertTestConnection,
  loadEnvFile,
  parseArgs,
  readPackage,
  shardNumberFromName,
  verifyManifestFile,
} from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.package || !args.env || !args["expected-host"] || args.apply !== "YES") {
  throw new Error(
    "Usage: npm run full-label:storage:register-dashboard -- --package <workbench_export> --env <file> --expected-host <test.neon.tech> --bucket <bucket> --apply YES",
  );
}

const packageDir = path.resolve(args.package);
const { manifest, manifestSha256 } = await readPackage(packageDir);
const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);

const bucket = args.bucket || env.PUSTAKAOBAT_OBJECT_BUCKET;
if (!bucket) throw new Error("--bucket or PUSTAKAOBAT_OBJECT_BUCKET is required");

const shardItems = manifest.files
  .filter((item) => item.path.startsWith("object_storage_payload/"))
  .map((item) => ({
    ...item,
    shardNumber: shardNumberFromName(path.basename(item.path)),
    sourceFileName: path.basename(item.path),
  }))
  .sort((left, right) => left.shardNumber - right.shardNumber);

if (shardItems.length !== 16) {
  throw new Error(`Expected 16 shard files in the package, found ${shardItems.length}`);
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  const schema = await client.query(`
    select
      to_regclass('public.pb_fl32_object_shards') as object_shards,
      to_regclass('public.pb_fl32_label_documents') as label_documents
  `);
  if (!schema.rows[0]?.object_shards || !schema.rows[0]?.label_documents) {
    throw new Error("Full-label v3.2 schema is not installed on the target database");
  }

  for (const item of shardItems) {
    const verifiedFile = await verifyManifestFile(packageDir, item);
    const result = await client.query(
      `update public.pb_fl32_object_shards
       set object_key=$2,
           storage_status='uploaded',
           storage_etag=null,
           uploaded_at=coalesce(uploaded_at, now()),
           verified_at=null,
           last_error=null,
           updated_at=now()
       where shard_number=$1
         and source_file_name=$3
         and source_sha256=$4
         and compressed_size_bytes=$5
       returning shard_number, source_file_name, object_key, storage_status`,
      [item.shardNumber, item.sourceFileName, item.sourceFileName, verifiedFile.sha256, verifiedFile.sizeBytes],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Shard ${item.shardNumber} did not match imported metadata`);
    }
  }

  const counts = await client.query(`
    select
      count(*)::int as total_shards,
      count(*) filter (where storage_status='uploaded')::int as uploaded_shards,
      count(*) filter (where storage_status='verified')::int as verified_shards,
      count(*) filter (where storage_status='pending')::int as pending_shards,
      count(*) filter (where storage_status='failed')::int as failed_shards,
      count(*) filter (where object_key = source_file_name)::int as root_key_shards
    from public.pb_fl32_object_shards
  `);
  // The deployed database keeps publication policy on label_documents. The
  // section manifest is only a shard/count pointer in that schema, so its
  // policy columns may legitimately be absent. Detect this instead of making
  // registration fail on a harmless schema difference.
  const manifestColumns = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema='public'
      and table_name='pb_fl32_label_section_manifests'
  `);
  const manifestColumnNames = new Set(
    manifestColumns.rows.map((row) => row.column_name),
  );
  const manifestPolicyPresent = [
    "editorial_status",
    "public_status",
    "publication_eligible",
  ].every((column) => manifestColumnNames.has(column));
  const safety = await client.query(`
    select
      (select count(*) from public.pb_fl32_label_documents
       where editorial_status <> 'source_only'
          or public_status <> 'hidden'
          or publication_eligible) as unsafe_documents,
      ${manifestPolicyPresent
        ? `(select count(*) from public.pb_fl32_label_section_manifests
             where editorial_status <> 'source_only'
                or public_status <> 'hidden'
                or publication_eligible)`
        : "0"} as unsafe_manifests
  `);

  if (Number(counts.rows[0].uploaded_shards) !== 16 || Number(counts.rows[0].failed_shards) !== 0) {
    throw new Error(`Unexpected shard status after registration: ${JSON.stringify(counts.rows[0])}`);
  }
  if (Number(safety.rows[0].unsafe_documents) !== 0 || Number(safety.rows[0].unsafe_manifests) !== 0) {
    throw new Error(`Publication safety check failed: ${JSON.stringify(safety.rows[0])}`);
  }

  await client.query("commit");
  console.log(JSON.stringify({
    status: "dashboard_upload_registered",
    bucket,
    manifest_sha256: manifestSha256,
    shard_object_keys: shardItems.map((item) => item.sourceFileName),
    counts: counts.rows[0],
    safety: {
      ...safety.rows[0],
      manifest_policy_columns_present: manifestPolicyPresent,
    },
    publication: { editorial_status: "source_only", public_status: "hidden", publication_eligible: false },
  }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
