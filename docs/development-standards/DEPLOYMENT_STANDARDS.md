# Deployment Standards

## Purpose

Defines how PyTIQ Python packages are built, versioned, tested, scanned, and
promoted through environments — cloud-neutrally — from commit to production.

## Scope

Covers packaging, CI gates, artifact versioning, environment promotion, and
release mechanics. Language tooling configuration (linting, formatting, type
checking) is defined in `PYTHON_STANDARDS.md`; this document covers how
those tools are wired into CI as merge/release gates.

## Referenced Standards

- [PEP 440](https://peps.python.org/pep-0440/) — version identifiers; all
  PyTIQ package versions MUST be PEP 440-compliant.
- [PEP 621](https://peps.python.org/pep-0621/) — project metadata in
  `pyproject.toml`; all PyTIQ packages MUST declare metadata this way, not
  via a legacy `setup.py`/`setup.cfg`.
- Semantic Versioning, as adopted in
  [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) — the version
  *semantics* PEP 440 identifiers encode.

## Principles

- A deployable artifact is built once and promoted unchanged across
  environments — it is never rebuilt per environment from source, which
  would allow environment-specific drift between what was tested and what
  ships.
- Every gate in the pipeline (lint, type-check, test, scan) is a merge
  blocker, not an advisory report read after the fact — for the gates that
  apply (see scope note below).
- **This document's release/promotion machinery (locked dependency
  artifacts, multi-environment promotion, health checks, rollback runbooks,
  approval gates) applies to workloads that are deployed as scheduled or
  production pipelines.** A local, exploratory, or one-off script is not
  "deployed" in this document's sense and is exempt from that machinery per
  `ENGINEERING_STANDARDS.md`'s Proportionality principle. **Exception:**
  dependency-vulnerability scanning and secret scanning (see rule 7, 9)
  remain mandatory for any code committed to a shared repository,
  regardless of production status — these are security gates, not release
  ceremony, and are never optional.

## Mandatory Rules

### Packaging and metadata

1. Every PyTIQ package MUST declare its metadata (name, version,
   dependencies, entry points) in `pyproject.toml` per PEP 621 — a package
   MUST NOT use a legacy `setup.py`-only configuration.
2. Dependency version specifiers MUST follow PEP 440 syntax and MUST pin or
   bound versions deliberately (see Dependency locking below) — a
   dependency MUST NOT be left fully unbounded (`some-package` with no
   version constraint) in a published package's runtime dependencies.
3. Package versions MUST follow Semantic Versioning as adopted in
   `ENGINEERING_STANDARDS.md` rule 14, expressed as a PEP 440 identifier
   (e.g., `2.3.1`, with pre-release identifiers like `2.4.0rc1` for release
   candidates).

### Reproducible builds and dependency locking

4. Application/pipeline projects (as opposed to reusable libraries) MUST
   commit a fully resolved lock file (e.g., from `pip-compile`, `poetry
   lock`, or an equivalent) so a build is reproducible byte-for-byte in its
   dependency closure across machines and time.
5. Reusable PyTIQ libraries (connector SDKs, shared utility packages) MUST
   declare compatible version ranges (not exact pins) for their
   dependencies in `pyproject.toml`, so they do not force conflicting pins
   on consuming projects — exact pinning belongs in the lock file of the
   final deployable application, not in a library's own dependency
   declaration.
6. A dependency upgrade MUST be a reviewed, deliberate change (visible in
   the diff of the lock file), not an incidental side effect of an
   unrelated change.

### CI pipeline gates

7. Every merge to a shared/main branch MUST pass, as blocking CI gates,
   dependency vulnerability scanning (`pip-audit` or equivalent) and secret
   scanning (a pre-commit/CI secret scanner) — **unconditionally, for any
   code committed to a shared repository, regardless of production
   status.** Formatting (`ruff format --check`), linting (`ruff check`),
   static type checking (`mypy`), and the test suite (`pytest`) MUST also
   gate merge **when the workload is production-deployed or shared/reused
   code**; for an exploratory/prototype branch not yet intended for
   production, these four MAY run as advisory checks rather than hard
   blockers, though running them is still recommended at negligible cost.
   See `PYTHON_STANDARDS.md` → Tooling for the specific tools.
8. A failing gate MUST block the merge; gates MUST NOT be bypassed by
   direct commit to the protected branch or by disabling the check for a
   single PR without an explicit, documented, time-boxed exception.
9. Security/dependency scanning MUST run on every merge, not only on a
   periodic schedule, so a newly introduced vulnerable dependency is caught
   before release, not discovered days later.

### Artifacts, environment promotion, configuration/infrastructure separation

10. A build produces exactly one versioned artifact (wheel/container
    image) per release; that same artifact MUST be promoted through
    DEV → QA → PROD without being rebuilt from source at each stage.
11. Environment-specific behavior MUST be entirely driven by external
    configuration (see `CONFIGURATION_STANDARDS.md`) applied to the
    promoted artifact — the artifact itself MUST NOT embed
    environment-specific values baked in at build time.
12. Infrastructure provisioning (however it is expressed — IaC, manual
    cloud console steps documented in a runbook) MUST be defined and
    versioned separately from application code, so an application release
    and an infrastructure change are independently reviewable and
    revertible.

### Schema migrations, rollback, health checks

13. A schema migration accompanying a release MUST be forward-compatible
    with the previous application version for at least one deployment
    cycle (expand-then-contract pattern), so a rollback of the application
    does not require an immediate reverse migration.
14. **When a service/pipeline is production-deployed and scheduled/
    long-running**, it MUST expose a health check (or equivalent
    post-deploy validation step) that verifies its critical dependencies
    (source/sink connectivity, secret resolution) are reachable before
    being considered successfully deployed.
15. **When a workload is production-deployed**, a rollback procedure MUST
    exist and be documented for every release — "redeploy the previous
    artifact version" MUST be a tested, known-good path, not a first-time
    improvisation during an incident.
16. **When a workload is promoted across more than one environment**,
    post-deployment validation (smoke test, health check, a known-good
    canary pipeline run) MUST run automatically after promotion to each
    environment and MUST gate promotion to the next environment.

### Release notes and approval gates

17. Every release MUST have release notes stating what changed, referencing
    any breaking changes to public interfaces or data contracts (see
    `ENGINEERING_STANDARDS.md` rules 14–17, `DATA_CONTRACT_STANDARDS.md`
    rules 6–10).
18. **When a workload has a PROD environment**, promotion to it MUST
    require an explicit approval gate (human sign-off, or a documented
    automated gate such as "all QA smoke tests passed and no open
    Sev1/Sev2") — PROD promotion MUST NOT be fully automatic on merge
    without a defined gate.
19. **When a new pipeline, connector, or sink is promoted to PROD**,
    observability readiness (dashboards/alerts covering the new/changed
    behavior — see `OBSERVABILITY_STANDARDS.md`, which itself conditions
    that infrastructure on production deployment) MUST be confirmed before
    or as part of the PROD promotion gate.

## Recommended Practices

- SHOULD automate dependency upgrade proposals (e.g., a scheduled bot PR)
  so upgrades are reviewed regularly in small increments rather than
  accumulating into a large, risky batch upgrade.
- SHOULD keep CI pipeline definitions cloud-neutral (avoid hardcoding a
  specific cloud provider's CLI/SDK in the pipeline definition itself where
  the same gate could run identically anywhere).
- MAY use a monorepo build-graph tool to avoid rebuilding/retesting
  unaffected packages on every change, provided gate coverage is not
  weakened as a result.

## Examples

```toml
# pyproject.toml — PEP 621 metadata, PEP 440 version, bounded dependency range
[project]
name = "pytiq-orders-connector"
version = "2.3.1"
requires-python = ">=3.11"
dependencies = [
    "httpx>=0.27,<1.0",
    "pydantic>=2.6,<3.0",
]

[tool.ruff]
line-length = 100

[tool.mypy]
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## Testing / Validation

CI gates listed above ARE the testing/validation mechanism for this
standard. A new PyTIQ project's CI configuration MUST be reviewed against
the Mandatory Rules above (gate order, blocking behavior, scanning) before
being considered compliant.

## Security Considerations

Dependency and secret scanning gates (rules 7, 9) are this document's
primary intersection with `SECURITY_AND_PII_STANDARDS.md`; credential
handling itself is defined there, not here.

## Review Checklist

- [ ] `pyproject.toml` declares metadata per PEP 621; no legacy `setup.py`-only config.
- [ ] Versions follow SemVer expressed as PEP 440 identifiers.
- [ ] A lock file is committed for deployable applications; libraries declare compatible ranges, not exact pins.
- [ ] Dependency vulnerability scanning and secret scanning are blocking CI gates on every shared-repo merge (unconditional).
- [ ] Formatting, linting, type-checking, and tests are blocking gates for production/shared code (advisory is acceptable for a not-yet-productionized prototype branch).
- [ ] One versioned artifact is built and promoted unchanged across environments — where the workload is deployed as a scheduled/production pipeline.
- [ ] Environment-specific behavior comes from configuration, not artifact rebuilds — where more than one environment exists.
- [ ] Infrastructure changes are versioned separately from application code — where infrastructure is provisioned at all.
- [ ] Schema migrations are forward-compatible for at least one deployment cycle — where schema migrations exist.
- [ ] A tested rollback procedure exists for every release — where production-deployed.
- [ ] Post-deployment health checks/smoke tests gate promotion to the next environment — where multi-environment promotion exists.
- [ ] Release notes document breaking changes to interfaces/contracts.
- [ ] PROD promotion requires an explicit, documented approval gate — where a PROD environment exists.

## Related Standards

- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — the tooling (Ruff, mypy, pytest) wired into these CI gates.
- [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) — versioning/deprecation semantics this document's PEP 440 versions encode.
- [CONFIGURATION_STANDARDS.md](CONFIGURATION_STANDARDS.md) — environment-specific configuration applied to promoted artifacts.
- [DATA_CONTRACT_STANDARDS.md](DATA_CONTRACT_STANDARDS.md) — breaking-change classification referenced in release notes.
- [OBSERVABILITY_STANDARDS.md](OBSERVABILITY_STANDARDS.md) — observability readiness required before PROD promotion.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — dependency/secret scanning gate rationale.
