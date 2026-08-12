import { spawn } from "node:child_process";
import { createGunzip } from "node:zlib";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import {
  assertTestConnection,
  bilingualLabelObjectKey,
  loadEnvFile,
  parseArgs,
} from "./common.mjs";
import { createObjectClient } from "./object-client.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args["app-env"] || !args["full-label-env"] || !args["expected-app-host"] || !args["expected-full-label-host"] || args.apply !== "YES") {
  throw new Error("Usage: node sync-editorial-availability.mjs --app-env <file> --expected-app-host <host> --full-label-env <file> --expected-full-label-host <host> [--prepare YES --overlay <overlay-dir>] --apply YES");
}
const prepare = args.prepare === "YES";
if (prepare && !args.overlay) throw new Error("--prepare YES requires --overlay <overlay-dir>");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sectionMapping = JSON.parse(await readFile(path.resolve(scriptDir, "../../src/lib/full-label/section-mapping.json"), "utf8"));
const [appEnv, fullLabelEnv] = await Promise.all([
  loadEnvFile(args["app-env"]),
  loadEnvFile(args["full-label-env"]),
]);
const appConnectionString = appEnv.DATABASE_URL;
const fullLabelConnectionString = fullLabelEnv.PUSTAKAOBAT_TEST_DATABASE_URL;
if (!appConnectionString) throw new Error("DATABASE_URL is missing from --app-env");
if (!fullLabelConnectionString) throw new Error("PUSTAKAOBAT_TEST_DATABASE_URL is missing from --full-label-env");
assertTestConnection(appConnectionString, args["expected-app-host"]);
assertTestConnection(fullLabelConnectionString, args["expected-full-label-host"]);

const app = new Client({ connectionString: appConnectionString });
const fullLabel = new Client({ connectionString: fullLabelConnectionString });
const { client: objectClient, bucket } = createObjectClient(fullLabelEnv);

function selectBest(rows, key) {
  const selected = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value || selected.has(value)) continue;
    selected.set(value, row);
  }
  return selected;
}

