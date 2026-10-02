# Observability Standards

## Purpose

Defines PyTIQ's structured logging, metrics, tracing, and run-metadata
conventions — the technical observability layer that answers "what ran, did
it succeed, how fast, and why did it fail," distinct from Data Quality,
which answers "was the data correct."

## Scope

Covers logs, metrics, traces, and run/task metadata emitted by pipeline
components. Does not cover DQ result semantics (see
`DATA_QUALITY_STANDARDS.md`), though DQ results are emitted through this
document's mechanisms.

## Referenced Standards

Aligns conceptually with OpenTelemetry's semantic conventions for
traces/metrics/logs and correlation-id propagation, without mandating a
specific vendor or SDK — the required fields below are what OpenTelemetry
and comparable systems both expect as a baseline.

## Principles

- Observability is a first-class output of a pipeline run, not an
  afterthought bolted on when something breaks in production.
- Technical observability (did it run, how long, how many records) is
  distinct from data health (was the data itself correct) — the two are
  correlated via `run_id` but never conflated into one metric stream.
- Per `ENGINEERING_STANDARDS.md`'s Proportionality principle, the
  structured-logging and metrics infrastructure below is mandatory **when
  the workload is production-deployed or otherwise monitored**. A local,
  one-off script printing plain progress messages to stdout is a fully
  compliant PyTIQ pipeline; it is not required to wire up structured
  logging, correlation IDs, or a metrics backend it will never be queried
  through. What remains unconditional regardless of workload size: never
  logging a secret or restricted-data value (see
  `SECURITY_AND_PII_STANDARDS.md`), and never suppressing a failure signal
  (a failed run MUST still be visible, at minimum via a non-zero exit code
  and a clear error message).

## Standard Context Fields

Every log line, metric, and trace span emitted by a pipeline component
SHOULD carry these fields where applicable:

| Field | Description |
|---|---|
| `pipeline_name` | Human-readable pipeline identifier. |
| `pipeline_id` | Stable machine identifier for the pipeline definition. |
| `run_id` | Unique identifier for this specific execution. |
| `task_id` / `stage_id` | Identifier for the stage/task within the run. |
| `source` | Source system identifier, where applicable. |
| `sink` | Destination system identifier, where applicable. |
| `connector` | Connector name/type. |
| `dataset` | Dataset/table/topic name. |
| `partition` | Partition key/value being processed, where applicable. |
| `correlation_id` | Propagated identifier linking related log lines/spans across components and process boundaries. |
| `start_time` / `end_time` / `duration` | Timing for the unit of work being logged. |
| `status` | `success` / `failure` / `partial` / `in_progress`. |
| `records_read` / `records_processed` / `records_written` / `records_rejected` | Row-level counters. |
| `bytes_read` / `bytes_written` | Volume counters. |
| `retries` | Count of retry attempts for this unit of work. |
| `error_category` | Classified failure type (see `ENGINEERING_STANDARDS.md` error boundaries), not a raw exception string. |
| `checkpoint` / `watermark` | Current incremental position, only when it does not itself contain restricted data. |
| `freshness` / `lag` | Time since last successful update / distance behind real-time, where applicable. |

## Mandatory Rules

### Structured logging

1. **When the workload is production-deployed or otherwise monitored**,
   logs MUST be structured (key-value / JSON-capable), not free-form
   string interpolation of variable data into a message — use the logging
   framework's structured fields (`logger.info("event", extra={...})` or an
   equivalent structured logging wrapper), not
   `logger.info(f"Read {n} records from {source}")`. A simple/local
   pipeline SHOULD still prefer structured fields where convenient but MAY
   use plain log messages.
2. Log levels MUST be used consistently regardless of workload size — this
   costs nothing extra and keeps output readable: `DEBUG` for detailed
   diagnostic/development-only detail, `INFO` for normal operational
   milestones (run started/completed, batch processed), `WARNING` for a
   `DQ WARN`-equivalent or a retried-but-recovered condition, `ERROR` for a
   failure that affected the outcome of a run or record, `CRITICAL`
   reserved for failures requiring immediate operator attention.
3. Secrets and restricted/PII data MUST NOT appear in any log field at any
   level, including `DEBUG` — see `SECURITY_AND_PII_STANDARDS.md`. This is
   unconditional regardless of workload size. Log redaction MUST be
   applied at the logging boundary (a shared formatter/filter) rather than
   left to every call site individually **when the workload is
   production-deployed or handles secrets/restricted data routinely**; a
   simple pipeline with no secrets/PII has nothing to redact.
4. **When the workload is production-deployed or spans more than one
   component/process**, every log line for a unit of work MUST include
   `correlation_id` and `run_id` so logs from a single run can be
   reconstructed across components without cross-referencing timestamps. A
   single-process local script MAY omit these fields — its own log
   ordering already serves that purpose.

### Metrics

5. **When the workload is production-deployed or otherwise monitored**, a
   pipeline run MUST emit, at minimum, the standard context fields marked
   as counters/timing above, at run completion (success or failure).
