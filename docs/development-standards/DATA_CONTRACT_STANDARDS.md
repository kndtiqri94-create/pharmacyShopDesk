# Data Contract Standards

## Purpose

Defines the structure and lifecycle of data contracts: the explicit,
versioned agreements between producers, pipeline stages, and consumers about
what a dataset looks like, what it means, and how it can change over time.
Contracts are what `DATA_ENGINEERING_STANDARDS.md` stage boundaries and
`DATA_QUALITY_STANDARDS.md` checks validate against.

## Scope

Covers the contract *artifact* and its lifecycle. Does not cover the
mechanics of validating conformance (see `DATA_QUALITY_STANDARDS.md`) or the
transformation logic that produces contract-conformant output (see
`TRANSFORMATION_STANDARDS.md`).

## Referenced Standards

No single external standard defines Data Engineering contracts; this
document draws on API-contract conventions (OpenAPI-style explicit
schemas, SemVer-style compatibility classification) as vocabulary, without
mandating a specific serialization format (see Mandatory Rules).

## Principles

- A data contract is the source of truth for "what this dataset is" —
  independent of, and more durable than, any single pipeline's
  implementation.
- Contracts should be machine-readable wherever practical, so DQ checks and
  schema-drift detection can be automated rather than manually maintained
  in prose.

## Contract Contents

Every data contract MUST define:

| Element | Description |
|---|---|
| Identity | A stable, unique name/id for the dataset. |
| Owner | The person/team accountable for the dataset's correctness and evolution. |
| Producer | The pipeline/stage that produces this dataset. |
| Consumer(s) | Known downstream consumers (pipelines, dashboards, external systems) — MAY be non-exhaustive but MUST list known consumers at contract creation time. |
| Schema | Field names, types, and structure. |
| Nullability | Which fields are required vs. optional/nullable. |
| Keys | The business/natural key and, if different, the surrogate key. |
| Uniqueness | Which field(s) or key combination MUST be unique. |
| Accepted values | Enum/closed-set constraints on relevant fields. |
| Semantics | What each field *means* (not just its type) — e.g., "amount is in minor units (cents), not major units." |
| Classification | Sensitivity classification per field (see `SECURITY_AND_PII_STANDARDS.md`), including PII designation. |
| Schema version | The current version identifier. |
| Effective version/date | When the current version became active. |
| Freshness / SLA / SLO | Expected update cadence and staleness tolerance. |
| Compatibility notes | Known breaking vs. non-breaking changes from the prior version. |

## Mandatory Rules

### Identity, ownership, and discoverability

1. Every dataset that crosses a stage boundary consumed by more than one
   pipeline, or that is published to a serving layer, MUST have a data
   contract. Purely internal, single-pipeline intermediate state MAY skip a
   formal contract but SHOULD still document its schema inline.
2. A contract MUST have exactly one accountable owner at any point in time.
   Ownership transfer MUST be an explicit, dated change to the contract, not
   an implicit assumption.

### Schema and semantics

3. A contract's schema MUST specify nullability per field explicitly —
   "optional" and "nullable" MUST NOT be conflated: a field can be required
   but nullable (must be present, may be `null`), or optional (may be
   absent entirely).
4. Field semantics (units, encoding, meaning of sentinel values) MUST be
   documented in the contract, not left to be inferred from sample data or
   tribal knowledge.
5. PII/sensitivity classification MUST be declared per field at contract
   creation time and kept current — see `SECURITY_AND_PII_STANDARDS.md` for
   the classification taxonomy this maps to.

### Versioning, compatibility, evolution

6. A contract change MUST be classified as **non-breaking** (additive
   optional field, widened type, new accepted value in a superset-compatible
   way) or **breaking** (removed/renamed field, narrowed type, removed
   accepted value, changed field semantics, changed key structure).
7. A non-breaking change MAY ship as a minor version update without
   requiring consumer migration, but MUST still be recorded in the
   contract's version history.
