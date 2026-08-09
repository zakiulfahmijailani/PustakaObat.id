import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { assertTestConnection, loadEnvFile, parseArgs } from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.package || !args.env || !args["expected-host"] || args.apply !== "YES") {
  throw new Error("Usage: node register-indonesian-translation-overlay.mjs --package <overlay_package> --env <file> --expected-host <neon-host> --apply YES");
}

const packageDir = path.resolve(args.package);
const manifestText = await readFile(path.join(packageDir, "translation_overlay_manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);
if (
  manifest.schema_version !== "1.0" ||
  manifest.source_text_count !== 1799383 ||
  !Number.isInteger(manifest.translation_count) || manifest.translation_count <= 0 ||
  !Number.isInteger(manifest.empty_translation_count) || manifest.empty_translation_count < 0 ||
  manifest.editorial_status !== "ai_translated" ||
  manifest.public_status !== "hidden" ||
  manifest.publication_eligible !== false ||
  ![2, 3, 4].includes(manifest.prefix_length) ||
  !Array.isArray(manifest.shards) || manifest.shards.length !== 16 ** manifest.prefix_length
) throw new Error("Unsafe or incompatible translation overlay manifest");

const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);

const client = new Client({ connectionString });
const manifestSha256 = createHash("sha256").update(manifestText).digest("hex");
const importId = manifest.import_id || randomUUID();
const objectPrefix = `pustakaobat/full-label/v3.2/translations/${manifestSha256}`;

await client.connect();
try {
  const schema = await client.query("select to_regclass('public.pb_fl32_translation_imports') as overlay_table");
  if (!schema.rows[0]?.overlay_table) throw new Error("Translation overlay schema is missing; run full-label:migrate first");
  await client.query(
    `insert into public.pb_fl32_translation_imports
      (import_id, pipeline_version, checkpoint_sha256, source_text_count, translation_count, empty_translation_count, translated_source_characters,
       prefix_length, object_prefix, manifest_sha256, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'verified')
     on conflict (checkpoint_sha256) do update set
       pipeline_version=excluded.pipeline_version, source_text_count=excluded.source_text_count,
       translation_count=excluded.translation_count, empty_translation_count=excluded.empty_translation_count,
       translated_source_characters=excluded.translated_source_characters, prefix_length=excluded.prefix_length,
       object_prefix=excluded.object_prefix, manifest_sha256=excluded.manifest_sha256,
       status='verified', verified_at=now(), last_error=null, updated_at=now()`,
    [importId, manifest.pipeline_version, manifest.checkpoint_sha256, manifest.source_text_count,
      manifest.translation_count, manifest.empty_translation_count, manifest.translated_source_characters,
      manifest.prefix_length, objectPrefix, manifestSha256],
  );
  console.log(JSON.stringify({ status: "translation_overlay_registered", import_id: importId, object_prefix: objectPrefix, public_publishable: false }, null, 2));
} finally {
  await client.end();
}
