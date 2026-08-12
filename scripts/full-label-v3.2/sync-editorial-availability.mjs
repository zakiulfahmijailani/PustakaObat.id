import { Client } from "pg";
import { assertTestConnection, loadEnvFile, parseArgs } from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args["app-env"] || !args["full-label-env"] || !args["expected-app-host"] || !args["expected-full-label-host"] || args.apply !== "YES") {
  throw new Error("Usage: node sync-editorial-availability.mjs --app-env <file> --expected-app-host <host> --full-label-env <file> --expected-full-label-host <host> --apply YES");
}

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

function selectBest(rows, key) {
  const selected = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value || selected.has(value)) continue;
    selected.set(value, row);
  }
  return selected;
}

await Promise.all([app.connect(), fullLabel.connect()]);
try {
  const drugs = (await app.query(`
    select drug_key, rxcui, preferred_name
    from public.monograph_staging_drugs
    where editorial_status='staging' and public_status='hidden' and publication_eligible=false
    order by drug_key
  `)).rows;
  const rxcuis = [...new Set(drugs.map((row) => row.rxcui).filter(Boolean))];

  const overlay = (await fullLabel.query(`
    select import_id::text
    from public.pb_fl32_translation_imports
    where status='verified' and editorial_status='ai_translated'
      and public_status='hidden' and publication_eligible=false
    order by verified_at desc nulls last, imported_at desc
    limit 1
  `)).rows[0];
  if (!overlay) throw new Error("Verified translation overlay is unavailable");

  const rxcuiRows = rxcuis.length ? (await fullLabel.query(`
    select c.rxcui, c.label_id, c.candidate_rank, d.effective_time,
      b.translated_section_count, b.translation_import_id::text
    from public.pb_fl32_drug_label_candidates c
    join public.pb_fl32_label_documents d using (label_id)
    join public.pb_fl32_label_objects o using (label_id)
    join public.pb_fl32_bilingual_label_objects b
      on b.label_id=c.label_id and b.translation_import_id=$2::uuid
    where c.rxcui=any($1::text[])
      and o.storage_status='verified' and b.storage_status='verified'
      and b.translated_section_count > 0
    order by c.rxcui, c.candidate_rank nulls last, d.effective_time desc nulls last
  `, [rxcuis, overlay.import_id])).rows : [];
  const bestByRxcui = selectBest(rxcuiRows, "rxcui");

  const unmatchedNames = [...new Set(drugs
    .filter((drug) => !drug.rxcui || !bestByRxcui.has(drug.rxcui))
    .map((drug) => drug.preferred_name?.trim())
    .filter((name) => name && name.length >= 3))];
  const nameRows = unmatchedNames.length ? (await fullLabel.query(`
    select lower(name.value) as normalized_name, d.label_id, d.effective_time,
      b.translated_section_count, b.translation_import_id::text
    from public.pb_fl32_label_documents d
    cross join lateral jsonb_array_elements_text(d.display_names) name(value)
    join public.pb_fl32_label_objects o on o.label_id=d.label_id
    join public.pb_fl32_bilingual_label_objects b
      on b.label_id=d.label_id and b.translation_import_id=$2::uuid
    where d.ingredient_count=1 and lower(name.value)=any($1::text[])
      and o.storage_status='verified' and b.storage_status='verified'
      and b.translated_section_count > 0
    order by lower(name.value), d.effective_time desc nulls last
  `, [unmatchedNames.map((name) => name.toLowerCase()), overlay.import_id])).rows : [];
  const bestByName = selectBest(nameRows, "normalized_name");

  const ready = drugs.flatMap((drug) => {
    const rxcuiMatch = drug.rxcui ? bestByRxcui.get(drug.rxcui) : null;
    const nameMatch = !rxcuiMatch ? bestByName.get(drug.preferred_name?.trim().toLowerCase()) : null;
    const match = rxcuiMatch || nameMatch;
    return match ? [{
      drugKey: drug.drug_key,
      labelId: match.label_id,
      translationImportId: match.translation_import_id,
      translatedSectionCount: match.translated_section_count,
      effectiveTime: match.effective_time,
      matchMethod: rxcuiMatch ? "rxcui" : "exact_single_ingredient_display_name",
    }] : [];
  });

  await app.query("begin");
  await app.query("delete from public.monograph_full_label_availability");
  for (let offset = 0; offset < ready.length; offset += 100) {
    const batch = ready.slice(offset, offset + 100);
    const values = [];
    const rows = batch.map((item) => {
      const index = values.length;
      values.push(item.drugKey, item.labelId, item.translationImportId, item.translatedSectionCount, item.effectiveTime, item.matchMethod);
      return `($${index + 1},$${index + 2},$${index + 3}::uuid,$${index + 4},$${index + 5},$${index + 6},now())`;
    });
    await app.query(`
      insert into public.monograph_full_label_availability
        (drug_key, source_label_id, translation_import_id, translated_section_count,
         source_effective_time, match_method, synced_at)
      values ${rows.join(",")}
    `, values);
  }
  await app.query("commit");
  console.log(JSON.stringify({
    status: "editorial_full_label_availability_synced",
    staged_drugs: drugs.length,
    ready_drugs: ready.length,
    unavailable_drugs: drugs.length - ready.length,
    translation_import_id: overlay.import_id,
  }));
} catch (error) {
  await app.query("rollback").catch(() => {});
  throw error;
} finally {
  await Promise.all([app.end(), fullLabel.end()]);
}
