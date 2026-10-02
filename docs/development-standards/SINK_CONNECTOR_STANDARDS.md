# Sink Connector Standards

## Purpose

Defines the common contract every PyTIQ sink connector MUST implement when
writing to a destination — relational databases, warehouses, data lakes,
object storage, APIs, SaaS systems, queues/topics, and streaming platforms —
with an explicit focus on write safety: which write patterns are safe to
retry, and which can cause duplication or corruption if retried carelessly.

## Scope

Covers writing/loading only. Extraction is covered by
`SOURCE_CONNECTOR_STANDARDS.md`; row-level business logic applied before the
write is covered by `TRANSFORMATION_STANDARDS.md`.

## Referenced Standards

Builds directly on the idempotency and error-boundary principles in
[ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) and the restartability
requirements in [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md).

## Principles

- A sink's job is to make data durably and correctly available at the
  destination, with retry-safety as a first-class design constraint — not an
  afterthought handled by "just try/except and retry."
- Every write pattern has a known duplication/corruption risk profile; the
  sink MUST make that risk profile explicit, not leave it to be discovered
  in production.

## Sink Contract

Every sink connector MUST implement:

1. **Connection lifecycle** — typed configuration, injected credentials
   (`SECURITY_AND_PII_STANDARDS.md`), no I/O in `__init__`, resource release
   via context manager (`PYTHON_STANDARDS.md` rules 20–21).
2. **Schema compatibility check** — verify the incoming batch's schema is
   compatible with the destination's current schema (or the sink's declared
   target schema) before writing, per the drift classification in
   `DATA_ENGINEERING_STANDARDS.md` rule 14, **when the destination already
   holds data the write must remain compatible with (append/merge writes),
   or the dataset is externally consumed**. A sink that always
   creates/overwrites a fresh destination (e.g., writing a new Parquet
   file each run) has no prior schema to reconcile against and MAY treat
   this as a trivial pass-through check.
3. **Write** — one explicit method per supported write mode (see below),
   returning a result object stating rows written/rejected, not a bare
   boolean.
4. **Checkpoint commit** — for any sink that supports transactional or
   exactly-once-effective writes, the pipeline's checkpoint MUST be
   committed atomically with (or strictly after) the data write commits —
   never before, and never in a way that can be split by a crash into
   "checkpoint advanced, data not written" or vice versa without a
   reconciliation path.
5. **Cleanup** — release connections/sessions/file handles deterministically.

## Write Modes

| Mode | Description | Retry safety |
|---|---|---|
| **Append** | Insert new rows without checking for existing ones. | Safe to retry only if paired with amethod to detect/skip already-written batches (e.g., a load-id per batch); otherwise retrying duplicates. |
| **Overwrite / Truncate-reload** | Replace the entire target (or partition) contents atomically. | Safe to retry — idempotent by construction, provided the destination supports atomic swap (rename, `CREATE OR REPLACE`, partition swap). |
| **Merge / Upsert** | Insert-or-update keyed on a natural/surrogate key. | Safe to retry when the merge key is stable and unique; unsafe if the key is not actually unique at the destination (silent duplicate rows). |
| **Delete/tombstone** | Apply deletes from a CDC or reconciliation feed. | Safe to retry only if deletes are also keyed and idempotent (deleting an already-deleted key is a no-op, not an error). |

A sink MUST document, per write mode it implements, which of these two
categories it falls into:

- **Safe to retry as-is** — retrying an interrupted write cannot produce
  duplication or corruption.
- **Requires a dedup/reconciliation mechanism to retry safely** — the sink
  MUST implement that mechanism (e.g., an idempotency key column, a
  load-id/batch-id check-before-insert, or a merge key) before retries are
  enabled; a sink MUST NOT silently allow retries in this category without
  the mechanism in place.

## Mandatory Rules

1. Every write path MUST declare its write mode explicitly (append, merge,
   overwrite); a sink MUST NOT default to an implicit append with no
   documentation of duplication risk.
2. A sink supporting **merge/upsert** MUST require a merge key and MUST fail
   fast (schema/config validation) if no merge key is configured, rather
   than silently falling back to append.
3. Where the destination supports transactions, a batch write MUST be
   wrapped in a transaction so partial writes are never visible to readers —
   partial-failure MUST leave the destination in its prior consistent
   state, not a half-written one.
4. Where the destination does not support transactions (e.g., object
   storage, many NoSQL stores), the sink MUST achieve atomicity through an
   equivalent mechanism: write-to-temp-then-atomic-rename/manifest-swap for
   files, or a two-phase "stage then publish" pattern.
5. **When partial success is possible** (record-partitioned writes such as
   bulk API calls or per-row DB upserts), partial failures within a batch
   MUST be captured per-record with enough detail to route to quarantine
   (see `DATA_QUALITY_STANDARDS.md`) — a sink MUST NOT let one bad record
   silently drop the entire batch's valid records unless the pipeline's
   documented failure policy requires strict atomicity. A sink performing
   an atomic, single-unit write (e.g., one Parquet file written via
   temp-then-rename, see rule 4) has no per-record partial-failure mode and
   is exempt from building a quarantine path for it.
