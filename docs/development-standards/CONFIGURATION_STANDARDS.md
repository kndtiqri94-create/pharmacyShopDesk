# Configuration Standards

## Purpose

Defines how PyTIQ components are configured: typed configuration models,
startup validation, environment separation, precedence between
configuration sources, and the boundary between ordinary configuration and
secrets.

## Scope

Covers configuration access patterns for connectors, sinks, pipelines, and
runtime components. Secret storage/access mechanics are owned by
`SECURITY_AND_PII_STANDARDS.md`; this document owns keeping secrets *out* of
ordinary configuration and the typed-access pattern around both.

## Referenced Standards

Builds on [PEP 484](https://peps.python.org/pep-0484/)/
[PEP 526](https://peps.python.org/pep-0526/) typing conventions from
`PYTHON_STANDARDS.md`; typed settings MUST use the same modern typing rules
as any other PyTIQ code.

## Principles

- Configuration is data, not code — a pipeline's behavior for a given
  environment should be fully determined by its configuration values, never
  by branching on "which environment am I in" scattered through business
  logic.
- A misconfigured component should fail at startup, loudly, not at the
  first record it tries to process three stages downstream.
- Per `ENGINEERING_STANDARDS.md`'s Proportionality principle, the structural
  rules below (typed models, separated config domains, environment overlays)
  scale to the actual configuration surface — a two-argument script does
  not need a Pydantic settings hierarchy. What remains unconditional: a
  secret value MUST NOT be embedded as a literal in configuration
  regardless of how simple the pipeline is (see `SECURITY_AND_PII_STANDARDS.md`).

## Mandatory Rules

### Typed configuration and validation

1. A connector, sink, or pipeline component SHOULD accept its configuration
   as a typed model (a Pydantic model or equivalent validating dataclass —
   see `PYTHON_STANDARDS.md` rule 10) rather than a raw `dict` or loose
   keyword arguments pulled ad hoc from environment variables. This becomes
   a MUST **once the component's configuration surface exceeds a handful of
   simple values, is reused across more than one pipeline, or is
   production-deployed** — at that point untyped config is a correctness
   risk, not a convenience. A two- or three-argument simple script (e.g.,
   `input_path`, `output_path`) MAY take plain typed function parameters
   instead of a settings class.
2. Configuration MUST be validated at startup/construction time — required
   fields missing, values out of range, or an invalid enum value MUST raise
   immediately with a clear error identifying the offending field, not
   surface later as a confusing runtime failure mid-pipeline.
3. Required vs. optional settings MUST be explicit in the typed model
   (required fields have no default; optional fields have an explicit,
   documented default) — a setting MUST NOT be "optional in practice because
   the code happens to handle `None`" without that being the declared type.
4. Configuration models MUST document, per field, what the field controls
   and, where non-obvious, its unit (seconds vs. milliseconds, MB vs. rows).

### Environment separation and overrides

5. **When a pipeline's configuration surface is large enough that mixing
   concerns would create ambiguity** (typically once more than one
   connector, schedule, and DQ threshold set are involved), configuration
   MUST distinguish connector config (how to reach a specific source/sink),
   pipeline config (stage wiring, schedule, DQ thresholds), and runtime
   config (log level, concurrency, feature flags) as separate concerns — not
   one flat, undifferentiated settings blob. A simple, single-connector
   pipeline MAY keep all configuration in one small typed object.
6. **When more than one environment exists** (e.g., DEV/QA/PROD),
   configuration MUST be separated by distinct configuration sets (files,
   environment-specific overlays, or environment-scoped secret namespaces),
   never by an `if environment == "prod"` branch inside business or
   connector logic. This rule does not apply to a single-environment local
   workload, but is mandatory the moment a second environment exists.
7. Configuration precedence MUST be explicit and documented per project
   (e.g., environment variable overrides file default overrides code
   default); the precedence order MUST be the same across every component
   in a given PyTIQ project, not decided ad hoc per module.
8. No PyTIQ component MUST depend on an undeclared, implicit environment
   assumption (a specific working directory, an environment variable that
   is not part of the component's declared configuration schema, a hardcoded
   hostname).

### Secrets vs. configuration

9. Secret values (credentials, API keys, connection strings with embedded
   passwords) MUST NOT be stored in ordinary configuration files, and MUST
   NOT have literal default values in a typed configuration model — a
   secret field's type MUST require it to be resolved through the
   `SecretProvider` boundary from `SECURITY_AND_PII_STANDARDS.md` at
   startup, not embedded as config.
10. Configuration MUST NOT contain hardcoded network endpoints for anything
    that varies by environment (hostnames, connection strings without
    secrets) — these MUST be environment-specific configuration values, not
    literals in code.

### Versioning and immutability

11. Pipeline configuration (stage wiring, DQ thresholds, schedule) SHOULD be
    versioned alongside the code it configures (e.g., committed to the same
    repository) so a given pipeline run's configuration is reconstructable
    from source control history.
12. A loaded, validated configuration object SHOULD be treated as immutable
    for the lifetime of a run — components MUST NOT mutate shared
    configuration objects at runtime as a way to pass transient state
    between stages (use explicit parameters/return values instead).

## Recommended Practices

- SHOULD load configuration once at startup and inject the resolved typed
  object into components, rather than having each component independently
  re-read and re-validate configuration.
- SHOULD provide a `--dry-run`/validate-only mode for pipeline entry points
  that loads and validates configuration without executing any I/O, to
  catch misconfiguration in CI before a scheduled run.
- MAY support layered configuration (base + environment overlay) using a
  standard library or well-maintained third-party settings loader, provided
  the final resolved values are still validated through a typed model.

## Examples

```python
# Bad — untyped dict config, secret embedded as a default, no validation
def create_connector(config: dict = {"timeout": 30, "api_key": "changeme"}):
    ...

# Good — typed, validated config; secret resolved through SecretProvider
class OrdersApiConnectorConfig(BaseModel):
    base_url: HttpUrl
    timeout_seconds: float = Field(gt=0, default=30.0)
    page_size: int = Field(gt=0, le=1000, default=200)
    # No literal secret field/default here — resolved via SecretProvider.

def create_connector(
    config: OrdersApiConnectorConfig,
    secrets: SecretProvider,
) -> OrdersApiConnector:
    api_key = secrets.get_secret("orders_api_key")
    return OrdersApiConnector(config=config, api_key=api_key)
```

## Testing / Validation

Configuration models MUST be unit-tested for: missing-required-field
failure, out-of-range value failure, and correct resolution of documented
precedence order (e.g., env var overrides file default). See
`TESTING_STANDARDS.md` for the shared test-data rules that also apply to
configuration fixtures.

## Security Considerations

Secret resolution is owned by `SECURITY_AND_PII_STANDARDS.md`; this document
only defines the boundary that keeps secrets out of ordinary configuration
objects and files.

## Review Checklist

- [ ] Configuration is a typed model, not a raw dict or loose kwargs — required once the config surface, reuse, or production status warrants it; simple typed function parameters are acceptable for a trivial script.
- [ ] Required vs. optional fields are explicit; validation fails fast at startup with a clear error.
- [ ] Connector, pipeline, and runtime configuration are kept as separate concerns — where the configuration surface is large enough to need it.
- [ ] No environment branching (`if env == "prod"`) inside business/connector logic — where more than one environment exists.
- [ ] Configuration precedence is documented and consistent across components.
- [ ] No secret values or literal defaults for secret fields appear in configuration files/models.
- [ ] No hardcoded environment-specific endpoints in code.
- [ ] Pipeline configuration is versioned alongside the code it configures.

## Related Standards

- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — the `SecretProvider` boundary secret fields resolve through.
- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — typed model conventions (dataclass vs. Pydantic).
- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — environment separation at the data layer.
- [DEPLOYMENT_STANDARDS.md](DEPLOYMENT_STANDARDS.md) — how configuration is promoted across environments during deployment.