async function runPool(items, workerCount, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

async function runScript(scriptName, scriptArgs, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(scriptDir, scriptName), ...scriptArgs], {
          cwd: path.resolve(scriptDir, "../.."),
          stdio: "inherit",
        });
        child.on("error", reject);
        child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${scriptName} exited with code ${code}`)));
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.error(JSON.stringify({ status: "retrying_child_script", script: scriptName, attempt, max_attempts: maxAttempts }));
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  throw lastError;
}

async function readBilingualObject(overlay, labelId) {
  const response = await objectClient.send(new GetObjectCommand({
    Bucket: bucket,
    Key: bilingualLabelObjectKey(overlay.manifest_sha256, labelId),
  }));
  if (!response.Body) throw new Error(`Missing bilingual object for ${labelId}`);
  const chunks = [];
  for await (const chunk of response.Body.pipe(createGunzip())) chunks.push(Buffer.from(chunk));
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (payload.schema_version !== "3.2.1-bilingual" || payload.label_id !== labelId || payload.translation_import_id !== overlay.import_id || !Array.isArray(payload.sections)) {
    throw new Error(`Invalid bilingual object for ${labelId}`);
  }
  const translatedFdaSections = new Set(payload.sections
    .filter((section) => section.indonesian_draft?.trim())
    .map((section) => section.section_type));
  return Object.entries(sectionMapping)
    .filter(([, fdaSections]) => fdaSections.some((sectionType) => translatedFdaSections.has(sectionType)))
    .map(([monographSection]) => monographSection);
}

await Promise.all([app.connect(), fullLabel.connect()]);
try {
  const drugs = (await app.query(`
    select drug_key, rxcui, preferred_name
    from public.monograph_staging_drugs
    where editorial_status='staging' and public_status='hidden' and publication_eligible=false
    order by preferred_name
  `)).rows;
  const rxcuis = [...new Set(drugs.map((row) => row.rxcui).filter(Boolean))];
  const overlay = (await fullLabel.query(`
    select import_id::text, manifest_sha256
    from public.pb_fl32_translation_imports
    where status='verified' and editorial_status='ai_translated'
      and public_status='hidden' and publication_eligible=false
    order by verified_at desc nulls last, imported_at desc
    limit 1
  `)).rows[0];
  if (!overlay) throw new Error("Verified translation overlay is unavailable");

  const rxcuiRows = rxcuis.length ? (await fullLabel.query(`
    select c.rxcui, c.label_id, c.candidate_rank, d.effective_time, m.object_shard
    from public.pb_fl32_drug_label_candidates c
    join public.pb_fl32_label_documents d using (label_id)
    join public.pb_fl32_label_section_manifests m using (label_id)
    join public.pb_fl32_object_shards shard on shard.shard_number=m.object_shard
    where c.rxcui=any($1::text[]) and shard.storage_status in ('uploaded','verified')
    order by c.rxcui, c.candidate_rank nulls last, d.effective_time desc nulls last
  `, [rxcuis])).rows : [];
  const bestByRxcui = selectBest(rxcuiRows, "rxcui");

  const unmatchedNames = [...new Set(drugs
    .filter((drug) => !drug.rxcui || !bestByRxcui.has(drug.rxcui))
    .map((drug) => drug.preferred_name?.trim())
    .filter((name) => name && name.length >= 3))];
  const nameRows = unmatchedNames.length ? (await fullLabel.query(`
    select lower(name.value) as normalized_name, d.label_id, d.effective_time, m.object_shard
    from public.pb_fl32_label_documents d
    join public.pb_fl32_label_section_manifests m using (label_id)
    join public.pb_fl32_object_shards shard on shard.shard_number=m.object_shard
    cross join lateral jsonb_array_elements_text(d.display_names) name(value)
    where d.ingredient_count=1 and lower(name.value)=any($1::text[])
      and shard.storage_status in ('uploaded','verified')
    order by lower(name.value), d.effective_time desc nulls last
  `, [unmatchedNames.map((name) => name.toLowerCase())])).rows : [];
  const bestByName = selectBest(nameRows, "normalized_name");

  const selected = drugs.flatMap((drug) => {
    const rxcuiMatch = drug.rxcui ? bestByRxcui.get(drug.rxcui) : null;
    const nameMatch = !rxcuiMatch ? bestByName.get(drug.preferred_name?.trim().toLowerCase()) : null;
    const match = rxcuiMatch || nameMatch;
    return match ? [{
      drugKey: drug.drug_key,
      labelId: match.label_id,
      objectShard: Number(match.object_shard),
      effectiveTime: match.effective_time,
      matchMethod: rxcuiMatch ? "rxcui" : "exact_single_ingredient_display_name",
    }] : [];
  });

  async function loadStatuses() {
    const rows = (await fullLabel.query(`
      select selected.label_id, source.storage_status as source_status,
        bilingual.storage_status as bilingual_status, bilingual.translated_section_count
      from unnest($1::text[]) selected(label_id)
      left join public.pb_fl32_label_objects source using (label_id)
      left join public.pb_fl32_bilingual_label_objects bilingual
        on bilingual.label_id=selected.label_id and bilingual.translation_import_id=$2::uuid
    `, [selected.map((item) => item.labelId), overlay.import_id])).rows;
    return new Map(rows.map((row) => [row.label_id, row]));
  }

  let statusByLabel = await loadStatuses();
  if (prepare) {
    const missingSourceByShard = new Map();
    for (const item of selected) {
      if (statusByLabel.get(item.labelId)?.source_status === "verified") continue;
      const shardItems = missingSourceByShard.get(item.objectShard) || [];
      shardItems.push(item.labelId);
      missingSourceByShard.set(item.objectShard, shardItems);
    }
    for (const [shard, labelIds] of [...missingSourceByShard.entries()].sort((a, b) => a[0] - b[0])) {
      await runScript("materialize-label-objects.mjs", [
        "--env", args["full-label-env"],
        "--expected-host", args["expected-full-label-host"],
        "--shard", String(shard),
        "--label-ids", labelIds.join(","),
        "--limit", String(labelIds.length),
        "--apply", "YES",
      ]);
    }
    statusByLabel = await loadStatuses();
    const missingBilingual = selected
      .filter((item) => statusByLabel.get(item.labelId)?.source_status === "verified" && statusByLabel.get(item.labelId)?.bilingual_status !== "verified")
      .map((item) => item.labelId);
    if (missingBilingual.length) {
      await runScript("materialize-bilingual-label-objects.mjs", [
        "--env", args["full-label-env"],
        "--expected-host", args["expected-full-label-host"],
        "--overlay", args.overlay,
        "--label-ids", missingBilingual.join(","),
        "--batch-size", "8",
        "--concurrency", "4",
        "--apply", "YES",
      ]);
    }
    statusByLabel = await loadStatuses();
  }

  const materialized = selected.filter((item) => {
    const status = statusByLabel.get(item.labelId);
    return status?.source_status === "verified" && status?.bilingual_status === "verified" && Number(status.translated_section_count) > 0;
  });
  const withSections = await runPool(materialized, 6, async (item) => ({
    ...item,
    translatedSectionCount: Number(statusByLabel.get(item.labelId).translated_section_count),
    translationImportId: overlay.import_id,
    availableSectionTypes: await readBilingualObject(overlay, item.labelId),
  }));
  const ready = withSections.filter((item) => item.availableSectionTypes.length > 0);

  await app.query("begin");
  await app.query("delete from public.monograph_full_label_availability");
  for (let offset = 0; offset < ready.length; offset += 100) {
    const batch = ready.slice(offset, offset + 100);
    const values = [];
    const rows = batch.map((item) => {
      const index = values.length;
      values.push(item.drugKey, item.labelId, item.translationImportId, item.translatedSectionCount,
        item.effectiveTime, item.matchMethod, item.availableSectionTypes);
      return `($${index + 1},$${index + 2},$${index + 3}::uuid,$${index + 4},$${index + 5},$${index + 6},$${index + 7}::text[],now())`;
    });
    await app.query(`
      insert into public.monograph_full_label_availability
        (drug_key, source_label_id, translation_import_id, translated_section_count,
         source_effective_time, match_method, available_section_types, synced_at)
      values ${rows.join(",")}
    `, values);
  }
  await app.query("commit");
  console.log(JSON.stringify({
    status: "editorial_full_label_availability_synced",
    staged_drugs: drugs.length,
    safely_matched_drugs: selected.length,
    materialized_drugs: materialized.length,
    ready_drugs: ready.length,
    unavailable_drugs: drugs.length - ready.length,
    translation_import_id: overlay.import_id,
  }));
} catch (error) {
  await app.query("rollback").catch(() => {});
  throw error;
} finally {
  objectClient.destroy();
  await Promise.all([app.end(), fullLabel.end()]);
}
