#!/usr/bin/env python3
"""Build private, hash-addressed translation overlay shards from Colab Parquet parts.

The script deliberately writes only staging artifacts. It never changes any
publication status and never writes to Neon or the public application.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import itertools
import json
import shutil
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    import pyarrow.parquet as pq
except ImportError as error:  # pragma: no cover - environment message
    raise SystemExit("pyarrow is required: pip install pyarrow") from error


EXPECTED_TOTAL = 1_799_383


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def open_append_stream(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    return path.open("a", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--translations", required=True, type=Path,
                        help="translation_parts directory from the completed Colab output")
    parser.add_argument("--checkpoint", required=True, type=Path,
                        help="completed checkpoint.json from the same Colab output")
    parser.add_argument("--output", required=True, type=Path,
                        help="empty destination directory for the private overlay package")
    parser.add_argument("--prefix-length", type=int, default=3, choices=(2, 3, 4))
    args = parser.parse_args()

    checkpoint = json.loads(args.checkpoint.read_text(encoding="utf-8"))
    if checkpoint.get("completed") is not True:
        raise SystemExit("Checkpoint is not complete; refusing to build a partial overlay.")
    if int(checkpoint.get("unique_texts_completed", 0)) != int(checkpoint.get("unique_source_rows", 0)):
        raise SystemExit("Checkpoint counts do not prove that every unique text is complete.")
    if int(checkpoint.get("unique_source_rows", 0)) != EXPECTED_TOTAL:
        raise SystemExit("Unexpected source count; update the expected contract deliberately before importing.")

    parts = sorted(args.translations.glob("translations_part_*.parquet"))
    if not parts:
        raise SystemExit("No translation Parquet parts found.")
    if args.output.exists() and any(args.output.iterdir()):
        raise SystemExit("Output directory must be empty.")

    args.output.mkdir(parents=True, exist_ok=True)
    raw_dir = args.output / "_raw_prefixes"
    raw_dir.mkdir()
    streams = {}
    counts: Counter[str] = Counter()
    source_text_count = 0
    total = 0
    empty_translation_count = 0
    characters = 0

    # First partition to 256 temporary files. This keeps memory bounded while
    # ingesting 1.8M Parquet rows.
    for part in parts:
        table = pq.read_table(
            part,
            columns=[
                "source_text_sha256",
                "content_indonesian",
                "translation_status",
                "quality_flags_json",
                "source_character_count",
                "translation_character_count",
            ],
        )
        for row in table.to_pylist():
            source_hash = str(row["source_text_sha256"] or "").lower()
            content = str(row["content_indonesian"] or "")
            if len(source_hash) != 64 or any(char not in "0123456789abcdef" for char in source_hash):
                raise SystemExit(f"Invalid source_text_sha256 in {part.name}")
            if row.get("translation_status") != "AI_TRANSLATED_UNREVIEWED":
                raise SystemExit(f"Unsafe translation status in {part.name} for {source_hash}")

            source_text_count += 1
            if not content.strip():
                # An empty AI output is intentionally omitted. The reviewer
                # workbench will show the English source with no Indonesian
                # draft, which is safer than treating it as translated.
                empty_translation_count += 1
                continue

            prefix2 = source_hash[:2]
            stream = streams.get(prefix2)
            if stream is None:
                stream = open_append_stream(raw_dir / f"{prefix2}.jsonl")
                streams[prefix2] = stream
            stream.write(json.dumps({
                "source_text_sha256": source_hash,
                "content_indonesian": content,
                "translation_status": "AI_TRANSLATED_UNREVIEWED",
                "quality_flags_json": row.get("quality_flags_json") or "[]",
                "source_character_count": int(row.get("source_character_count") or 0),
                "translation_character_count": int(row.get("translation_character_count") or len(content)),
            }, ensure_ascii=False, separators=(",", ":")) + "\n")
            total += 1
            characters += int(row.get("source_character_count") or 0)
            counts[prefix2] += 1

    for stream in streams.values():
        stream.close()
    if source_text_count != EXPECTED_TOTAL or len(counts) != 256:
        raise SystemExit(f"Expected {EXPECTED_TOTAL} source rows across 256 prefixes, found {source_text_count} across {len(counts)}")

    overlay_dir = args.output / "overlay"
    overlay_dir.mkdir()
    shard_records = []
    observed_hashes = set()
    for raw_file in sorted(raw_dir.glob("*.jsonl")):
        child_streams = {}
        with raw_file.open("r", encoding="utf-8") as source:
            for line in source:
                record = json.loads(line)
                prefix = record["source_text_sha256"][:args.prefix_length]
                child = child_streams.get(prefix)
                if child is None:
                    target = overlay_dir / f"{prefix}.jsonl"
                    child = open_append_stream(target)
                    child_streams[prefix] = child
                child.write(line)
                observed_hashes.add(record["source_text_sha256"])
        for child in child_streams.values():
            child.close()

    if len(observed_hashes) != total:
        raise SystemExit("Duplicate source hashes found while building the overlay.")

    for raw_overlay in sorted(overlay_dir.glob("*.jsonl")):
        compressed = raw_overlay.with_suffix(".jsonl.gz")
        with raw_overlay.open("rb") as source, gzip.open(compressed, "wb", compresslevel=9) as target:
            shutil.copyfileobj(source, target)
        raw_overlay.unlink()
    if not total:
        raise SystemExit("No non-empty translations were available for the overlay.")
    for digits in itertools.product("0123456789abcdef", repeat=args.prefix_length):
        prefix = "".join(digits)
        compressed = overlay_dir / f"{prefix}.jsonl.gz"
        if not compressed.exists():
            with gzip.open(compressed, "wb", compresslevel=9):
                pass
        shard_records.append({
            "prefix": prefix,
            "path": f"overlay/{compressed.name}",
            "size_bytes": compressed.stat().st_size,
            "sha256": sha256_file(compressed),
        })
    if len(shard_records) != 16 ** args.prefix_length:
        raise SystemExit(f"Expected {16 ** args.prefix_length} overlay shards, found {len(shard_records)}")
    shutil.rmtree(raw_dir)

    manifest = {
        "schema_version": "1.0",
        "import_id": str(uuid.uuid4()),
        "pipeline_version": checkpoint["pipeline_version"],
        "checkpoint_sha256": sha256_file(args.checkpoint),
        "source_text_count": source_text_count,
        "translation_count": total,
        "empty_translation_count": empty_translation_count,
        "translated_source_characters": characters,
        "prefix_length": args.prefix_length,
        "editorial_status": "ai_translated",
        "public_status": "hidden",
        "publication_eligible": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "shards": shard_records,
    }
    manifest_path = args.output / "translation_overlay_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "status": "overlay_built",
        "output": str(args.output),
        "source_texts": source_text_count,
        "translations": total,
        "empty_translations_omitted": empty_translation_count,
        "characters": characters,
        "shards": len(shard_records),
        "manifest": str(manifest_path),
        "public_publishable": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
