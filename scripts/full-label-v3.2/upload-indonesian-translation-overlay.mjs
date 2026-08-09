import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { Client } from "pg";
import { assertTestConnection, loadEnvFile, parseArgs, sha256File } from "./common.mjs";
import { createObjectClient } from "./object-client.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.package || !args.env || !args["expected-host"] || args.apply !== "YES") {
  throw new Error("Usage: npm run full-label:translations:upload -- --package <overlay_package> --env <file> --expected-host <test.neon.tech> [--start 0 --end 1024 --finalize YES] --apply YES");
}

const packageDir = path.resolve(args.package);
const manifestPath = path.join(packageDir, "translation_overlay_manifest.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);
if (
  manifest.schema_version !== "1.0" ||
  manifest.source_text_count !== 1799383 ||
  !Number.isInteger(manifest.translation_count) || manifest.translation_count <= 0 ||
  !Number.isInteger(manifest.empty_translation_count) || manifest.empty_translation_count < 0 ||
  manifest.editorial_status !== "ai_translated" ||
  manifest.public_status !== "hidden" ||
  manifest.publication_eligible !== false ||
  ![2, 3, 4].includes(manifest.prefix_length)
) throw new Error("Unsafe or incompatible translation overlay manifest");
if (!Array.isArray(manifest.shards) || manifest.shards.length !== 16 ** manifest.prefix_length) {
  throw new Error("Translation overlay shard count is invalid");
}

const start = args.start === undefined ? 0 : Number(args.start);
const end = args.end === undefined ? manifest.shards.length : Number(args.end);
if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > manifest.shards.length || start >= end) {
  throw new Error(`Invalid upload range: ${args.start ?? 0}..${args.end ?? manifest.shards.length}`);
}
const fullUpload = start === 0 && end === manifest.shards.length;
const finalize = args.finalize === "YES" || fullUpload;
if (finalize && end !== manifest.shards.length) {
  throw new Error("Only the final range may mark an overlay import as verified");
}
const concurrency = args.concurrency === undefined ? 12 : Number(args.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 24) {
  throw new Error("Upload concurrency must be an integer from 1 to 24");
}

const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);
const { client: objectClient, bucket } = createObjectClient(env);
const client = new Client({ connectionString });
const manifestSha256 = createHash("sha256").update(manifestText).digest("hex");
const importId = manifest.import_id || randomUUID();
const objectPrefix = `pustakaobat/full-label/v3.2/translations/${manifestSha256}`;

function requireSafeShard(shard) {
  if (!/^[0-9a-f]{2,4}$/.test(shard.prefix) || !/^overlay\/[0-9a-f]{2,4}\.jsonl\.gz$/.test(shard.path)) {
    throw new Error(`Unsafe overlay shard declaration: ${JSON.stringify(shard)}`);
  }
}

await client.connect();
try {
  await client.query("begin");
  const schema = await client.query("select to_regclass('public.pb_fl32_translation_imports') as overlay_table");
  if (!schema.rows[0]?.overlay_table) throw new Error("Translation overlay schema is missing; run full-label:migrate first");
  await client.query(
    `insert into public.pb_fl32_translation_imports
      (import_id, pipeline_version, checkpoint_sha256, source_text_count, translation_count, empty_translation_count, translated_source_characters,
       prefix_length, object_prefix, manifest_sha256, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'uploading')
     on conflict (checkpoint_sha256) do update set status='uploading', last_error=null, updated_at=now()`,
    [importId, manifest.pipeline_version, manifest.checkpoint_sha256, manifest.source_text_count,
      manifest.translation_count, manifest.empty_translation_count, manifest.translated_source_characters,
      manifest.prefix_length, objectPrefix, manifestSha256],
  );
  await client.query("commit");

  const selectedShards = manifest.shards.slice(start, end);
  let uploaded = 0;
  let nextIndex = 0;
  async function uploadOne(shard) {
    requireSafeShard(shard);
    const filePath = path.join(packageDir, ...shard.path.split("/"));
    const actualSha256 = await sha256File(filePath);
    if (actualSha256 !== shard.sha256) throw new Error(`Checksum mismatch: ${shard.path}`);
    const key = `${objectPrefix}/${shard.prefix}.jsonl.gz`;
    await new Upload({
      client: objectClient,
      params: {
        Bucket: bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: "application/x-ndjson",
        ContentEncoding: "gzip",
        CacheControl: "private, max-age=3600",
        Metadata: { sha256: actualSha256, prefix: shard.prefix, kind: "private-ai-translation-overlay" },
      },
      queueSize: 1,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    }).done();
    uploaded += 1;
    if (uploaded % 100 === 0 || uploaded === selectedShards.length) console.log(JSON.stringify({ uploaded, range_start: start, range_end: end, total: manifest.shards.length }));
  }
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= selectedShards.length) return;
      await uploadOne(selectedShards[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, selectedShards.length) }, worker));

  if (finalize) {
    await client.query(
      `update public.pb_fl32_translation_imports
       set status='verified', verified_at=now(), last_error=null, updated_at=now()
       where checkpoint_sha256=$1 and public_status='hidden' and publication_eligible=false`,
      [manifest.checkpoint_sha256],
    );
  }
  console.log(JSON.stringify({ status: finalize ? "translation_overlay_uploaded" : "translation_overlay_range_uploaded", import_id: importId, uploaded, range_start: start, range_end: end, object_prefix: objectPrefix, public_publishable: false }, null, 2));
} catch (error) {
  await client.query(
    `update public.pb_fl32_translation_imports set status='failed', last_error=$2, updated_at=now() where checkpoint_sha256=$1`,
    [manifest.checkpoint_sha256, String(error?.message || error)],
  ).catch(() => {});
  throw error;
} finally {
  await client.end();
  objectClient.destroy();
}
