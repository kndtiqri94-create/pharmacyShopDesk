# Data Quality Standards

## Purpose

Defines PyTIQ's reusable approach to data quality (DQ) validation: the
checks available, how outcomes are classified, how blocking vs. non-blocking
behavior is decided per pipeline, and how DQ results are persisted and
surfaced.

## Scope

Covers validation of data at rest or in transit between pipeline stages.
Does not cover schema *contracts* themselves (see
`DATA_CONTRACT_STANDARDS.md`, which DQ checks against) or business
transformation logic (see `TRANSFORMATION_STANDARDS.md`).

## Referenced Standards

No single external standard governs DQ frameworks; this document defines
PyTIQ's own vocabulary, informed by common industry practice (e.g., the
check categories used by tools such as Great Expectations and dbt tests) as
shared vocabulary, without mandating a specific third-party framework.

## Principles

- DQ failure severity is a per-pipeline, per-check decision — not a single
  global policy. A missing optional field may `WARN` in one dataset and
  `FAIL` in another where it is a required key.
- DQ is a gate between pipeline stages, not an afterthought run against
  already-published data.

## Check Categories

PyTIQ DQ checks fall into these reusable categories:

| Category | Example |
|---|---|
| Not-null | `customer_id` must never be null |
| Uniqueness | `order_id` must be unique within a batch/dataset |
| Business key integrity | Every `order_id` must be non-null and match the source's key format |
| Referential integrity | Every `order.customer_id` must exist in the customer dimension |
| Accepted values | `status` must be one of a documented enum set |
| Type validation | `amount` must parse as a decimal, not an arbitrary string |
| Range validation | `quantity` must be `>= 0` |
| Pattern validation | `email` must match a documented format |
| Freshness | The dataset's max `updated_at` must be within an SLA window of now |
| Completeness | Row count must be within an expected range of a reference count |
| Duplicate detection | No two rows share the same business key + effective date |
| Volume anomaly | Row count must not deviate more than X% from a rolling baseline |
| Distribution anomaly | A numeric column's distribution must not shift beyond a documented threshold (used only where justified — see Mandatory Rules) |
| Custom business rule | Any dataset-specific rule not covered above (e.g., "discount must not exceed list price") |

## Outcome Model

Every check produces exactly one outcome:

- **PASS** — the check's condition held for all evaluated records/the dataset.
- **WARN** — the check's condition failed, but the failure is below the
  configured threshold/tolerance or is explicitly non-blocking for this
  dataset; the run continues.
- **FAIL** — the check's condition failed beyond the configured
  threshold/tolerance and is configured as blocking for this dataset; the
  affected records are quarantined and/or the run halts per the pipeline's
  documented failure policy.

## Mandatory Rules

1. A published dataset MUST have a documented, versioned DQ check suite
   covering, at minimum, not-null on required fields, uniqueness on the
   declared business key, and type/accepted-value validation on any field
   with a closed value set, **when the dataset is externally consumed or
   production-deployed**. An internal, single-pipeline, exploratory output
   SHOULD still apply basic sanity checks (e.g., a row-count or type
   assertion) but is not required to build the full versioned suite until
   the dataset is promoted to that status.
2. Each check MUST declare, explicitly and in configuration (not code
   comments), its severity policy: which outcome (WARN vs. FAIL) applies at
   which threshold, and whether it is **record-level** (each row evaluated
   independently, failing rows quarantined) or **dataset-level** (evaluated
   once over the whole batch, e.g., freshness or volume checks).
3. A dataset-level `FAIL` MUST halt the affected pipeline run (or the
   affected stage) rather than allow a known-bad dataset to publish
   silently, unless a specific dataset's documented policy explicitly
   accepts degraded quality for that check (e.g., a best-effort feed with a
   published quality SLA below 100%).
4. A record-level `FAIL` MUST route the failing record to quarantine (see
   `DATA_ENGINEERING_STANDARDS.md` rule 19) with the specific check(s) it
   failed, rather than either silently dropping it or blocking the entire
   batch, unless the pipeline's documented failure policy requires strict
   all-or-nothing semantics.
5. Thresholds and tolerances (e.g., "fail if more than 1% of rows are
   null") MUST be explicit, versioned configuration values — not hardcoded
   magic numbers scattered across check implementations.
6. **When rule 1's condition applies** (externally consumed or
   production-deployed dataset), DQ results MUST be persisted per run
   (check name, category, outcome, record/row counts affected, threshold
   used) so historical comparison and trend analysis are possible without
   re-running checks.
