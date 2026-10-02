# Data Engineering Standards

## Purpose

Defines PyTIQ's core Data Engineering architecture: how pipelines are
structured into stages, how state (watermarks, checkpoints) is managed across
runs, and how restartability, replayability, and schema evolution are
guaranteed. This document is cloud-, warehouse-, and orchestrator-neutral by
design — technology-specific implementations sit behind the boundaries
defined here and in `SOURCE_CONNECTOR_STANDARDS.md` /
`SINK_CONNECTOR_STANDARDS.md`.

## Scope

Applies to every PyTIQ pipeline regardless of processing paradigm (batch,
micro-batch, streaming) or orchestrator. Connector-specific extraction
mechanics live in `SOURCE_CONNECTOR_STANDARDS.md`; sink-specific write
mechanics live in `SINK_CONNECTOR_STANDARDS.md`; row-level business logic
lives in `TRANSFORMATION_STANDARDS.md`; validation rules live in
`DATA_QUALITY_STANDARDS.md`.

## Referenced Standards

No single external standard governs DE pipeline architecture; this document
draws on widely used industry vocabulary (Kimball-style staging layers, the
medallion/bronze-silver-gold pattern, CDC terminology) as shared vocabulary,
not as a mandated implementation.

## Principles

- A pipeline is a directed sequence of **stages** with explicit contracts
  between them (see `DATA_CONTRACT_STANDARDS.md`); a stage's internals are
  free to change as long as its contract holds.
- **Restartability is not optional**: any stage MUST be able to resume from
  its last committed state after a crash without manual data surgery.
- **Idempotent by construction**: re-running a stage for the same logical
  input window MUST converge to the same output state, not append duplicates.
- **No forced technology**: this standard does not assume Spark, a specific
  warehouse, a specific orchestrator, or a specific file format. Where a
  concrete choice is made for a given pipeline, it sits behind the
  connector/sink boundary.
- **Proportional architecture**: per `ENGINEERING_STANDARDS.md`'s
  Proportionality principle, the four-stage architecture and the
  contract/metadata/lineage machinery below apply once a pipeline's
  characteristics justify them (business logic, multiple consumers,
  incremental/persisted state, production deployment). A single-stage
  pipeline performing a pure format conversion (e.g., CSV → Parquet) is a
  fully compliant PyTIQ pipeline, not a shortcut around this standard.

## Mandatory Rules

### Pipeline architecture and stage boundaries

1. A pipeline MUST decompose into explicit stages with clear roles —
   **ingestion** (source → raw), **staging** (raw → validated/typed),
   **transformation** (staging → business/derived), **publishing**
   (business → serving layer) — **when the pipeline has business
   transformation logic, more than one source, or a need to
   reprocess/replay a stage independently of the others**. A pipeline
   performing a pure format/type conversion with no business rules (for
   example, a direct CSV → Parquet conversion) MAY collapse extraction,
   validation, and writing into a single stage. Whatever the stage count, a
   pipeline MUST NOT blur extraction and business-rule application into one
   opaque step once business rules exist — the trigger for splitting
   stages is the presence of business logic and multi-consumer reuse, not
   pipeline existence itself.
2. A stage boundary MUST have an explicit, versioned data contract (see
   `DATA_CONTRACT_STANDARDS.md` rule 1) **when its output is consumed by
   more than one pipeline or published to a serving layer**. A boundary
   internal to a single pipeline MAY rely on an informal, inline schema
   (e.g., a typed function signature or dataclass — see
   `PYTHON_STANDARDS.md` rules 1–12) instead of a formal contract artifact.
   Regardless of formality, a downstream stage MUST NOT depend on
   undocumented incidental structure of an upstream stage's output — the
   schema, formal or informal, MUST be explicit. This rule is deliberately
   aligned with `DATA_CONTRACT_STANDARDS.md` rule 1; the two MUST NOT be
   read as conflicting requirements.
