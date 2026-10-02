# Testing Standards

## Purpose

Defines PyTIQ's test taxonomy across unit, integration, and end-to-end
levels for every component type (connectors, sinks, transformations, DQ,
contracts), the mock-vs-integration boundary, test-data rules, and the
pre-merge checklist.

## Scope

Covers what must be tested and how tests are structured. Does not redefine
domain-specific correctness rules — those live in the owning standard
(`SOURCE_CONNECTOR_STANDARDS.md`, `SINK_CONNECTOR_STANDARDS.md`,
`TRANSFORMATION_STANDARDS.md`, `DATA_QUALITY_STANDARDS.md`,
`DATA_CONTRACT_STANDARDS.md`), which this document cross-references rather
than repeats.

## Referenced Standards

**pytest** is PyTIQ's standard test framework (see
[PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) → Tooling) unless a repository has
a documented, justified alternative.

## Principles

- A test proves a specific, named behavior — not "the code runs without
  throwing."
- Tests for Data Engineering code must exercise the failure modes unique to
  pipelines (restart, replay, drift, late data) at least as thoroughly as
  the happy path.

## Test Taxonomy

| Category | What it proves | Owning standard for correctness rules |
|---|---|---|
| Unit tests | A single function/class behaves correctly in isolation. | The component's own standard. |
| Transformation tests | Business rules produce correct output for known inputs, including edge cases. | `TRANSFORMATION_STANDARDS.md` |
| Source connector tests | Pagination, retry classification, timeouts, checkpoint recovery, no-secret-leakage. | `SOURCE_CONNECTOR_STANDARDS.md` |
| Sink connector tests | Retry safety per write mode, transactional/atomic behavior, destination validation. | `SINK_CONNECTOR_STANDARDS.md` |
| Schema tests | A dataset's actual schema matches its declared contract. | `DATA_CONTRACT_STANDARDS.md` |
| Contract tests | Compatibility classification (breaking/non-breaking) is correctly detected between versions. | `DATA_CONTRACT_STANDARDS.md` |
| DQ tests | Checks correctly classify PASS/WARN/FAIL at and around configured thresholds. | `DATA_QUALITY_STANDARDS.md` |
| Integration tests | A component correctly interacts with a real (or realistic, containerized) dependency. | Component's own standard. |
| E2E tests | A full pipeline run, source-to-sink, produces the expected output for a known input dataset. | `DATA_ENGINEERING_STANDARDS.md` |
| Performance tests | A component meets a stated throughput/memory bound, where one is documented. | `PERFORMANCE_AND_SCALE_STANDARDS.md` — only required where justified by a stated SLA. |
| Failure tests | Injected failures (network error, malformed record, sink rejection) are classified and routed correctly. | `ENGINEERING_STANDARDS.md`, component's own standard. |
| Retry tests | Retries apply only to retryable failures; retried operations do not duplicate/corrupt. | `SOURCE_CONNECTOR_STANDARDS.md`, `SINK_CONNECTOR_STANDARDS.md` |
| Timeout tests | Operations fail predictably (not hang) when a dependency is unresponsive. | `SOURCE_CONNECTOR_STANDARDS.md`, `SINK_CONNECTOR_STANDARDS.md` |
| Idempotency tests | Re-running a component with the same input/state converges, not duplicates. | `ENGINEERING_STANDARDS.md`, `DATA_ENGINEERING_STANDARDS.md` |
| Restart/recovery tests | A simulated crash mid-run is followed by correct resumption. | `DATA_ENGINEERING_STANDARDS.md` |
| Checkpoint tests | Watermark/checkpoint state is persisted and read back correctly, including across process restarts. | `DATA_ENGINEERING_STANDARDS.md`, `SOURCE_CONNECTOR_STANDARDS.md` |
| Incremental tests | Incremental extraction/publish correctly bounds to the watermark window, including boundary records. | `SOURCE_CONNECTOR_STANDARDS.md` |
| CDC tests | Out-of-order and delete events are applied correctly (where CDC is used). | `DATA_ENGINEERING_STANDARDS.md`, `SOURCE_CONNECTOR_STANDARDS.md` |
| Late-arriving data tests | The pipeline's documented lookback/drop policy behaves as specified. | `DATA_ENGINEERING_STANDARDS.md` |
| Backfill tests | A historical window reprocesses through the same code path with correct output. | `DATA_ENGINEERING_STANDARDS.md` |
| Schema drift / breaking schema tests | Drift is detected and classified; a breaking change halts the affected stage. | `DATA_ENGINEERING_STANDARDS.md`, `DATA_CONTRACT_STANDARDS.md` |
| Malformed record tests | A single bad record is quarantined without failing the whole batch (unless strict policy applies). | `DATA_QUALITY_STANDARDS.md` |
| Empty dataset tests | Zero-row input is handled without error (not just "large input works"). | Component's own standard. |
| Duplicate tests | Documented dedup/merge keys correctly prevent duplication under retry/replay. | `SINK_CONNECTOR_STANDARDS.md`, `TRANSFORMATION_STANDARDS.md` |
| Null-heavy dataset tests | Null-handling rules behave as documented when nulls dominate a column. | `TRANSFORMATION_STANDARDS.md`, `DATA_QUALITY_STANDARDS.md` |
| Large-data behavior tests | Streaming/chunked processing does not load an entire dataset into memory. | `PERFORMANCE_AND_SCALE_STANDARDS.md` |

