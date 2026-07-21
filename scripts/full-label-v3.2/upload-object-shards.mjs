import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { gzipSync } from "node:zlib";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { Client } from "pg";
import {
  assertSafeRow,
  assertTestConnection,
  labelObjectKey,
  loadEnvFile,
  parseArgs,
  readPackage,
  shardNumberFromName,
  verifyManifestFile,
} from "./common.mjs";
import { createObjectClient } from "./object-client.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.package || !args.env || !args["expected-host"] || args.apply !== "YES" || args.shard === undefined) {
  throw new Error(
    "Usage: npm run full-label:upload -- --package <workbench_export> --env <file> --expected-host <test.neon.tech> --shard <0-15> --apply YES",
  );
}

const shardNumber = Number(args.shard);
if (!Number.isInteger(shardNumber) || shardNumber < 0 || shardNumber > 15) throw new Error("--shard must be 0-15");
const packageDir = path.resolve(args.package);
const { manifest } = await readPackage(packageDir);
const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);
const { client: objectClient, bucket } = createObjectClient(env);
const client = new Client({ connectionString });
const item = manifest.files.find((entry) => {
  if (!entry.path.startsWith("object_storage_payload/")) return false;
  return shardNumberFromName(entry.path) === shardNumber;
});
if (!item) throw new Error(`Object shard ${shardNumber} is absent from manifest`);
const verifiedFile = await verifyManifestFile(packageDir, item);
const batchSize = Math.min(100, Math.max(5, Number(args["batch-size"] || 25)));
const concurrency = Math.min(12, Math.max(1, Number(args.concurrency || 6)));

await client.connect();
try {
  const verifiedResult = await client.query(
    `select o.label_id from pb_fl32_label_objects o
     join pb_fl32_label_section_manifests m using (label_id)
     where m.object_shard=$1 and o.storage_status='verified'`,
    [shardNumber],
  );
  const alreadyVerified = new Set(verifiedResult.rows.map((row) => row.label_id));
  await client.query(
    `update pb_fl32_object_shards set storage_status='uploading', last_error=null, updated_at=now() where shard_number=$1`,
    [shardNumber],
  );

  let uploaded = 0;
  let skipped = 0;
  let sectionRows = 0;
  let labelBatch = [];

  async function uploadOne(group) {
    const objectKey = labelObjectKey(group.labelId);
    const plain = Buffer.from(JSON.stringify({
      schema_version: "3.2.0",
      label_id: group.labelId,
      sections: group.sections,
    }), "utf8");
    const body = gzipSync(plain, { level: 9 });
    const checksum = createHash("sha256").update(body).digest("hex");
    const upload = new Upload({
      client: objectClient,
      params: {
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: "application/json",
        ContentEncoding: "gzip",
        CacheControl: "private, max-age=3600",
        Metadata: { sha256: checksum, labelhash: createHash("sha256").update(group.labelId).digest("hex") },
      },
      queueSize: 1,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    });
    const result = await upload.done();
    return {
      labelId: group.labelId,
      objectKey,
      checksum,
      sizeBytes: body.length,
      etag: result.ETag || null,
    };
  }

  async function saveResults(results) {
    if (!results.length) return;
    const values = [];
    const rows = results.map((result) => {
      const start = values.length;
      values.push(result.labelId, result.objectKey, result.checksum, result.sizeBytes, result.etag);
      return `($${start + 1},$${start + 2},$${start + 3},$${start + 4},$${start + 5})`;
    });
    await client.query(
      `insert into pb_fl32_label_objects
        (label_id, object_sha256, object_size_bytes, storage_etag, storage_status, uploaded_at)
       select source.label_id, source.object_sha256, source.object_size_bytes,
         source.storage_etag, 'uploaded', now()
       from (values ${rows.join(",")}) as source(label_id, object_key, object_sha256, object_size_bytes, storage_etag)
       on conflict (label_id) do update set
         object_sha256=excluded.object_sha256, object_size_bytes=excluded.object_size_bytes,
         storage_etag=excluded.storage_etag,
         storage_status='uploaded', uploaded_at=now(), storage_last_error=null, updated_at=now()`,
      values,
    );
  }

  async function flushBatch() {
    if (!labelBatch.length) return;
    const pending = labelBatch;
    labelBatch = [];
    const results = [];
    for (let offset = 0; offset < pending.length; offset += concurrency) {
      const chunk = pending.slice(offset, offset + concurrency);
      results.push(...await Promise.all(chunk.map(uploadOne)));
    }
    await saveResults(results);
    uploaded += results.length;
    if (uploaded % 500 === 0 || uploaded === results.length) {
      console.log(JSON.stringify({ shard: shardNumber, uploaded, skipped, section_rows: sectionRows }));
    }
  }

  async function acceptGroup(labelId, sections) {
    if (!labelId) return;
    if (alreadyVerified.has(labelId)) {
      skipped += 1;
      return;
    }
    labelBatch.push({ labelId, sections });
    if (labelBatch.length >= batchSize) await flushBatch();
  }

  const lines = createInterface({
    input: createReadStream(verifiedFile.filePath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let currentLabelId = null;
  let currentSections = [];
  for await (const line of lines) {
    if (!line) continue;
    sectionRows += 1;
    const record = JSON.parse(line);
    assertSafeRow(record, item.path, sectionRows);
    if (Number(record.object_shard) !== shardNumber) throw new Error(`Wrong object_shard at row ${sectionRows}`);
    if (currentLabelId !== null && record.label_id !== currentLabelId) {
      await acceptGroup(currentLabelId, currentSections);
      currentSections = [];
    }
    currentLabelId = record.label_id;
    currentSections.push(record);
  }
  await acceptGroup(currentLabelId, currentSections);
  await flushBatch();
  await client.query(
    `update pb_fl32_object_shards set storage_status='uploaded', uploaded_at=now(), last_error=null, updated_at=now() where shard_number=$1`,
    [shardNumber],
  );
  console.log(JSON.stringify({ status: "shard_uploaded", shard: shardNumber, uploaded, skipped, section_rows: sectionRows }));
} catch (error) {
  await client.query(
    `update pb_fl32_object_shards set storage_status='failed', last_error=$2, updated_at=now() where shard_number=$1`,
    [shardNumber, String(error?.message || error)],
  ).catch(() => {});
  throw error;
} finally {
  await client.end();
  objectClient.destroy();
}
