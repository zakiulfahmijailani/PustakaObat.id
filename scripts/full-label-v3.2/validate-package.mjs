import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import {
  assertSafeRow,
  parseArgs,
  readPackage,
  verifyManifestFile,
} from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.package) {
  throw new Error("Usage: npm run full-label:validate -- --package <workbench_export> [--full YES]");
}

const packageDir = path.resolve(args.package);
const { manifest, manifestSha256 } = await readPackage(packageDir);
const metadataCounts = new Map();
let fullSectionCount = 0;

for (const item of manifest.files) {
  const verified = await verifyManifestFile(packageDir, item);
  const isMetadata = item.path.startsWith("neon_metadata/");
  const shouldReadRows = isMetadata || args.full === "YES";
  let rows = null;

  if (shouldReadRows) {
    rows = 0;
    const lines = createInterface({
      input: createReadStream(verified.filePath).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      if (!line) continue;
      rows += 1;
      const record = JSON.parse(line);
      assertSafeRow(record, item.path, rows);
    }
  }

  if (isMetadata) {
    const name = path.basename(item.path, ".jsonl.gz");
    metadataCounts.set(name, rows);
    const expected = manifest.record_counts[name];
    if (rows !== expected) throw new Error(`${item.path}: expected ${expected} rows, found ${rows}`);
  } else if (rows !== null) {
    fullSectionCount += rows;
  }

  console.log(JSON.stringify({ path: item.path, bytes: verified.sizeBytes, checksum: "valid", rows }));
}

if (args.full === "YES" && fullSectionCount !== manifest.record_counts.full_label_sections) {
  throw new Error(`Expected ${manifest.record_counts.full_label_sections} full sections, found ${fullSectionCount}`);
}

console.log(JSON.stringify({
  status: "valid",
  package_version: manifest.package_version,
  manifest_sha256: manifestSha256,
  metadata_counts: Object.fromEntries(metadataCounts),
  full_section_rows: args.full === "YES" ? fullSectionCount : "not_counted_checksums_only",
  publication_policy: "source_only / hidden / publication_eligible=false",
}, null, 2));
