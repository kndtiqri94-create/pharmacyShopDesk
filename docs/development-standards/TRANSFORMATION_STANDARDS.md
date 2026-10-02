# Transformation Standards

## Purpose

Defines how business logic — column mapping, casting, normalization,
filtering, joins, aggregations, derived values — is written so it is
isolated, deterministic, testable, and traceable back to the business rule it
implements.

## Scope

Covers row/dataset-level transformation logic between the staging and
business/curated layers (see `DATA_ENGINEERING_STANDARDS.md`). Does not cover
extraction (`SOURCE_CONNECTOR_STANDARDS.md`), writing
(`SINK_CONNECTOR_STANDARDS.md`), or validation gating
(`DATA_QUALITY_STANDARDS.md`) — a transformation MUST NOT reimplement DQ
checks inline; it consumes validated input and produces output that DQ then
validates again at the next boundary.

## Referenced Standards

Builds on the general engineering principles (determinism, testability,
avoiding hidden side effects) in
[ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md).

## Principles

- A transformation is a function of its input: same input, same output,
  every time.
- Business rules are code, not tribal knowledge — every derived value or
  filter condition MUST be traceable to a named function a reviewer can read
  and a test can exercise in isolation.

## Mandatory Rules

### Isolation and purity

1. Transformation modules MUST NOT import source connector or sink connector
   modules directly (see `ENGINEERING_STANDARDS.md` rule 1) — they operate on
   already-extracted, already-typed records/frames and return
   already-shaped records/frames; I/O is the caller's concern.
2. Transformation functions MUST be pure wherever practical: given the same
   input arguments (including any injected reference/lookup data), they MUST
   return the same output with no observable side effect (no logging as a
   substitute for return values, no mutation of input objects/frames unless
   explicitly documented as in-place for performance and covered by a test
   proving callers do not rely on the pre-mutation object).
3. A transformation MUST NOT have hidden side effects: it MUST NOT perform
   network calls, write to a sink, or mutate global/module state. If a step
   genuinely needs a side effect (e.g., calling a reference-data service), it
   MUST be structured as an explicit, injected dependency, not buried inside
   an otherwise-pure-looking function.

### Explicit schema and contracts

4. Every transformation function/stage MUST have an explicit input schema
   and output schema (via typed parameters/return types — see
   `PYTHON_STANDARDS.md` rule 1), not an implicit "whatever comes in."
5. Column selection MUST be explicit — a transformation MUST NOT pass
   through arbitrary extra columns "just in case"; new columns require a
   deliberate change to the output schema/contract (see
   `DATA_CONTRACT_STANDARDS.md`).
6. Renaming and casting rules MUST be centralized per entity/dataset (a
   single mapping table or function), not duplicated inline across multiple
   transformation call sites.

### Null handling, duplicates, filtering

7. Null-handling behavior (drop, default, propagate, fail) MUST be explicit
   per field, not implicit in whatever the underlying library does by
   default for that operation (e.g., a groupby silently dropping null keys).
8. Duplicate handling MUST specify the dedup key and the tie-breaking rule
   (e.g., "keep the row with the latest `updated_at`") explicitly — "just
   call `drop_duplicates()`" without a specified key/tiebreak is not
   acceptable for business-meaningful data.