3. **When a pipeline maintains a distinct raw/staging layer** (per rule 1),
   that layer MUST preserve the source's original structure and values
   (append-only, immutable once written) so that reprocessing from raw
   never depends on the source system still having the data, and
   transformation MUST NOT mutate raw data in place. A pipeline that
   collapses ingestion/staging into a single stage under rule 1 has no
   separate raw layer to make immutable and is not required to introduce
   one solely to satisfy this rule.
4. A pipeline stage's dependencies on other stages MUST be explicit
   (declared inputs), not implicit (reading "whatever happens to be in a
   shared location").

### State management, restartability, replayability

5. Any stage that processes data incrementally MUST persist its processing
   state (watermark, cursor, checkpoint — see
   `SOURCE_CONNECTOR_STANDARDS.md` → Incremental state) durably, outside
   process memory, before being considered complete for that run.
6. A crashed or killed pipeline run MUST be resumable from the last
   committed checkpoint without reprocessing already-committed data twice in
   a way that produces duplicates or corruption — see idempotent write rules
   in `SINK_CONNECTOR_STANDARDS.md`.
7. Replaying a historical window (backfill/reprocessing) MUST be possible
   using the same code path as normal incremental processing, parameterized
   by an explicit start/end window — pipelines MUST NOT require special
   one-off scripts that diverge from production logic to backfill.
8. Full reprocessing of a partition or dataset MUST be safe to run
   concurrently with, or in place of, an incremental run without producing
   an inconsistent intermediate state visible to consumers (see
   `SINK_CONNECTOR_STANDARDS.md` → atomicity/transactions).

### Determinism and idempotency (DE-specific)

9. Given the same input data and the same processing window, a pipeline run
   MUST produce byte-for-byte or row-for-row equivalent output (modulo
   explicitly non-deterministic fields such as `processed_at` timestamps,
   which MUST be isolated to metadata columns, not business columns).
10. A stage MUST define, per `ENGINEERING_STANDARDS.md` rule 6, its
    idempotency mechanism: upsert on a natural/surrogate key, checkpoint +
    skip-if-already-processed, or overwrite-by-partition. "Re-run and hope"
    is not an acceptable mechanism.

### CDC, late-arriving data, backfills

11. A pipeline consuming CDC MUST explicitly handle out-of-order delivery
    (apply by CDC sequence/LSN, not arrival order) and MUST define behavior
    for deletes (tombstone propagation vs. hard delete) per the data
    contract.
12. Late-arriving data MUST be handled by one of two explicit, documented
    strategies per pipeline: (a) a bounded lookback/reprocessing window that
    re-applies affected partitions, or (b) an explicit "late data" sink path
    with defined reconciliation. Silent dropping of late data MUST NOT be
    the default; it MUST be an explicit, reviewed decision recorded against
    the pipeline.
13. Backfills MUST be executed through the same pipeline code, parameterized
    by date/window range, and MUST respect the same data quality gates as
    incremental runs (see `DATA_QUALITY_STANDARDS.md`).

### Schema evolution and drift

14. A pipeline MUST detect schema drift at ingestion (new/removed/retyped
    columns) rather than silently coercing or dropping data **when the
    source supports schema discovery or the source's schema can change over
    the pipeline's lifetime**. For a source with a fixed, known-stable
    schema (e.g., a static reference file whose shape is a documented
    assumption), drift detection MAY be omitted. Wherever drift detection
    is implemented, detected drift MUST be classified as compatible
    (additive, widenable type) or breaking per `DATA_CONTRACT_STANDARDS.md`,
    and breaking drift MUST halt the affected stage rather than write
    inconsistent data downstream.
15. Schema evolution MUST be versioned; a downstream consumer MUST be able
    to determine which schema version produced a given dataset/partition.

### Metadata, lineage, ownership, SLAs

16. A pipeline MUST record run-level metadata (pipeline id, run id,
    start/end time, status, input/output row counts) sufficient to answer
    "what ran, when, and did it succeed" without reading application logs —
    see `OBSERVABILITY_STANDARDS.md` for the concrete schema — **when the
    pipeline is production-deployed or its output is externally
    consumed**. A local, single-run exploratory pipeline SHOULD still log
    this information to stdout/a log file but is not required to persist
    it to a dedicated metadata store.
17. A published dataset MUST have a documented owner, an explicit
    source-of-truth statement (which upstream system is authoritative for
    which fields), and, where applicable, an SLA/SLO for freshness (see
    `DATA_CONTRACT_STANDARDS.md`) **when the dataset is externally
    consumed or production-deployed**. An internal, single-pipeline output
    is exempt until it is promoted to that status.
18. Lineage (which run produced which output, from which inputs) MUST be
    derivable from persisted run metadata **when rule 16's condition
    applies** (production-deployed or externally consumed), even if a
    dedicated lineage tool is not yet integrated. Where rule 16 does not
    require persisted run metadata, lineage MAY be reconstructed informally
    (e.g., from script arguments and file timestamps).

### Failure boundaries and quarantine

19. A pipeline MUST distinguish record-level failures (a single malformed
    record) from run-level failures (schema break, auth failure, sink
    unavailable) **when partial success is possible** — i.e., the pipeline
    performs meaningful per-record validation rather than an atomic,
    all-or-nothing operation (see `DATA_QUALITY_STANDARDS.md`). Where
    partial success is possible, record-level failures MUST be routed to a
    quarantine path without failing the entire run, unless the pipeline's
    documented failure policy requires strict all-or-nothing semantics for
    that dataset. A pipeline performing a single atomic operation (e.g., a
    one-file format conversion with no per-record validation) has no
    record-level failure mode to quarantine and is exempt from building
    one.
20. Wherever quarantine exists under rule 19, a quarantined record MUST
    retain enough context (original payload, failure reason, pipeline run
    id) to be triaged and reprocessed without re-extracting from the
    source.

### Partitioning, retention, archival, lifecycle, environments

21. Datasets that grow unbounded MUST be partitioned (typically by a time
    dimension) so that retention, archival, and incremental processing can
    operate on bounded subsets rather than the full dataset.
22. A persisted dataset MUST have a documented retention policy (how long
    raw/staging/serving copies are kept) and, where required by
    `SECURITY_AND_PII_STANDARDS.md`, a deletion mechanism that can act on a
    specific partition or record set, **when the dataset is
    production-deployed, externally consumed, or contains sensitive/PII
    data**. A local, non-sensitive, exploratory output SHOULD still be
    cleaned up deliberately but is not required to carry formal retention
    documentation. This exception MUST NOT be used to avoid retention/
    deletion controls once sensitive data is involved — see
    `SECURITY_AND_PII_STANDARDS.md`, which is unconditional wherever
    restricted/PII data exists.
23. **When more than one environment exists** (e.g., DEV/QA/PROD), they
    MUST be fully separated at the data layer — a non-PROD pipeline run
    MUST NOT be able to read from or write to a PROD dataset location by
    default (see `CONFIGURATION_STANDARDS.md` and
    `SECURITY_AND_PII_STANDARDS.md`). This rule does not apply to a
    single-environment local workload, but becomes mandatory the moment a
    second environment is introduced, especially where sensitive data is
    involved.

## Recommended Practices

- SHOULD adopt a layered naming convention (e.g., raw/staging/curated or
  bronze/silver/gold) consistently across pipelines so stage roles are
  discoverable from naming alone.
- SHOULD prefer append-only, partition-overwrite patterns over row-level
  update logic in staging layers, reserving upsert/merge for the
  publishing/serving layer where the data model calls for it.
- MAY implement streaming pipelines using micro-batch semantics when true
  low-latency streaming is not a requirement — do not force a streaming
  engine onto a workload that batch handles adequately (see
  `PERFORMANCE_AND_SCALE_STANDARDS.md`).

## Architecture / Structure

```
Source(s) → [Ingestion stage] → Raw/Staging → [Transformation stage] → Business/Curated → [Publishing stage] → Serving
                     │                              │                                          │
              watermark/checkpoint            DQ validation gate                        contract validation
              (this document, §State)     (DATA_QUALITY_STANDARDS.md)             (DATA_CONTRACT_STANDARDS.md)
```

Each arrow is a contract boundary (`DATA_CONTRACT_STANDARDS.md`); each stage
independently owns its idempotency and restartability guarantees.

## Examples

```python
# Bad — watermark held only in memory; a crash loses incremental progress
class OrdersIngestion:
    def __init__(self) -> None:
        self._last_seen_id: int | None = None

    def run(self) -> None:
        records = source.fetch_since(self._last_seen_id)
        sink.write(records)
        self._last_seen_id = records[-1].id  # lost on crash before next run

# Good — watermark persisted durably before the run is considered complete
class OrdersIngestion:
    def __init__(self, watermark_store: WatermarkStore) -> None:
        self._watermark_store = watermark_store

    def run(self) -> None:
        watermark = self._watermark_store.load("orders")
        records = source.fetch_since(watermark.cursor)
        if not records:
            return
        sink.write(records)
        self._watermark_store.commit("orders", records[-1].cursor)
```

## Testing / Validation

See `TESTING_STANDARDS.md` for restart/recovery, checkpoint, incremental, CDC,
backfill, and schema-drift test categories. At minimum, a new pipeline stage
MUST include a test that simulates a mid-run crash and verifies a subsequent
run resumes correctly without duplication or data loss.

## Security Considerations

Environment separation (rule 23) and retention/deletion (rule 22) intersect
directly with `SECURITY_AND_PII_STANDARDS.md`; PII classification determines
retention and cross-environment copy rules — see that document before
designing a new dataset's lifecycle.

## Review Checklist

- [ ] Stage boundaries and their contracts are explicit and documented (formal contract required only when consumed cross-pipeline or published; an informal typed schema is sufficient for a single-pipeline internal boundary).
- [ ] Incremental state (watermark/checkpoint) is persisted durably, not held only in memory — where the pipeline performs incremental processing at all.
- [ ] The pipeline is restartable from the last checkpoint without manual intervention.
- [ ] Backfill/reprocessing uses the same code path as incremental processing — where backfill/reprocessing is a feature of this pipeline.
- [ ] Late-arriving data handling is explicit (lookback window or documented drop policy) — not implicit — where the pipeline consumes CDC or otherwise faces late-arriving data.
- [ ] Schema drift is detected and classified (breaking vs. compatible), not silently coerced — where the source supports schema discovery or its schema can evolve.
- [ ] Record-level failures are quarantined with enough context to retriage; run-level failures halt appropriately — where partial success is possible at all.
- [ ] Unbounded datasets are partitioned; retention policy is documented — where the dataset is production-deployed, externally consumed, or sensitive.
- [ ] DEV/QA/PROD data locations are isolated by configuration, not by convention alone — where more than one environment exists.

## Related Standards

- [SOURCE_CONNECTOR_STANDARDS.md](SOURCE_CONNECTOR_STANDARDS.md) — extraction-side incremental state mechanics.
- [SINK_CONNECTOR_STANDARDS.md](SINK_CONNECTOR_STANDARDS.md) — write-side idempotency, transactions, and reconciliation.
- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — validation gates between stages, quarantine mechanics.
- [DATA_CONTRACT_STANDARDS.md](DATA_CONTRACT_STANDARDS.md) — stage-boundary and dataset contracts, schema versioning.
- [OBSERVABILITY_STANDARDS.md](OBSERVABILITY_STANDARDS.md) — run metadata schema.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — environment separation and retention/deletion requirements.
