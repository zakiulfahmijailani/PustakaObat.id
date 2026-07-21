import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import { Client } from "pg";
import {
  assertSafeRow,
  assertTestConnection,
  buildUpsert,
  loadEnvFile,
  parseArgs,
  readPackage,
  shardNumberFromName,
  verifyManifestFile,
} from "./common.mjs";

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function displayNames(record) {
  return [...new Set([
    ...parseArray(record.generic_names_json),
    ...parseArray(record.brand_names_json),
    ...parseArray(record.substance_names_json),
  ].filter(Boolean))];
}

const CONFIGS = {
  label_documents: {
    table: "pb_fl32_label_documents",
    keys: ["label_id"],
    onConflict: "nothing",
    transform(record) {
      return {
        label_id: record.label_id,
        spl_document_id: record.spl_document_id,
        spl_set_id: record.spl_set_id,
        effective_time: record.effective_time,
        display_names: JSON.stringify(displayNames(record)),
        ingredient_count: record.ingredient_count,
        ingredient_fingerprint: record.ingredient_fingerprint,
        is_latest_set_version: record.is_latest_set_version,
        is_human_label: record.is_human_label,
        editorial_status: record.editorial_status,
        public_status: record.public_status,
        publication_eligible: record.publication_eligible,
      };
    },
  },
  drug_label_candidates: {
    table: "pb_fl32_drug_label_candidates",
    keys: ["candidate_id"],
    onConflict: "nothing",
    transform(record) {
      return {
        candidate_id: record.candidate_id,
        drug_id: record.drug_id,
        rxcui: record.rxcui,
        preferred_name: record.preferred_name,
        label_id: record.label_id,
        match_method: record.match_method,
        identity_confidence: record.identity_confidence,
        identity_match_safe: record.identity_match_safe,
        requires_manual_review: record.requires_manual_review,
        ranking_score: record.ranking_score,
        candidate_rank: record.candidate_rank,
        editorial_status: record.editorial_status,
        public_status: record.public_status,
        publication_eligible: record.publication_eligible,
      };
    },
  },
  label_section_manifests: {
    table: "pb_fl32_label_section_manifests",
    keys: ["label_id"],
    onConflict: "nothing",
    transform(record) {
      return {
        label_id: record.label_id,
        section_count: record.section_count,
        clinical_section_count: record.clinical_section_count,
        consumer_otc_section_count: record.consumer_otc_section_count,
        total_source_characters: record.total_source_characters,
        object_shard: record.object_shard,
      };
    },
  },
};

const args = parseArgs(process.argv.slice(2));
if (!args.package || !args.env || !args["expected-host"] || args.apply !== "YES") {
  throw new Error(
    "Usage: npm run full-label:import -- --package <workbench_export> --env <file> --expected-host <test.neon.tech> --apply YES",
  );
}

const packageDir = path.resolve(args.package);
const { manifest, manifestSha256 } = await readPackage(packageDir);
const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);
const batchSize = Math.min(250, Math.max(10, Number(args["batch-size"] || 100)));
const client = new Client({ connectionString });

await client.connect();
try {
  await client.query(
    `insert into pb_fl32_import_runs
      (manifest_sha256, package_version, manifest_json, status, attempt_count, started_at, completed_at, last_error)
     values ($1, $2, $3::jsonb, 'running', 1, now(), null, null)
     on conflict (manifest_sha256) do update set
       status='running', attempt_count=pb_fl32_import_runs.attempt_count+1,
       started_at=now(), completed_at=null, last_error=null`,
    [manifestSha256, manifest.package_version, JSON.stringify(manifest)],
  );

  const objectFiles = manifest.files.filter((item) => item.path.startsWith("object_storage_payload/"));
  for (const item of objectFiles) {
    const shardNumber = shardNumberFromName(item.path);
    const sourceFileName = path.basename(item.path);
    const objectKey = `pustakaobat/full-label/v3.2/source-shards/${sourceFileName}`;
    await client.query(
      `insert into pb_fl32_object_shards
        (shard_number, source_file_name, source_sha256, compressed_size_bytes, object_key)
       values ($1,$2,$3,$4,$5)
       on conflict (shard_number) do update set
         source_file_name=excluded.source_file_name,
         compressed_size_bytes=excluded.compressed_size_bytes,
         object_key=excluded.object_key,
         storage_status=case
           when pb_fl32_object_shards.source_sha256=excluded.source_sha256
             then pb_fl32_object_shards.storage_status
           else 'pending'
         end,
         source_sha256=excluded.source_sha256,
         updated_at=now()`,
      [shardNumber, sourceFileName, item.sha256, item.size_bytes, objectKey],
    );
  }

  const orderedFiles = [
    "label_documents",
    "drug_label_candidates",
    "label_section_manifests",
  ];

  for (const exportName of orderedFiles) {
    const config = CONFIGS[exportName];
    const item = manifest.files.find((entry) => entry.path === `neon_metadata/${exportName}.jsonl.gz`);
    if (!item) throw new Error(`Manifest file missing for ${exportName}`);
    const verified = await verifyManifestFile(packageDir, item);
    const lines = createInterface({
      input: createReadStream(verified.filePath).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
    let sourceRows = 0;
    let batch = [];

    const flush = async () => {
      if (!batch.length) return;
      const { sql, values } = buildUpsert(config, batch);
      await client.query(sql, values);
      batch = [];
    };

    for await (const line of lines) {
      if (!line) continue;
      sourceRows += 1;
      const record = JSON.parse(line);
      assertSafeRow(record, item.path, sourceRows);
      batch.push(config.transform(record));
      if (batch.length >= batchSize) await flush();
      if (sourceRows % 25000 === 0) {
        console.log(JSON.stringify({ table: config.table, processed: sourceRows, expected: manifest.record_counts[exportName] }));
      }
    }
    await flush();
    const expected = manifest.record_counts[exportName];
    if (sourceRows !== expected) throw new Error(`${item.path}: expected ${expected}, processed ${sourceRows}`);
    console.log(JSON.stringify({ table: config.table, processed: sourceRows, expected, status: "complete" }));
  }

  await client.query(
    `update pb_fl32_import_runs set status='completed', completed_at=now(), last_error=null where manifest_sha256=$1`,
    [manifestSha256],
  );
  console.log(JSON.stringify({ status: "metadata_import_complete", package_version: manifest.package_version, manifest_sha256: manifestSha256 }));
} catch (error) {
  await client.query(
    `update pb_fl32_import_runs set status='failed', last_error=$2 where manifest_sha256=$1`,
    [manifestSha256, String(error?.message || error)],
  ).catch(() => {});
  throw error;
} finally {
  await client.end();
}
