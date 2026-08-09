import { createHash } from "node:crypto";
import { createGunzip, gzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import {
  assertSafeRow,
  assertTestConnection,
  labelObjectKey,
  loadEnvFile,
  parseArgs,
} from "./common.mjs";
import { createObjectClient } from "./object-client.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.env || !args["expected-host"] || args.shard === undefined || args.apply !== "YES") {
  throw new Error("Usage: node materialize-label-objects.mjs --env <file> --expected-host <neon-host> --shard <0-15> [--label-id <id> | --limit <count>] --apply YES");
}

const shardNumber = Number(args.shard);
const limit = args.limit === undefined ? Number.POSITIVE_INFINITY : Number(args.limit);
const targetLabelId = args["label-id"] || null;
if (!Number.isInteger(shardNumber) || shardNumber < 0 || shardNumber > 15) throw new Error("--shard must be 0-15");
if (args.limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error("--limit must be a positive integer");
}

const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);

const { client: objectClient, bucket } = createObjectClient(env);
const client = new Client({ connectionString });
const concurrency = Math.min(24, Math.max(1, Number(args.concurrency || 12)));
const batchSize = Math.min(100, Math.max(5, Number(args["batch-size"] || 25)));

async function uploadLabel(group) {
  const body = gzipSync(Buffer.from(JSON.stringify({
    schema_version: "3.2.0",
    label_id: group.labelId,
    sections: group.sections,
  }), "utf8"), { level: 9 });
  const objectSha256 = createHash("sha256").update(body).digest("hex");
  const result = await new Upload({
    client: objectClient,
    params: {
      Bucket: bucket,
      Key: labelObjectKey(group.labelId),
      Body: body,
      ContentType: "application/json",
      ContentEncoding: "gzip",
      CacheControl: "private, max-age=3600",
      Metadata: {
        sha256: objectSha256,
        labelhash: createHash("sha256").update(group.labelId).digest("hex"),
        kind: "private-full-label-source",
      },
    },
    queueSize: 1,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  }).done();
  return { labelId: group.labelId, objectSha256, objectSizeBytes: body.length, storageEtag: result.ETag || null };
}

await client.connect();
try {
  const shard = (await client.query(
    `select object_key from pb_fl32_object_shards where shard_number=$1 and storage_status in ('uploaded','verified')`,
    [shardNumber],
  )).rows[0];
  if (!shard) throw new Error(`Source shard ${shardNumber} is unavailable`);

  const alreadyMaterialized = new Set((await client.query(
    `select o.label_id from pb_fl32_label_objects o
     join pb_fl32_label_section_manifests m using (label_id)
     where m.object_shard=$1 and o.storage_status='verified'`,
    [shardNumber],
  )).rows.map((row) => row.label_id));

  const response = await objectClient.send(new GetObjectCommand({ Bucket: bucket, Key: shard.object_key }));
  if (!response.Body) throw new Error(`Source shard ${shardNumber} has no body`);
  const lines = createInterface({ input: response.Body.pipe(createGunzip()), crlfDelay: Infinity });
  let currentLabelId = null;
  let currentSections = [];
  let sourceRows = 0;
  let uploaded = 0;
  let skipped = 0;
  let pending = [];

  async function save(results) {
    if (!results.length) return;
    const values = [];
    const rows = results.map((result) => {
      const offset = values.length;
      values.push(result.labelId, result.objectSha256, result.objectSizeBytes, result.storageEtag);
      return `($${offset + 1},$${offset + 2},$${offset + 3},'verified',$${offset + 4},now(),now(),null,now())`;
    });
    await client.query(
      `insert into pb_fl32_label_objects
        (label_id, object_sha256, object_size_bytes, storage_status, storage_etag, uploaded_at, storage_verified_at, storage_last_error, updated_at)
       values ${rows.join(",")}
       on conflict (label_id) do update set
         object_sha256=excluded.object_sha256, object_size_bytes=excluded.object_size_bytes,
         storage_status='verified', storage_etag=excluded.storage_etag,
         uploaded_at=now(), storage_verified_at=now(), storage_last_error=null, updated_at=now()`,
      values,
    );
  }

  async function flush() {
    if (!pending.length) return;
    const groups = pending;
    pending = [];
    const results = [];
    for (let offset = 0; offset < groups.length; offset += concurrency) {
      results.push(...await Promise.all(groups.slice(offset, offset + concurrency).map(uploadLabel)));
    }
    await save(results);
    uploaded += results.length;
    if (uploaded % 500 === 0 || uploaded === limit) {
      console.log(JSON.stringify({ shard: shardNumber, uploaded, skipped, source_rows: sourceRows }));
    }
  }

  async function accept(labelId, sections) {
    if (!labelId) return false;
    if (targetLabelId && labelId !== targetLabelId) return false;
    if (alreadyMaterialized.has(labelId)) {
      skipped += 1;
      return false;
    }
    pending.push({ labelId, sections });
    if (pending.length >= batchSize) await flush();
    return uploaded + pending.length >= limit;
  }

  for await (const line of lines) {
    if (!line) continue;
    sourceRows += 1;
    const record = JSON.parse(line);
    assertSafeRow(record, shard.object_key, sourceRows);
    if (Number(record.object_shard) !== shardNumber) throw new Error(`Wrong object shard at row ${sourceRows}`);
    if (currentLabelId !== null && record.label_id !== currentLabelId) {
      if (await accept(currentLabelId, currentSections)) break;
      currentSections = [];
    }
    currentLabelId = record.label_id;
    currentSections.push(record);
  }
  if (uploaded + pending.length < limit) await accept(currentLabelId, currentSections);
  await flush();
  console.log(JSON.stringify({ status: "label_objects_materialized", shard: shardNumber, uploaded, skipped, source_rows: sourceRows, public_publishable: false }));
} finally {
  await client.end();
  objectClient.destroy();
}