8. A breaking change MUST bump the contract's major version, MUST NOT be
   applied in place to the existing version, and MUST provide a
   documented migration path for known consumers before the old version is
   retired.
9. A breaking change MUST NOT be deployed to production before its known
   consumers (per the contract's Consumer field) have been notified and,
   where required, have confirmed migration readiness.
10. Deprecating a contract version MUST state a removal date/version and
    MUST keep the deprecated version functioning correctly until that date
    (see `ENGINEERING_STANDARDS.md` rules 16–17).

### Validation and evolution mechanics

11. A contract's schema MUST be the input to automated schema-drift
    detection (see `DATA_ENGINEERING_STANDARDS.md` rule 14) and to DQ type
    checks (see `DATA_QUALITY_STANDARDS.md`) — contracts MUST NOT exist only
    as human-readable prose disconnected from enforcement.
12. Contracts SHOULD be expressed in a machine-readable form (e.g., a
    Pydantic model, JSON Schema, or Avro/Protobuf schema already in use by
    the pipeline) so they can be validated programmatically. PyTIQ does not
    mandate one specific serialization format — teams choose the format
    that matches their existing schema/type system, and MUST document that
    choice per contract or per project convention.

## Recommended Practices

- SHOULD colocate the contract definition with the code that produces the
  dataset (e.g., the Pydantic model used by the publishing stage) so drift
  between "documented contract" and "actual output" cannot occur.
- SHOULD review contracts for unused/stale consumer entries periodically so
  breaking-change impact analysis stays accurate.
- MAY generate human-readable contract documentation from the
  machine-readable schema rather than maintaining both by hand.

## Examples

```python
# Contract expressed as a Pydantic model — the single source of truth for
# both the published schema and automated DQ/drift validation.
class OrderContractV2(BaseModel):
    """Data contract: orders.published (v2, effective 2026-06-01).

    Owner: data-platform-team
    Producer: orders-publishing-pipeline
    Known consumers: revenue-dashboard, finance-export
    Breaking change from v1: `amount` renamed from `total` (v1 field name
    retained as a deprecated alias until 2026-12-01).
    """

    order_id: str = Field(description="Business key. Globally unique.")
    customer_id: str
    amount: Decimal = Field(description="Order total, major currency units.")
    status: OrderStatus
    placed_at: datetime
    total: Decimal | None = Field(
        default=None,
        deprecated=True,
        description="Deprecated alias for `amount`; removed in v3 (2026-12-01).",
    )
```

## Testing / Validation

Contract conformance MUST be validated through `DATA_QUALITY_STANDARDS.md`
checks and `DATA_ENGINEERING_STANDARDS.md` schema-drift detection. A contract
version bump MUST be accompanied by a test proving the previous version's
consumers can still parse output during the deprecation window (for
breaking changes with a documented alias/migration path).

## Security Considerations

PII/sensitivity classification recorded in a contract is authoritative input
to `SECURITY_AND_PII_STANDARDS.md` masking, retention, and access-control
decisions — a field MUST NOT be reclassified without updating both the
contract and any dependent security controls in the same change.

## Review Checklist

- [ ] The dataset has a contract with identity, owner, producer, and known consumers recorded.
- [ ] Nullability, keys, uniqueness, and accepted values are explicit, not inferred.
- [ ] Field semantics (units, meaning) are documented, not left implicit.
- [ ] PII/sensitivity classification is declared per field and current.
- [ ] The change is classified as breaking or non-breaking, with the correct version bump.
- [ ] Breaking changes have a documented migration path and consumer notification before rollout.
- [ ] The contract is expressed in, or backed by, a machine-readable schema used for enforcement.
- [ ] Deprecated fields/versions state a removal date and continue functioning until then.

## Related Standards

- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — schema-drift detection that consumes this contract's schema.
- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — checks that validate data against this contract.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — classification taxonomy referenced by the Classification field.
- [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) — general versioning/deprecation rules this document specializes for data contracts.
