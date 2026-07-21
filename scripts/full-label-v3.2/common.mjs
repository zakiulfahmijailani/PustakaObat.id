import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "YES";
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

export async function loadEnvFile(filePath) {
  const content = await readFile(filePath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

export function assertTestConnection(connectionString, expectedHost) {
  const url = new URL(connectionString);
  if (!expectedHost || url.hostname !== expectedHost) {
    throw new Error(`Refusing database write: expected test host ${expectedHost || "<missing>"}, got ${url.hostname}`);
  }
  if (!url.hostname.endsWith(".neon.tech")) {
    throw new Error("Refusing database write: target is not a Neon host");
  }
  return url;
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  const input = createReadStream(filePath);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function readPackage(packageDir) {
  const manifestPath = path.join(packageDir, "import_manifest.json");
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  if (manifest.package_version !== "3.2.0") {
    throw new Error(`Expected package 3.2.0, got ${manifest.package_version}`);
  }
  if (
    manifest.automatic_publication !== false ||
    manifest.editorial_status !== "source_only" ||
    manifest.public_status !== "hidden" ||
    manifest.publication_eligible !== false ||
    manifest.text_truncation_applied !== false
  ) {
    throw new Error("Unsafe or incompatible v3.2 manifest policy");
  }
  return {
    manifest,
    manifestPath,
    manifestSha256: await sha256File(manifestPath),
  };
}

export function assertSafeRow(record, fileName, rowNumber) {
  if (
    record.editorial_status !== "source_only" ||
    record.public_status !== "hidden" ||
    record.publication_eligible !== false
  ) {
    throw new Error(`Unsafe publication state in ${fileName} at row ${rowNumber}`);
  }
}

export async function verifyManifestFile(packageDir, item) {
  const filePath = path.join(packageDir, ...item.path.split("/"));
  const fileStat = await stat(filePath);
  if (Number(fileStat.size) !== Number(item.size_bytes)) {
    throw new Error(`${item.path}: expected ${item.size_bytes} bytes, found ${fileStat.size}`);
  }
  const checksum = await sha256File(filePath);
  if (checksum !== item.sha256) throw new Error(`${item.path}: compressed SHA-256 mismatch`);
  return { filePath, sizeBytes: Number(fileStat.size), sha256: checksum };
}

export function shardNumberFromName(fileName) {
  const match = fileName.match(/label_sections_shard_(\d{2})\.jsonl\.gz$/);
  if (!match) throw new Error(`Cannot determine shard number from ${fileName}`);
  return Number(match[1]);
}

export function labelObjectKey(labelId) {
  const digest = sha256Text(labelId);
  return `pustakaobat/full-label/v3.2/labels/${digest.slice(0, 2)}/${digest}.json.gz`;
}

export function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

export function buildUpsert(config, records) {
  const columns = Object.keys(records[0]);
  const values = [];
  const rows = records.map((record) => {
    if (Object.keys(record).join("\0") !== columns.join("\0")) {
      throw new Error(`Inconsistent columns for ${config.table}`);
    }
    const placeholders = columns.map((column) => {
      values.push(record[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(",")})`;
  });
  if (config.onConflict === "nothing") {
    const target = quoteIdentifier(config.table);
    const sql = `insert into ${target} (${columns.map(quoteIdentifier).join(",")}) values ${rows.join(",")} ` +
      `on conflict (${config.keys.map(quoteIdentifier).join(",")}) do nothing`;
    return { sql, values };
  }
  const updates = columns
    .filter((column) => !config.keys.includes(column))
    .map((column) => `${quoteIdentifier(column)}=excluded.${quoteIdentifier(column)}`);
  updates.push("updated_at=now()");
  const target = quoteIdentifier(config.table);
  const changedWhere = columns.includes("source_row_hash")
    ? ` where ${target}.source_row_hash is distinct from excluded.source_row_hash`
    : "";
  const sql = `insert into ${target} (${columns.map(quoteIdentifier).join(",")}) values ${rows.join(",")} ` +
    `on conflict (${config.keys.map(quoteIdentifier).join(",")}) do update set ${updates.join(",")}${changedWhere}`;
  return { sql, values };
}