9. Filtering conditions that encode a business rule (e.g., "active
   customers only") MUST be named functions/constants
   (`is_active_customer(record)`), not inline boolean expressions repeated
   across the codebase.

### Joins, aggregations, and derived values

10. Joins MUST specify the join type explicitly (inner/left/right/full) and
    MUST document the expected cardinality (one-to-one, one-to-many) so a
    reviewer can spot an accidental fan-out.
11. Aggregations that change grain (row count) MUST document the resulting
    grain explicitly (e.g., "one row per customer per month") as part of the
    function's docstring or the output data contract.
12. Derived/business values (scores, tiers, flags) MUST be computed by a
    single named function per rule, callable in isolation for unit testing,
    and MUST be traceable to a documented business requirement (a ticket,
    PRD section, or data contract entry).

### Date/time, precision, string normalization

13. Timezone handling MUST follow `PYTHON_STANDARDS.md` rules 32–34 — all
    business-date computations MUST state which timezone they operate in
    (source-local vs. UTC vs. reporting timezone) explicitly, since this is
    a common silent-bug source in date-bucketed aggregations.
14. Numeric rounding/precision rules MUST be explicit and centralized per
    metric (e.g., currency rounds to 2 decimal places, half-up) — MUST NOT
    rely on incidental floating-point behavior of whatever library performed
    the last arithmetic operation.
15. String normalization (casing, trimming, unicode normalization) MUST be
    applied through a shared, tested utility function per normalization
    rule, not ad hoc `.strip().lower()` chains repeated with slight
    variations across the codebase.

### Surrogate keys, hashes, ordering

16. Surrogate key generation MUST be deterministic given the same natural
    key/business key input (e.g., a stable hash of the natural key), not a
    random UUID, unless the explicit intent is a run-scoped, non-reproducible
    identifier (which MUST be documented as such).
17. Hash-based deduplication/change-detection keys MUST use a
    cryptographically uninteresting but collision-resistant hash (e.g.,
    SHA-256) over a canonically ordered, explicitly-selected set of fields —
    MUST NOT hash an entire record including volatile metadata fields
    (`processed_at`, etc.) or the hash will never match across runs.
18. Any operation whose output order is business-meaningful (e.g., "first
    matching record wins") MUST sort explicitly on a documented key —
    MUST NOT rely on incidental input ordering, dict insertion order, or
    unordered set/groupby iteration order.

### Schema evolution and reuse

19. When an upstream schema adds a new column, the transformation MUST
    either explicitly map it into the output contract or explicitly and
    visibly drop it (e.g., an allow-list of passthrough columns) — it MUST
    NOT be automatically included without a deliberate contract update.
20. A transformation rule used in more than one pipeline MUST be extracted
    into a shared, versioned module rather than copy-pasted (see
    `ENGINEERING_STANDARDS.md` rule 11).

## Recommended Practices

- SHOULD express transformations as small composable functions
  (select → rename → cast → filter → derive) rather than one large function
  performing all steps, so each step is independently testable.
- SHOULD prefer vectorized/set-based operations over row-by-row Python loops
  for dataframe-shaped data (see `PERFORMANCE_AND_SCALE_STANDARDS.md`).
- MAY use a rule-engine/config-driven mapping (e.g., a declarative
  column-mapping table) for high-volume, structurally similar entities, but
  MUST still keep business-rule functions (not just column maps) as
  reviewable code.

## Examples

```python
# Bad — implicit null handling, inline business rule, non-deterministic key
def transform(df):
    df = df[df["status"] == "A"]  # what does "A" mean? repeated elsewhere?
    df["customer_key"] = df["email"].apply(lambda e: uuid4().hex)  # not stable
    return df.groupby("region").sum()  # nulls in "region" silently dropped

# Good — named rule, deterministic key, explicit null policy
def is_active_customer(record: CustomerRecord) -> bool:
    return record.status is CustomerStatus.ACTIVE

def derive_customer_key(record: CustomerRecord) -> str:
    return hashlib.sha256(record.email.strip().lower().encode()).hexdigest()

def transform(records: list[CustomerRecord]) -> list[CustomerRecord]:
    active = [r for r in records if is_active_customer(r)]
    return [r.with_key(derive_customer_key(r)) for r in active]

def aggregate_by_region(
    records: list[CustomerRecord],
    *,
    unknown_region_label: str = "UNKNOWN",
) -> dict[str, int]:
    """Returns one count per region; null regions are bucketed explicitly."""
    totals: dict[str, int] = defaultdict(int)
    for record in records:
        region = record.region or unknown_region_label
        totals[region] += 1
    return dict(totals)
```

## Testing / Validation

Business rules MUST be unit-tested in isolation from extraction/sink code
(see `ENGINEERING_STANDARDS.md` rule 5). Tests MUST cover: null inputs,
duplicate inputs with the documented tiebreak, empty input, and at least one
case per documented business rule branch. See `TESTING_STANDARDS.md` for the
full transformation test category.

## Review Checklist

- [ ] Transformation code does not import connector/sink modules directly.
- [ ] Functions are pure or their side effects are explicit and injected.
- [ ] Input/output schemas are explicit and typed.
- [ ] Null handling, dedup keys/tiebreaks, and join types/cardinality are documented, not implicit.
- [ ] Business rules (filters, derived values) are named, isolated functions traceable to a requirement.
- [ ] Timezone, rounding, and string-normalization rules are explicit and centralized.
- [ ] Surrogate keys/hashes are deterministic given the same input.
- [ ] Business-meaningful ordering is explicit, not incidental.
- [ ] New upstream columns are explicitly mapped or explicitly dropped.
- [ ] Reused rules are extracted into shared modules, not duplicated.

## Related Standards

- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — where transformation sits in the overall stage architecture.
- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — validation gates before and after transformation; transformations do not reimplement DQ checks.
- [DATA_CONTRACT_STANDARDS.md](DATA_CONTRACT_STANDARDS.md) — the schemas transformation input/output must conform to.
- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — typing, datetime, and purity rules referenced throughout.
- [PERFORMANCE_AND_SCALE_STANDARDS.md](PERFORMANCE_AND_SCALE_STANDARDS.md) — vectorization and large-data transformation guidance.
