import path from "node:path";
import { Client } from "pg";
import {
  assertTestConnection,
  loadEnvFile,
  parseArgs,
  readPackage,
} from "./common.mjs";

const TABLES = {
  label_documents: "pb_fl32_label_documents",
  label_identity_candidates: "pb_fl32_label_identity_candidates",
  drug_label_candidates: "pb_fl32_drug_label_candidates",
  identity_review_queue: "pb_fl32_identity_review_queue",
  label_section_manifests: "pb_fl32_label_section_manifests",
};

const args = parseArgs(process.argv.slice(2));
if (!args.package || !args.env || !args["expected-host"]) {
  throw new Error("Usage: npm run full-label:verify -- --package <workbench_export> --env <file> --expected-host <test.neon.tech>");
}

const packageDir = path.resolve(args.package);
const { manifest, manifestSha256 } = await readPackage(packageDir);
const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);
const client = new Client({ connectionString });

await client.connect();
try {
  const counts = [];
  for (const [name, table] of Object.entries(TABLES)) {
    const result = await client.query(`select count(*)::bigint as count from ${table}`);
    const actual = Number(result.rows[0].count);
    const expected = Number(manifest.record_counts[name]);
    counts.push({ name, table, expected, actual, match: expected === actual });
  }

  const safety = await client.query(`
    select
      (select count(*) from pb_fl32_label_documents
        where editorial_status<>'source_only' or public_status<>'hidden' or publication_eligible)::int as unsafe_documents,
      (select count(*) from pb_fl32_label_identity_candidates
        where editorial_status<>'source_only' or public_status<>'hidden' or publication_eligible)::int as unsafe_identity,
      (select count(*) from pb_fl32_drug_label_candidates
        where editorial_status<>'source_only' or public_status<>'hidden' or publication_eligible or not identity_match_safe)::int as unsafe_ranked_candidates,
      0::int as unsafe_manifests
  `);

  const amoxicillin = await client.query(`
    select
      count(*)::int as candidates,
      count(*) filter (
        where d.ingredient_count<>1 or lower(d.ingredient_fingerprint) like '%clavulan%'
      )::int as contaminated
    from pb_fl32_drug_label_candidates c
    join pb_fl32_label_documents d using (label_id)
    where c.drug_id='RXCUI:723'
  `);

  const storage = await client.query(`
    select
      count(*)::int as labels,
      count(o.label_id) filter (where o.storage_status='verified')::int as verified_labels,
      count(o.label_id) filter (where o.storage_status='failed')::int as failed_labels
    from pb_fl32_label_section_manifests m
    left join pb_fl32_label_objects o using (label_id)
  `);

  const importRun = await client.query(
    `select status, attempt_count, completed_at, last_error from pb_fl32_import_runs where manifest_sha256=$1`,
    [manifestSha256],
  );
  const metadataPassed = counts.every((entry) => entry.match)
    && Object.values(safety.rows[0]).every((value) => Number(value) === 0)
    && Number(amoxicillin.rows[0].contaminated) === 0
    && importRun.rows[0]?.status === "completed";
  const objectStorageReady = Number(storage.rows[0].labels) === Number(manifest.record_counts.label_section_manifests)
    && Number(storage.rows[0].verified_labels) === Number(storage.rows[0].labels)
    && Number(storage.rows[0].failed_labels) === 0;

  console.table(counts);
  console.log(JSON.stringify({
    metadata_passed: metadataPassed,
    object_storage_ready: objectStorageReady,
    safety: safety.rows[0],
    amoxicillin: amoxicillin.rows[0],
    storage: storage.rows[0],
    import_run: importRun.rows[0] || null,
    public_publishable: false,
  }, null, 2));
  if (!metadataPassed) process.exitCode = 2;
} finally {
  await client.end();
}
