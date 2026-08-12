import { createHash } from "node:crypto";
import { existsSync, createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip, gzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import {
  assertTestConnection,
  bilingualLabelObjectKey,
  labelObjectKey,
  loadEnvFile,
  parseArgs,
} from "./common.mjs";
import { createObjectClient } from "./object-client.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.env || !args["expected-host"] || !args.overlay || args.apply !== "YES") {
  throw new Error("Usage: node materialize-bilingual-label-objects.mjs --env <file> --expected-host <neon-host> --overlay <overlay-dir> [--label-id <id> | --label-ids <id,id> | --label-ids-file <file> | --candidate-only YES --limit <1-1000>] [--batch-size <1-100>] [--concurrency <1-12>] [--force YES] --apply YES");
}

const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);

const overlayDir = path.resolve(args.overlay);
const targetLabelIds = new Set();
if (args["label-id"]) targetLabelIds.add(args["label-id"]);
if (args["label-ids"]) {
  for (const value of String(args["label-ids"]).split(",")) if (value.trim()) targetLabelIds.add(value.trim());
}
if (args["label-ids-file"]) {
  for (const line of (await readFile(args["label-ids-file"], "utf8")).split(/\r?\n/)) {
    if (line.trim()) targetLabelIds.add(line.trim());
  }
}

const candidateOnly = args["candidate-only"] === "YES";
if (candidateOnly && targetLabelIds.size) throw new Error("Use explicit label IDs or --candidate-only YES, not both");
if (!candidateOnly && !targetLabelIds.size) throw new Error("At least one target label or --candidate-only YES is required");
const limit = args.limit === undefined ? null : Number(args.limit);
if (candidateOnly && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
  throw new Error("--candidate-only YES requires --limit between 1 and 1000");
}
const batchSize = Math.min(100, Math.max(1, Number(args["batch-size"] || 25)));
const concurrency = Math.min(12, Math.max(1, Number(args.concurrency || 4)));
const force = args.force === "YES";

const { client: objectClient, bucket } = createObjectClient(env);
const client = new Client({ connectionString });

