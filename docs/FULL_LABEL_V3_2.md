# PustakaObat full-label v3.2

This integration keeps the complete openFDA label corpus private and separates
database metadata from source prose.

## Data placement

- Neon test branch: compact label lookup metadata, safe ranked candidates,
  a derived review queue, section counts, and sparse object-upload state.
- Immutable package/object archive: the complete metadata exports.
- Private S3-compatible object storage: one gzip JSON object per FDA label.
- Git: scripts, schema, and documentation only. Never the handoff package.

Every imported source row must remain:

```text
editorial_status = source_only
public_status = hidden
publication_eligible = false
```

## Why the 16 transport shards are repartitioned

The Colab package contains 16 gzip JSONL transport files of roughly 180–190 MB
each. Serving those files directly would make a single drug page scan a very
large shard. The uploader streams a shard, groups its already-sorted rows by
`label_id`, and uploads one small gzip JSON object per label. The website can
then fetch only the selected label.

## Commands

Use the absolute `workbench_export` path as `<package>`. Put credentials in a
local ignored environment file; never paste them into Git or terminal history.

```powershell
npm run full-label:validate -- --package "<package>"

npm run full-label:migrate -- `
  --env .env.full-label.local `
  --expected-host <test-branch-host.neon.tech> `
  --apply YES

npm run full-label:import -- `
  --package "<package>" `
  --env .env.full-label.local `
  --expected-host <test-branch-host.neon.tech> `
  --apply YES

npm run full-label:verify -- `
  --package "<package>" `
  --env .env.full-label.local `
  --expected-host <test-branch-host.neon.tech>
```

The first verification should report `metadata_passed=true` and
`object_storage_ready=false`. That is expected before object upload.

Upload and verify one shard at a time:

```powershell
npm run full-label:upload -- `
  --package "<package>" `
  --env .env.full-label.local `
  --expected-host <test-branch-host.neon.tech> `
  --shard 0 `
  --apply YES

npm run full-label:storage:verify -- `
  --env .env.full-label.local `
  --expected-host <test-branch-host.neon.tech> `
  --shard 0 `
  --apply YES
```

Repeat for shards `0` through `15`. Upload and verification are resumable:
labels already marked `verified` are skipped.

The compact metadata import is designed for a 512 MB Neon test branch. The
verified v3.2 import uses about 321 MB and does not duplicate full source prose.

For the most expensive package audit, count and parse all 4,432,362 source
sections as well as checking compressed checksums:

```powershell
npm run full-label:validate -- --package "<package>" --full YES
```

## Publication boundary

Successful import does not alter `/obat` and does not create public monographs.
The next application step is an authenticated reviewer view that selects a safe
label candidate, fetches its private object, prepares an Indonesian draft, and
requires pharmacist approval before an explicit publication operation.