## Mandatory Rules

1. Every new or changed behavior MUST include unit tests proving the new
   behavior and MUST NOT rely solely on integration/E2E tests for coverage
   of business logic — integration/E2E tests prove wiring, not business
   correctness. This scales with the workload: a simple CSV → Parquet
   conversion needs a handful of direct assertions (correct output for a
   known input, an empty input, a malformed row), not a fixture/mock
   framework built in advance of need — per `ENGINEERING_STANDARDS.md`'s
   Proportionality principle, the *presence* of a test is unconditional,
   but its *ceremony* MUST match the component's actual complexity.
2. Unit tests MUST NOT require network access, a live database, or live
   cloud credentials. Any test that requires these MUST be an integration
   test, explicitly marked as such (e.g., a pytest marker), and excluded
   from the default fast test run.
3. Integration tests MUST run against a real or realistic dependency
   (a containerized database, a recorded/replayed API fixture, an emulator)
   — not against production systems.
4. Test doubles (mocks/fakes/stubs) MUST implement the same `Protocol`/ABC
   the production dependency implements, so a test double and its real
   counterpart cannot silently drift apart in shape.
5. Test data MUST be synthetic by default (see
   `SECURITY_AND_PII_STANDARDS.md` rules 17–18). Fixtures MUST be
   deterministic — no reliance on `datetime.now()`, unseeded randomness, or
   external network state within a test.
6. Test data and fixtures MUST NOT contain production secrets or
   unnecessary production PII.
7. Every connector/sink MUST have at least one test covering: an empty
   input/result set, a malformed/unexpected-shape response, and a
   simulated timeout or connection failure.
8. Every pipeline stage with persisted incremental state MUST have a test
   that simulates a crash after partial processing and asserts correct,
   non-duplicating resumption.
9. A test asserting "no exception was raised" without an accompanying
   `assert`/`pytest.raises`/explicit value check on the *result* is not a
   sufficient test — every test MUST make at least one explicit assertion
   about output, state, or raised exception type.
10. Tests MUST NOT depend on execution order between test functions; each
    test MUST set up its own required state.

## Mock vs. Integration Test Boundary

- **Unit test with a fake/mock**: use when testing this component's own
  logic in isolation — the dependency's correctness is assumed (it is
  tested separately, or it is a third-party library).
- **Integration test**: use when testing that this component correctly
  drives a real dependency's actual protocol/wire format (e.g., that a SQL
  query is syntactically valid against the real database, that pagination
  parsing matches the real API's actual response shape).
- A component's core business logic MUST be covered by unit tests
  regardless of whether integration tests also exist — integration tests
  are additive, not a substitute.

## Recommended Practices

- SHOULD use `pytest` fixtures to share test-double setup rather than
  duplicating setup code per test file.
- SHOULD use property-based testing (e.g., Hypothesis) for transformation
  functions with a large input domain (numeric edge cases, string
  normalization) where example-based tests risk missing a corner case.
- MAY use recorded HTTP fixtures (cassette-style) for API connector
  integration tests to avoid live network dependency in CI while still
  testing real response parsing.

## Pre-Merge Checklist

- [ ] New/changed behavior has unit test coverage, including documented edge cases (null, empty, duplicate, malformed).
- [ ] Unit tests require no network, database, or live credentials.
- [ ] Integration tests (if any) run against a containerized/emulated dependency, not production.
- [ ] Test doubles implement the same interface as their production counterpart.
- [ ] Test data is synthetic, deterministic, and free of production secrets/PII.
- [ ] Every test contains an explicit assertion about output, state, or exception — not just "no crash."
- [ ] Restart/recovery and idempotency behavior is tested for any component with persisted state.
- [ ] `ruff check`, `ruff format --check`, `mypy`, and `pytest` all pass (see `PYTHON_STANDARDS.md` → Tooling).

## Related Standards

- [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) — testability-by-design principle (dependency injection) that makes this taxonomy achievable.
- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — pytest/tooling baseline.
- [SOURCE_CONNECTOR_STANDARDS.md](SOURCE_CONNECTOR_STANDARDS.md) / [SINK_CONNECTOR_STANDARDS.md](SINK_CONNECTOR_STANDARDS.md) — connector-specific test requirements.
- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — restart/recovery, CDC, and backfill test scenarios.
- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — DQ check test requirements.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — synthetic test data rules.