async function runPool(items, workerCount, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function readJsonGzipObject(key) {
  const response = await objectClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`Missing object ${key}`);
  const chunks = [];
  for await (const chunk of response.Body.pipe(createGunzip())) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function loadTranslations(hashes, prefixLength) {
  const prefixes = [...new Set([...hashes].map((hash) => hash.slice(0, prefixLength)))];
  const maps = await runPool(prefixes, Math.min(8, concurrency * 2), async (prefix) => {
    const translations = [];
    const filePath = path.join(overlayDir, `${prefix}.jsonl.gz`);
    if (!existsSync(filePath)) return translations;
    const lines = createInterface({ input: createReadStream(filePath).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) continue;
      const record = JSON.parse(line);
      if (!hashes.has(record.source_text_sha256)) continue;
      if (record.translation_status !== "AI_TRANSLATED_UNREVIEWED" || !record.content_indonesian?.trim()) {
        throw new Error(`Unsafe translation record ${record.source_text_sha256}`);
      }
      translations.push([record.source_text_sha256, record]);
    }
    return translations;
  });
  return new Map(maps.flat());
}

function buildBilingualObject(label, sections, translations, overlay) {
  let translatedSectionCount = 0;
  const bilingualSections = sections.map((section) => {
    const translation = translations.get(section.source_text_sha256);
    if (translation) translatedSectionCount += 1;
    return {
      ...section,
      indonesian_draft: translation?.content_indonesian || null,
      translation_status: translation?.translation_status || section.translation_status,
      translation_quality_flags_json: translation?.quality_flags_json || "[]",
    };
  });
  const body = gzipSync(Buffer.from(JSON.stringify({
    schema_version: "3.2.1-bilingual",
    label_id: label.label_id,
    translation_import_id: overlay.import_id,
    sections: bilingualSections,
  }), "utf8"), { level: 9 });
  return {
    labelId: label.label_id,
    body,
    translatedSectionCount,
    objectSha256: createHash("sha256").update(body).digest("hex"),
    key: bilingualLabelObjectKey(overlay.manifest_sha256, label.label_id),
  };
}

async function uploadBuiltObject(built) {
  try {
    const result = await new Upload({
      client: objectClient,
      params: {
        Bucket: bucket,
        Key: built.key,
        Body: built.body,
        ContentType: "application/json",
        ContentEncoding: "gzip",
        CacheControl: "private, max-age=3600",
        Metadata: { sha256: built.objectSha256, kind: "private-full-label-bilingual" },
      },
      queueSize: 1,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    }).done();
    return { ...built, status: "verified", etag: result.ETag || null, error: null };
  } catch (error) {
    return { ...built, status: "failed", etag: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function saveResults(results, overlay) {
  if (!results.length) return;
  const values = [];
  const rows = results.map((result) => {
    const offset = values.length;
    values.push(result.labelId, overlay.import_id, result.objectSha256, result.body.length,
      result.translatedSectionCount, result.status, result.etag, result.error);
    return `($${offset + 1},$${offset + 2}::uuid,$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},now(),${result.status === "verified" ? "now()" : "null"},$${offset + 8},now())`;
  });
  await client.query(`
    insert into public.pb_fl32_bilingual_label_objects
      (label_id, translation_import_id, object_sha256, object_size_bytes, translated_section_count,
       storage_status, storage_etag, uploaded_at, storage_verified_at, storage_last_error, updated_at)
    values ${rows.join(",")}
    on conflict (label_id, translation_import_id) do update set
      object_sha256=excluded.object_sha256, object_size_bytes=excluded.object_size_bytes,
      translated_section_count=excluded.translated_section_count, storage_status=excluded.storage_status,
      storage_etag=excluded.storage_etag, uploaded_at=now(),
      storage_verified_at=excluded.storage_verified_at,
      storage_last_error=excluded.storage_last_error, updated_at=now()
  `, values);
}

await client.connect();
try {
  const overlay = (await client.query(`
    select import_id::text, manifest_sha256, prefix_length
    from public.pb_fl32_translation_imports
    where status='verified' and editorial_status='ai_translated'
      and public_status='hidden' and publication_eligible=false
    order by verified_at desc nulls last, imported_at desc
    limit 1
  `)).rows[0];
  if (!overlay) throw new Error("Verified translation overlay is unavailable");

  let labels;
  let skippedExisting = 0;
  if (candidateOnly) {
    labels = (await client.query(`
      select distinct m.label_id, m.section_count, m.object_shard
      from public.pb_fl32_drug_label_candidates c
      join public.pb_fl32_label_section_manifests m using (label_id)
      join public.pb_fl32_label_objects o using (label_id)
      left join public.pb_fl32_bilingual_label_objects b
        on b.label_id=m.label_id and b.translation_import_id=$1::uuid
      where o.storage_status='verified' and (b.storage_status is distinct from 'verified')
      order by m.object_shard, m.label_id
      limit $2
    `, [overlay.import_id, limit])).rows;
  } else {
    labels = (await client.query(`
      select m.label_id, m.section_count, m.object_shard, b.storage_status as bilingual_status
      from public.pb_fl32_label_section_manifests m
      join public.pb_fl32_label_objects o using (label_id)
      left join public.pb_fl32_bilingual_label_objects b
        on b.label_id=m.label_id and b.translation_import_id=$2::uuid
      where m.label_id=any($1::text[]) and o.storage_status='verified'
      order by m.object_shard, m.label_id
    `, [[...targetLabelIds], overlay.import_id])).rows;
    const available = new Set(labels.map((row) => row.label_id));
    const missing = [...targetLabelIds].filter((labelId) => !available.has(labelId));
    if (missing.length) throw new Error(`Source label objects missing for: ${missing.join(", ")}`);
    if (!force) {
      skippedExisting = labels.filter((row) => row.bilingual_status === "verified").length;
      labels = labels.filter((row) => row.bilingual_status !== "verified");
    }
  }

  let completed = 0;
  let failed = 0;
  for (let offset = 0; offset < labels.length; offset += batchSize) {
    const batch = labels.slice(offset, offset + batchSize);
    const sources = await runPool(batch, concurrency, async (label) => {
      const payload = await readJsonGzipObject(labelObjectKey(label.label_id));
      if (payload.schema_version !== "3.2.0" || payload.label_id !== label.label_id || payload.sections?.length !== label.section_count) {
        throw new Error(`Invalid source label object for ${label.label_id}`);
      }
      return { label, sections: payload.sections };
    });
    const hashes = new Set(sources.flatMap(({ sections }) => sections
      .map((section) => section.source_text_sha256)
      .filter((hash) => /^[a-f0-9]{64}$/.test(hash || ""))));
    const translations = await loadTranslations(hashes, overlay.prefix_length);
    const built = sources.map(({ label, sections }) => buildBilingualObject(label, sections, translations, overlay));
    const results = await runPool(built, concurrency, uploadBuiltObject);
    await saveResults(results, overlay);
    completed += results.filter((result) => result.status === "verified").length;
    failed += results.filter((result) => result.status === "failed").length;
    console.log(JSON.stringify({ processed: offset + batch.length, selected: labels.length, verified: completed, failed, skipped_existing: skippedExisting }));
    if (failed) throw new Error(`${failed} bilingual object upload(s) failed; rerun the command to resume`);
  }
  console.log(JSON.stringify({
    status: "bilingual_label_objects_materialized",
    selected: labels.length,
    verified: completed,
    failed,
    skipped_existing: skippedExisting,
    translation_import_id: overlay.import_id,
    public_publishable: false,
  }));
} finally {
  await client.end();
  objectClient.destroy();
}
