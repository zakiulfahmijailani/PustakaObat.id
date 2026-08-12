import { createHash } from "node:crypto";
import { createGunzip, gzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";
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
  throw new Error("Usage: node materialize-bilingual-label-objects.mjs --env <file> --expected-host <neon-host> --overlay <overlay-dir> [--label-id <id> | --label-ids <id,id> | --label-ids-file <file>] --apply YES");
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
  const { readFile } = await import("node:fs/promises");
  for (const line of (await readFile(args["label-ids-file"], "utf8")).split(/\r?\n/)) {
    if (line.trim()) targetLabelIds.add(line.trim());
  }
}
if (!targetLabelIds.size) throw new Error("At least one target label is required");

const { client: objectClient, bucket } = createObjectClient(env);
const client = new Client({ connectionString });

async function readJsonGzipObject(key) {
  const response = await objectClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`Missing object ${key}`);
  const chunks = [];
  for await (const chunk of response.Body.pipe(createGunzip())) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

await client.connect();
try {
  const overlay = (await client.query(`
    select import_id::text, manifest_sha256, prefix_length
    from pb_fl32_translation_imports
    where status='verified' and editorial_status='ai_translated'
      and public_status='hidden' and publication_eligible=false
    order by verified_at desc nulls last, imported_at desc
    limit 1
  `)).rows[0];
  if (!overlay) throw new Error("Verified translation overlay is unavailable");

  const labels = (await client.query(`
    select m.label_id, m.section_count
    from pb_fl32_label_section_manifests m
    join pb_fl32_label_objects o using (label_id)
    where m.label_id = any($1::text[]) and o.storage_status='verified'
  `, [[...targetLabelIds]])).rows;
  if (labels.length !== targetLabelIds.size) {
    const available = new Set(labels.map((row) => row.label_id));
    throw new Error(`Source label objects missing for: ${[...targetLabelIds].filter((id) => !available.has(id)).join(", ")}`);
  }

  const hashes = new Set();
  const sourceByLabel = new Map();
  for (const label of labels) {
    const payload = await readJsonGzipObject(labelObjectKey(label.label_id));
    if (payload.schema_version !== "3.2.0" || payload.label_id !== label.label_id || payload.sections?.length !== label.section_count) {
      throw new Error(`Invalid source label object for ${label.label_id}`);
    }
    sourceByLabel.set(label.label_id, payload.sections);
    for (const section of payload.sections) {
      if (/^[a-f0-9]{64}$/.test(section.source_text_sha256 || "")) hashes.add(section.source_text_sha256);
    }
  }

  const neededPrefixes = new Set([...hashes].map((hash) => hash.slice(0, overlay.prefix_length)));
  const translations = new Map();
  for (const prefix of neededPrefixes) {
    const filePath = path.join(overlayDir, `${prefix}.jsonl.gz`);
    if (!existsSync(filePath)) continue;
    const lines = createInterface({ input: createReadStream(filePath).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) continue;
      const record = JSON.parse(line);
      if (!hashes.has(record.source_text_sha256)) continue;
      if (record.translation_status !== "AI_TRANSLATED_UNREVIEWED" || !record.content_indonesian?.trim()) {
        throw new Error(`Unsafe translation record ${record.source_text_sha256}`);
      }
      translations.set(record.source_text_sha256, record);
    }
  }

  for (const label of labels) {
    let translatedSectionCount = 0;
    const sections = sourceByLabel.get(label.label_id).map((section) => {
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
      sections,
    }), "utf8"), { level: 9 });
    const objectSha256 = createHash("sha256").update(body).digest("hex");
    const key = bilingualLabelObjectKey(overlay.manifest_sha256, label.label_id);
    const result = await new Upload({
      client: objectClient,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ContentEncoding: "gzip",
        CacheControl: "private, max-age=3600",
        Metadata: { sha256: objectSha256, kind: "private-full-label-bilingual" },
      },
      queueSize: 1,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    }).done();
    await client.query(`
      insert into pb_fl32_bilingual_label_objects
        (label_id, translation_import_id, object_sha256, object_size_bytes, translated_section_count,
         storage_status, storage_etag, uploaded_at, storage_verified_at, storage_last_error, updated_at)
      values ($1,$2::uuid,$3,$4,$5,'verified',$6,now(),now(),null,now())
      on conflict (label_id, translation_import_id) do update set
        object_sha256=excluded.object_sha256, object_size_bytes=excluded.object_size_bytes,
        translated_section_count=excluded.translated_section_count, storage_status='verified',
        storage_etag=excluded.storage_etag, uploaded_at=now(), storage_verified_at=now(),
        storage_last_error=null, updated_at=now()
    `, [label.label_id, overlay.import_id, objectSha256, body.length, translatedSectionCount, result.ETag || null]);
    console.log(JSON.stringify({ label_id: label.label_id, object_key: key, object_size_bytes: body.length, translated_sections: translatedSectionCount }));
  }
} finally {
  await client.end();
  objectClient.destroy();
}
