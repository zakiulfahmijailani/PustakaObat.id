import { createHash } from "node:crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import {
  assertTestConnection,
  labelObjectKey,
  loadEnvFile,
  parseArgs,
} from "./common.mjs";
import { createObjectClient } from "./object-client.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.env || !args["expected-host"] || args.apply !== "YES" || args.shard === undefined) {
  throw new Error(
    "Usage: npm run full-label:storage:verify -- --env <file> --expected-host <test.neon.tech> --shard <0-15> --apply YES",
  );
}
const shardNumber = Number(args.shard);
if (!Number.isInteger(shardNumber) || shardNumber < 0 || shardNumber > 15) throw new Error("--shard must be 0-15");
const env = await loadEnvFile(args.env);
const connectionString = env.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!connectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing");
assertTestConnection(connectionString, args["expected-host"]);
const { client: objectClient, bucket } = createObjectClient(env);
const client = new Client({ connectionString });
const concurrency = Math.min(16, Math.max(1, Number(args.concurrency || 8)));

async function verifyOne(row) {
  const response = await objectClient.send(new GetObjectCommand({ Bucket: bucket, Key: labelObjectKey(row.label_id) }));
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.Body) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  const checksum = hash.digest("hex");
  if (checksum !== row.object_sha256 || bytes !== Number(row.object_size_bytes)) {
    throw new Error(`${row.label_id}: object checksum/size mismatch`);
  }
  return row.label_id;
}

await client.connect();
try {
  const result = await client.query(
    `select o.label_id, o.object_sha256, o.object_size_bytes
     from pb_fl32_label_objects o
     join pb_fl32_label_section_manifests m using (label_id)
     where m.object_shard=$1 and o.storage_status in ('uploaded','verified')
     order by o.label_id`,
    [shardNumber],
  );
  let verified = 0;
  for (let offset = 0; offset < result.rows.length; offset += concurrency) {
    const chunk = result.rows.slice(offset, offset + concurrency);
    const labelIds = await Promise.all(chunk.map(verifyOne));
    await client.query(
      `update pb_fl32_label_objects
       set storage_status='verified', storage_verified_at=now(), storage_last_error=null, updated_at=now()
       where label_id=any($1::text[])`,
      [labelIds],
    );
    verified += labelIds.length;
    if (verified % 500 === 0 || verified === result.rows.length) {
      console.log(JSON.stringify({ shard: shardNumber, verified, total: result.rows.length }));
    }
  }
  await client.query(
    `update pb_fl32_object_shards set storage_status='verified', verified_at=now(), last_error=null, updated_at=now() where shard_number=$1`,
    [shardNumber],
  );
  console.log(JSON.stringify({ status: "shard_verified", shard: shardNumber, verified }));
} finally {
  await client.end();
  objectClient.destroy();
}