6. **When retries or reprocessing of a write are possible**, deduplication
   logic MUST be explicit (idempotency key, merge key, or checkpoint-based
   skip) — a sink MUST NOT rely on "the source won't send the same record
   twice" as its only duplication defense. A write mode already classified
   as "safe to retry as-is" in the Write Modes table above (e.g., an atomic
   overwrite) satisfies this by construction and needs no additional
   mechanism.
7. Batching/bulk-write APIs MUST be used over row-by-row writes whenever the
   destination supports them, with an explicit, configurable batch size (see
   `PERFORMANCE_AND_SCALE_STANDARDS.md`).
8. File-based sinks MUST use deterministic, collision-free file naming
   (including run/partition identifiers) so retried writes either overwrite
   the same logical file or are recognizably part of the same logical batch.
9. A sink MUST expose a **destination validation** step (row count
   reconciliation, checksum, or equivalent) that can confirm a write
   succeeded completely — distinct from "the API call returned 200," which
   does not guarantee durability at all destinations — **when the workload
   is production-deployed or the destination is externally consumed**.
   SHOULD implement this otherwise; it is good practice even for a simple
   pipeline but not a blocking requirement for one.
10. Sinks MUST emit write metrics (rows written, rows rejected, retries,
    duration, bytes written) per `OBSERVABILITY_STANDARDS.md` **when the
    workload is production-deployed or otherwise monitored**. SHOULD emit
    them otherwise.
11. Recovery after a crash mid-write MUST be defined per write mode: for
    overwrite, simply re-run (idempotent); for append/merge, re-run using the
    dedup/merge-key mechanism from rule 6 — a sink MUST NOT require manual
    cleanup of partially-written data as its documented recovery procedure.
12. Secrets MUST NOT be logged; failure logs MUST NOT include full record
    payloads when they contain data classified as restricted per
    `SECURITY_AND_PII_STANDARDS.md` — log identifiers/keys instead.

## Recommended Practices

- SHOULD prefer merge/upsert over blind append for any destination table
  that consumers query directly, to avoid duplicate-sensitive downstream
  bugs.
- SHOULD reconcile row counts (source extracted vs. sink written, accounting
  for documented rejections) at the end of every run and surface a
  discrepancy as an observability alert, not just a log line.
- MAY buffer writes in memory up to a configured batch size, but MUST spill
  or flush before exceeding a documented memory bound (see
  `PERFORMANCE_AND_SCALE_STANDARDS.md`).

## Examples

```python
# Bad — blind append retried after a timeout; no dedup mechanism
def write(self, records: list[Record]) -> None:
    self._client.insert_many(self._table, [r.to_dict() for r in records])
    # A retry after a read-timeout-but-actually-succeeded write duplicates
    # every row in this batch.

# Good — merge on a stable key; safe to retry
def write(self, records: list[Record]) -> WriteResult:
    return self._client.merge(
        table=self._table,
        rows=[r.to_dict() for r in records],
        merge_key="order_id",
    )
```

```python
# Bad — file sink writes directly to the final path; a crash mid-write
# leaves a truncated file that downstream readers may pick up.
def write(self, batch: RecordBatch) -> None:
    with open(self._final_path, "wb") as f:
        batch.to_parquet(f)

# Good — write to a temp path, then atomically rename into place.
def write(self, batch: RecordBatch) -> None:
    temp_path = self._final_path.with_suffix(".tmp")
    with open(temp_path, "wb") as f:
        batch.to_parquet(f)
    temp_path.replace(self._final_path)
```

## Testing / Validation

See `TESTING_STANDARDS.md` → sink connector tests. At minimum: a retry of an
interrupted write does not duplicate/corrupt data (per the declared write
mode's retry-safety category), partial-batch failures are quarantined
correctly, and destination validation correctly detects an incomplete write.

## Security Considerations

Destination credentials follow `SECURITY_AND_PII_STANDARDS.md`. Data
classified as restricted MUST NOT be written to a destination outside its
approved environment/classification without an explicit, reviewed exception.

## Review Checklist

- [ ] Write mode (append/overwrite/merge/delete) is explicit and documented.
- [ ] Merge/upsert sinks require and validate a merge key.
- [ ] Transactional destinations wrap batch writes in a transaction; non-transactional destinations use a stage-then-publish or atomic-rename pattern.
- [ ] Partial-batch failures are captured per-record and quarantined, not silently dropped wholesale — where partial success is possible at all (unless strict atomicity is the documented policy).
- [ ] A retry of an interrupted write cannot duplicate or corrupt data, given the sink's declared write mode — mandatory whenever retries/reprocessing of this write are possible.
- [ ] Bulk/batch write APIs are used, not row-by-row writes, where supported.
- [ ] File sinks use deterministic naming and atomic publish (temp + rename, or manifest swap).
- [ ] A destination validation/reconciliation step exists and is exercised in tests — where production-deployed or externally consumed.
- [ ] Write metrics are emitted — where production-deployed or monitored.
- [ ] No secrets or restricted-data payloads appear in logs.

## Related Standards

- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — pipeline-level idempotency and checkpoint-commit ordering.
- [SOURCE_CONNECTOR_STANDARDS.md](SOURCE_CONNECTOR_STANDARDS.md) — the extraction side this sink's input comes from.
- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — quarantine mechanics for rejected records.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — credential and classified-data handling.
- [PERFORMANCE_AND_SCALE_STANDARDS.md](PERFORMANCE_AND_SCALE_STANDARDS.md) — batching, bulk write sizing, and memory bounds.