7. **When rule 1's condition applies**, DQ metrics MUST be emitted to the
   observability pipeline per `OBSERVABILITY_STANDARDS.md`, distinct from
   technical operational metrics (a DQ `WARN` is a data-health signal, not a
   technical error). SHOULD be emitted otherwise.
8. **When rule 1's condition applies**, every DQ check MUST have a
   documented owner (typically the dataset owner from
   `DATA_CONTRACT_STANDARDS.md`) responsible for triaging failures.
9. Distribution/statistical anomaly checks MUST NOT be applied by default —
   they MUST be justified per dataset (sufficient history, a real incident
   they would have caught, or an explicit stakeholder requirement) since
   they carry a higher false-positive rate than deterministic checks.
10. The same failure action MUST NOT be forced uniformly across all
    pipelines — a pipeline's DQ configuration MUST be reviewable
    independently of another pipeline's, with its own thresholds and
    blocking/non-blocking decisions.

## Recommended Practices

- SHOULD run DQ checks as an explicit stage between staging and
  transformation, and again between transformation and publishing, rather
  than only once at the end.
- SHOULD alert on a `WARN` trend (e.g., a null rate creeping upward across
  runs) even when no single run crosses the `FAIL` threshold.
- MAY reuse a shared check library across datasets (e.g., a generic
  `assert_not_null(column)` check factory) rather than writing bespoke
  per-dataset check code for common categories.

## Examples

```python
# Bad — hardcoded threshold buried in an if-statement, no persisted result
def validate(df):
    null_rate = df["customer_id"].isna().mean()
    if null_rate > 0.01:
        raise RuntimeError("too many nulls")  # no WARN tier, no record given

# Good — declarative check with explicit severity policy and persisted result
NOT_NULL_CUSTOMER_ID = DqCheck(
    name="orders.customer_id.not_null",
    category=DqCategory.NOT_NULL,
    scope=DqScope.RECORD_LEVEL,
    warn_threshold=0.001,
    fail_threshold=0.01,
)

def run_check(check: DqCheck, records: list[OrderRecord]) -> DqResult:
    failing = [r for r in records if r.customer_id is None]
    rate = len(failing) / len(records) if records else 0.0
    outcome = classify_outcome(rate, check.warn_threshold, check.fail_threshold)
    return DqResult(check=check, outcome=outcome, failing_records=failing, rate=rate)
```

## Testing / Validation

DQ check implementations MUST be unit-tested against synthetic fixtures
covering: a fully passing dataset, a dataset crossing the `WARN` threshold
only, and a dataset crossing the `FAIL` threshold. See
`TESTING_STANDARDS.md` for the DQ test category and required edge cases
(empty dataset, all-null column, single-row dataset).

## Review Checklist

- [ ] Externally consumed / production datasets have a documented DQ check suite covering not-null, uniqueness, and type/value checks on their declared contract fields (internal/exploratory outputs have at least basic sanity checks).
- [ ] Every check declares record-level vs. dataset-level scope and its WARN/FAIL thresholds explicitly in configuration.
- [ ] Dataset-level FAIL halts the run (or is an explicitly documented exception).
- [ ] Record-level FAIL routes to quarantine with the failing check(s) recorded.
- [ ] Thresholds are configuration values, not hardcoded literals in check logic.
- [ ] DQ results are persisted per run for historical comparison — where the dataset is externally consumed or production-deployed.
- [ ] DQ metrics are distinct from technical observability metrics.
- [ ] Every check has a documented owner — where the dataset is externally consumed or production-deployed.
- [ ] Distribution/statistical anomaly checks are justified, not applied by default.

## Related Standards

- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — quarantine mechanics and stage-boundary placement of DQ gates.
- [DATA_CONTRACT_STANDARDS.md](DATA_CONTRACT_STANDARDS.md) — the schema/field definitions DQ checks validate against.
- [OBSERVABILITY_STANDARDS.md](OBSERVABILITY_STANDARDS.md) — DQ metric emission, distinguished from technical observability.
- [TESTING_STANDARDS.md](TESTING_STANDARDS.md) — DQ test category and fixture requirements.