6. Wherever metrics are emitted under rule 5, they MUST be emitted even on
   failure — a failed run MUST still report `status=failure`, `duration`,
   and whatever partial counters are known, not silently omit metrics
   because the run did not complete cleanly. Regardless of rule 5's
   applicability, a failed run of **any** PyTIQ pipeline MUST remain
   visible by some means (non-zero exit code, a clear error message, or an
   exception propagated to the caller) — failure visibility is
   unconditional even when full metrics emission is not required.
7. **Where both exist**, technical metrics (this document) and DQ metrics
   (`DATA_QUALITY_STANDARDS.md`) MUST be distinguishable in whatever
   metrics backend is used (distinct metric namespace/prefix or distinct
   dataset) — they MUST NOT be merged into one undifferentiated stream
   where a data-health signal could be mistaken for a technical error or
   vice versa.

### Tracing and correlation

8. **When the workload is production-deployed or spans more than one
   component/process**, a `correlation_id` MUST be generated (or
   propagated, if received from an upstream trigger) at the start of a run
   and threaded through every component invoked during that run, including
   calls to connectors, sinks, and DQ checks.
9. **When distributed tracing infrastructure is in use**, spans MUST be
   created per stage at minimum (source extraction, transformation, DQ
   validation, sink write) so a single run's timeline is reconstructable
   from tracing data alone. A pipeline with no tracing infrastructure is
   not required to introduce one solely to satisfy this rule.

### Dashboards, alerts, pipeline/data health

10. **When the workload is production-deployed**, pipeline health (is it
    running, on schedule, within expected duration) and data health (DQ
    outcomes, freshness) MUST be independently visualizable — a dashboard
    MUST NOT conflate "the pipeline succeeded" with "the data is correct,"
    since a technically successful run can still produce a `DQ FAIL`.
11. **When alerting is configured for a workload**, thresholds MUST be
    attached to specific, named metrics (duration exceeding an SLA,
    `error_category` rate, freshness lag) — not to generic "any ERROR log
    line," which produces alert fatigue.

### Lineage and audit

12. **When the pipeline is production-deployed or its output is externally
    consumed** (see `DATA_ENGINEERING_STANDARDS.md` rules 16–18), run
    metadata (this document's standard context fields) MUST be sufficient
    to reconstruct lineage — which run produced which output partition,
    from which input watermark/checkpoint — without requiring a dedicated
    lineage tool as a hard dependency.
13. **When the workload processes restricted/PII data or is
    production-deployed**, audit-relevant events (schema changes, contract
    version bumps, manual reprocessing/backfill triggers, access to
    restricted data outside normal pipeline execution) MUST be logged with
    sufficient detail to answer who/what triggered them and when — this
    follows from `SECURITY_AND_PII_STANDARDS.md`'s unconditional audit
    requirement wherever secrets/PII/production data are involved.

## Recommended Practices

- SHOULD emit a single structured "run summary" event at the end of every
  run/stage containing all standard context fields, in addition to
  granular in-flight log lines, so dashboards can query one canonical
  record per run.
- SHOULD propagate `correlation_id` through any queue/event message headers
  when a pipeline spans asynchronous boundaries.
- MAY sample verbose `DEBUG` logging in production to control volume, but
  MUST NOT sample `ERROR`/`CRITICAL` events or run-summary metrics.

## Examples

```python
# Bad — unstructured string interpolation; no correlation id; secret risk
logger.info(f"Extracted {count} records from {api_key}@{source_url}")

# Good — structured, redacted, correlated
logger.info(
    "extraction.completed",
    extra={
        "correlation_id": context.correlation_id,
        "run_id": context.run_id,
        "source": "orders_api",
        "records_read": count,
        "duration": duration_seconds,
        "status": "success",
    },
)
```

## Testing / Validation

Observability emission SHOULD be covered by tests asserting that a run
(success and failure paths) emits the required standard context fields, and
that no restricted field ever appears in emitted log records (see
`SECURITY_AND_PII_STANDARDS.md`).

## Review Checklist

- [ ] Logs are structured, not free-form string interpolation of variable data — where production-deployed/monitored.
- [ ] Log levels follow the documented DEBUG/INFO/WARNING/ERROR/CRITICAL semantics (unconditional — low-cost regardless of workload size).
- [ ] No secret or restricted-data value appears in any log field at any level (unconditional).
- [ ] A failed run is visible by some means (exit code, error message, or propagated exception) even in a simple pipeline (unconditional).
- [ ] `correlation_id` and `run_id` are present on every log line for a unit of work — where production-deployed or multi-component.
- [ ] Standard context fields are emitted at run completion, including on failure — where production-deployed/monitored.
- [ ] Technical metrics and DQ metrics are distinguishable, not merged — where both exist.
- [ ] Alerting is attached to specific named metrics/thresholds, not generic error-log triggers — where alerting is configured.
- [ ] Run metadata is sufficient to reconstruct basic lineage without a dedicated tool — where production-deployed or externally consumed.

## Related Standards

- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — DQ-specific metrics, distinct from this document's technical metrics.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — log redaction and restricted-data rules.
- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — run metadata and lineage requirements this document implements.
- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — `logging` module usage rules (rule 29).
