# Engineering Standards

## Purpose

This is PyTIQ's foundational engineering standard. It defines the
language-agnostic, domain-agnostic rules of good software construction that
every other PyTIQ standard builds on: separation of concerns, testability,
idempotency as a general concept, error-boundary design, versioning, and
review expectations. Standards for Python syntax live in
[PYTHON_STANDARDS.md](PYTHON_STANDARDS.md); Data Engineering-specific
architecture (pipelines, watermarks, CDC) lives in
[DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md).

## Scope

Applies to every PyTIQ Python module, regardless of whether it is a connector,
transformation, orchestration component, or shared library. Does not define
Python-specific syntax or typing rules (see `PYTHON_STANDARDS.md`), and does
not define Data Engineering pipeline architecture (see
`DATA_ENGINEERING_STANDARDS.md`).

## Referenced Standards

- Robert C. Martin's SOLID principles (informal industry convention, not a
  formal spec) — used as vocabulary, not law; PyTIQ favors composition over
  inheritance-heavy SOLID application (see Principles below).
- [Semantic Versioning 2.0.0](https://semver.org/) — adopted for all PyTIQ
  packages; see Versioning below and `DEPLOYMENT_STANDARDS.md` for release
  mechanics.

## Principles

- **Separation of concerns**: domain logic, infrastructure/vendor code, and
  orchestration are distinct layers with one-way dependencies (domain never
  imports infrastructure).
- **Single responsibility**: a module, class, or function has one reason to
  change. A connector's reason to change is "the source system's API changed,"
  not "the business rule for filtering active customers changed."
- **Dependency inversion, not dependency inversion theater**: depend on a
  `Protocol` or ABC when more than one concrete implementation exists or is
  planned with a real, named use case. Do not introduce an interface for a
  single implementation "in case we need another one later."
- **Composition over inheritance**: prefer composing small, focused objects
  over building inheritance hierarchies. Inheritance is acceptable for genuine
  is-a relationships with shared behavior (e.g., a `BaseRestConnector`); it is
  not acceptable as a way to share utility functions (use module-level
  functions or a composed helper instead).
- **Determinism where practical**: given the same input state (including
  configuration and clock), a component MUST produce the same output. Sources
  of non-determinism (real clocks, random IDs, set/dict iteration order for
  externally visible output) must be explicit and isolated behind an
  injectable seam (see `PYTHON_STANDARDS.md` → datetime/timezone handling).
- **Idempotency by default**: re-running a component with the same input and
  the same prior state MUST NOT produce a different or duplicated result.
  General idempotency principles live here; sink-specific write idempotency
  lives in `SINK_CONNECTOR_STANDARDS.md`, and pipeline-run idempotency lives
  in `DATA_ENGINEERING_STANDARDS.md`.
- **Fail fast on programmer errors, degrade deliberately on operational
  errors**: a violated invariant (bad config shape, impossible state) should
  raise immediately and loudly. A transient operational failure (network
  blip, rate limit) should be retried or quarantined per the owning
  standard's retry/quarantine rules — never silently swallowed.
- **Avoid premature abstraction**: do not introduce a factory, plugin
  registry, or strategy pattern for a single known variant. Three near-
  identical call sites is a signal to extract a shared function; it is not
  automatically a signal to build a framework.
- **Proportionality**: a rule's mandatory force is scoped to the condition
  that justifies it — production deployment, external consumption,
  sensitive data, persisted state, incremental processing, or a real
  abstraction need. PyTIQ MUST use the simplest architecture that
  correctly and safely satisfies the current workload. Enterprise controls
  (multi-stage pipeline architecture, formal data contracts, connector
  lifecycle ceremony, full observability stacks, release gating) become
  mandatory when workload characteristics require them, not merely because
  something is a PyTIQ pipeline. This principle does **not** weaken any
  rule protecting credentials, secrets, PII/sensitive data, correctness,
  data integrity, resource cleanup, retry safety, or idempotency where
  retries/reprocessing are possible — those remain unconditional regardless
  of workload size (see Mandatory Rules rule 21, and the "Applicability
  trigger" phrasing used throughout this standards library).

## Mandatory Rules

### Separation of concerns and module ownership

1. Domain/business logic modules MUST NOT import vendor SDKs, cloud client
   libraries, or database drivers directly. Vendor-specific code MUST sit
   behind a connector, sink, or `SecretProvider`-style boundary (see
   `SOURCE_CONNECTOR_STANDARDS.md`, `SINK_CONNECTOR_STANDARDS.md`,
   `SECURITY_AND_PII_STANDARDS.md`).
2. Every module MUST have one clearly identifiable owner (a person or team)
   recorded per project convention (e.g., `CODEOWNERS` or the data contract's
   owner field for pipeline outputs — see `DATA_CONTRACT_STANDARDS.md`)
   **when the module is part of a production-deployed or shared/
   multi-consumer codebase**. SHOULD record ownership otherwise — a
   single-author exploratory script is not required to carry formal
   ownership metadata, though it costs little to add.
3. Utility modules (`utils.py`, `helpers.py`) MUST NOT become unbounded
   dumping grounds. A utility module MUST be named for the concern it serves
   (`date_utils.py`, `retry.py`), and functions in it MUST be pure or clearly
   documented side effects.

### Testability and determinism

4. Any component with an external dependency (network, filesystem, clock,
   randomness) MUST accept that dependency through its constructor or function
   signature rather than constructing/importing it internally, so it can be
   substituted in tests. See `TESTING_STANDARDS.md` for the mock/integration
   boundary this enables.
5. Business logic MUST be unit-testable without a live network connection,
   database, or cloud credential.

### Idempotency

6. A component that has a side effect (write, external call, state mutation)
   MUST document, in its docstring or an adjacent comment, what happens on
   re-execution: no-op, safe overwrite, or duplication risk. "Undocumented"
   is not an acceptable state for a side-effecting component.
7. Idempotency MUST be achieved through explicit mechanisms (natural or
   surrogate keys, upserts, dedup checkpoints, at-least-once + downstream
   dedup) — never assumed as a side effect of "it probably won't run twice."

### Error boundaries

8. A module that crosses a system boundary (I/O, external API, another
   pipeline stage) MUST define an explicit error boundary — a narrow
   `try/except` around the boundary call that translates third-party
   exceptions into a PyTIQ-defined exception type, so business logic above
   the boundary does not need to know about vendor-specific exception
   classes — **when the module is production-deployed, is reused across
   more than one pipeline, or sits behind a shared connector/sink
   abstraction**. SHOULD apply the same pattern in a simple, single-use
   pipeline even when not strictly required, since it is low-cost and
   keeps failure messages clear (see rule 9, which is unconditional).
9. Broad exception handling (`except Exception`) MUST NOT be used to
   silently continue past an error. It MAY be used at a top-level run
   boundary (e.g., a pipeline task wrapper) solely to classify, log, and
   re-raise or route to a failure/quarantine path — never to suppress.
10. Distinguish and document, per component, whether a failure MUST halt the
    run (fail-fast: schema break, auth failure, invariant violation) or MAY
    be recorded and routed to a recoverable path (a single bad record,
    a retryable timeout).

### Duplication, reuse, and abstraction

11. A rule, mapping, or transformation used in more than one place MUST be
    extracted into a single shared function or module rather than copied.
12. An abstraction (interface, plugin point, configuration knob) MUST NOT be
    introduced for a hypothetical future requirement; it MUST be justified by
    an existing, named second use case or an explicit near-term roadmap item.
13. Three similar lines of code do not require a shared abstraction merely
    because they are similar — only when they encode the same rule that must
    change consistently.

### Backward compatibility, deprecation, and versioning

14. PyTIQ packages and public interfaces (connector/sink base classes, shared
    utility APIs, data contracts) MUST follow
    [Semantic Versioning](https://semver.org/): breaking changes bump MAJOR,
    additive backward-compatible changes bump MINOR, fixes bump PATCH.
15. A breaking change to a public interface MUST NOT ship silently. It MUST
    be accompanied by: a MAJOR version bump, a changelog entry, and — where
    the interface is used by generated pipelines — a migration note.
16. Deprecating a public function, class, or config key MUST use an explicit
    deprecation marker (e.g., `warnings.warn(..., DeprecationWarning)` plus a
    docstring `.. deprecated::` note) and MUST state the removal target
    version. Silent removal without a deprecation period is a breaking change
    and MUST be versioned as such.
17. A deprecated interface MUST continue to function correctly (not just
    exist) until its documented removal version.

### Documentation and review

18. Every public module, class, and function MUST have a docstring stating
    its purpose (see `PYTHON_STANDARDS.md` → docstrings for format/PEP 257
    alignment). Internal/private helpers MAY skip docstrings when the name
    and type hints make behavior unambiguous.
19. A pull request that changes behavior MUST update any standards-adjacent
    documentation it invalidates (data contract, API doc, README) in the same
    change set — stale documentation is a review-blocking defect, not a
    follow-up.
20. Code review MUST verify: correctness against the stated requirement,
    conformance to the relevant domain standard(s), test coverage for new
    behavior and edge cases, and absence of newly introduced vendor coupling
    in domain layers.

### Proportionality

21. Every other mandatory rule in this standards library MUST be read
    together with the Proportionality principle above: a MUST rule with an
    explicit "applicability trigger" (e.g., "MUST when production-deployed,"
    "MUST when incremental processing is enabled") applies only once that
    condition holds, and a simple workload that does not meet the condition
    is fully compliant without implementing that rule. A MUST rule with
    **no** stated trigger is unconditional and applies to every workload
    regardless of size — this is reserved for rules protecting credentials,
    secrets, PII/sensitive data, correctness, data integrity, resource
    cleanup, retry safety, and idempotency where retries/reprocessing are
    possible. An agent or reviewer MUST NOT invent additional unconditional
    force for a rule that already carries an explicit trigger, and MUST NOT
    treat an explicit trigger as optional guidance rather than a hard
    boundary once satisfied.

## Recommended Practices

- SHOULD prefer small, focused functions (see `PYTHON_STANDARDS.md` for
  complexity guidance) over large functions with internal branching for
  every variant.
- SHOULD default to the simplest design that satisfies the current, known
  requirement; SHOULD NOT design a plugin/strategy system before a second
  concrete implementation exists.
- SHOULD prefer explicit configuration and dependency injection over global
  mutable state or module-level singletons that hold live connections.
- MAY use inheritance for connector/sink base classes that share substantial
  lifecycle behavior (see `SOURCE_CONNECTOR_STANDARDS.md`,
  `SINK_CONNECTOR_STANDARDS.md`), but SHOULD prefer `Protocol`-based
  structural typing when only a method signature is shared.

## Examples

```python
# Bad — domain logic reaches directly into a vendor SDK
import boto3

def enrich_customer_record(record: dict) -> dict:
    s3 = boto3.client("s3")  # vendor coupling inside business logic
    reference = s3.get_object(Bucket="ref-data", Key="tiers.json")
    ...

# Good — vendor access is isolated behind an injected boundary
class CustomerEnricher:
    def __init__(self, reference_data: ReferenceDataProvider) -> None:
        self._reference_data = reference_data

    def enrich(self, record: CustomerRecord) -> CustomerRecord:
        tier = self._reference_data.get_tier(record.customer_id)
        return record.with_tier(tier)
```

```python
# Bad — broad exception handling silently swallows the failure
def load_batch(records: list[Record]) -> None:
    try:
        sink.write(records)
    except Exception:
        pass  # failure is invisible to the pipeline and to operators

# Good — narrow boundary, explicit classification, re-raise or route
def load_batch(records: list[Record]) -> None:
    try:
        sink.write(records)
    except SinkTransientError as exc:
        raise RetryableWriteError(str(exc)) from exc
    except SinkSchemaError as exc:
        raise PipelineFatalError(str(exc)) from exc
```

## Testing / Validation

See `TESTING_STANDARDS.md` for the full test taxonomy. At minimum, any change
governed by this standard MUST include unit tests proving: the new/changed
behavior is correct, the component behaves correctly on re-execution
(idempotency), and an injected failure at the error boundary is classified
and routed correctly rather than swallowed.

## Review Checklist

- [ ] Every mandatory rule applied (or skipped) is consistent with its stated applicability trigger, if any — unconditional rules (secrets, PII, correctness, resource cleanup, retry safety, idempotency) are never skipped regardless of workload size.
- [ ] Domain logic contains no direct vendor SDK / DB driver / cloud client imports.
- [ ] External dependencies (network, clock, randomness, filesystem) are injected, not constructed internally.
- [ ] Side-effecting components document their re-execution behavior.
- [ ] No `except Exception: pass` (or equivalent silent swallow) outside a documented top-level classification boundary.
- [ ] New abstractions are justified by an existing second use case, not speculation.
- [ ] Duplicated logic across call sites has been extracted, or a reason for the duplication is documented.
- [ ] Breaking interface changes carry a version bump, changelog entry, and (if applicable) deprecation path.
- [ ] Public functions/classes have docstrings; changed public behavior has updated docs.

## Related Standards

- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — Python-specific syntax, typing, and tooling rules that implement these principles.
- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — pipeline-level idempotency, restartability, and architecture.
- [TESTING_STANDARDS.md](TESTING_STANDARDS.md) — test taxonomy and pre-merge checklist.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — secret/credential boundary rules referenced by the vendor-isolation rule above.
