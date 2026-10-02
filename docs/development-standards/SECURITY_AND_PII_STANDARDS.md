# Security and PII Standards

## Purpose

Defines PyTIQ's Data Engineering-specific security rules: identity and
secret management, encryption, environment separation, and how sensitive
data (PII and other restricted data) is classified, minimized, masked, and
protected across the pipeline lifecycle.

## Scope

Covers security and privacy concerns specific to data pipelines. General
application security concerns not specific to DE (e.g., dependency CVE
scanning) are covered in `DEPLOYMENT_STANDARDS.md`; static security lint
rules are covered in `PYTHON_STANDARDS.md` → Tooling.

## Referenced Standards

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) — referenced as
  general secure-coding vocabulary (injection, broken access control) where
  applicable to pipeline code (e.g., SQL injection in source connectors).
- Cloud-neutral: this document does not mandate Azure Key Vault, AWS Secrets
  Manager, or GCP Secret Manager specifically — see the `SecretProvider`
  abstraction below.

## Principles

- Least privilege and identity-based access are the default, not an
  afterthought retrofitted before a compliance audit.
- Production sensitive data does not casually travel to lower environments;
  every path it takes must be a deliberate, reviewed decision.
- **This document is exempt from the general Proportionality principle in
  `ENGINEERING_STANDARDS.md`.** Its rules apply whenever their stated
  condition is true — credentials exist, PII/sensitive data is present,
  or production data is involved — regardless of pipeline size or
  simplicity. A trivial CSV → Parquet script with no credentials and no
  sensitive fields satisfies these rules vacuously (there is nothing to
  protect); the moment either condition becomes true, every applicable
  rule below is mandatory without exception.

## Mandatory Rules

### Identity, secrets, and access

1. Credentials for source/sink connectors MUST be obtained through a
   `SecretProvider` abstraction (see Architecture below), never embedded in
   source code, committed configuration files, or connector constructor
   defaults.
2. Where the target platform supports it, connectors SHOULD authenticate
   using managed/workload identity rather than long-lived static
   credentials; static credentials MUST be justified when used (e.g., a
   third-party SaaS API with no identity-federation option) and MUST be
   rotated per a documented schedule.
3. Credentials MUST NOT be logged, printed, or included in exception
   messages, `repr()` output of configuration objects, or serialized debug
   dumps — see `SOURCE_CONNECTOR_STANDARDS.md` / `SINK_CONNECTOR_STANDARDS.md`
   for the connector-specific version of this rule.
4. Access to secrets MUST follow least privilege: a pipeline component MUST
   request only the specific secret(s) it needs, not a broad credential
   granting access to unrelated systems.
5. Role separation MUST be maintained between environments and between
   read/write access levels — a read-only source connector MUST NOT be
   provisioned with write credentials to that source "for convenience."
6. All access to secret stores and to production data MUST be auditable
   (who/what accessed which secret/dataset, when) — either through the
   platform's native audit logging or through PyTIQ's own access logging
   where the platform does not provide it.

### Encryption and transport

7. All network communication with source/sink systems MUST use TLS; a
   connector MUST NOT default to an unencrypted transport, and MUST fail
   fast (not silently downgrade) if TLS negotiation fails.
8. Data classified as restricted (see Classification below) MUST be
   encrypted at rest at the destination, using the destination platform's
   encryption-at-rest capability at minimum, with customer-managed keys
   where the platform and compliance requirement call for it.

### Environment separation

9. DEV, QA, and PROD credentials, secret stores, and data locations MUST be
   fully separated — a DEV pipeline configuration MUST NOT be able to
   resolve a PROD secret or write to a PROD dataset location, by
   construction (distinct secret namespaces/vaults per environment), not by
   convention alone (see `CONFIGURATION_STANDARDS.md`).
10. Promoting a pipeline from one environment to another MUST NOT carry
    production credentials or production data along with it implicitly.

### PII and sensitive-data classification

11. **When a workload processes sensitive/PII data**, every field in its
    data contract MUST carry an explicit sensitivity classification (see
    `DATA_CONTRACT_STANDARDS.md`) from a documented, closed taxonomy — at
    minimum: **public**, **internal**, **confidential**, **restricted/PII**.
    A field's classification MUST NOT default to "not classified" — an
    unclassified field in a workload known to touch sensitive data MUST be
    treated as restricted until explicitly classified. A workload with no
    sensitive data (e.g., anonymous numeric sensor readings) has no fields
    requiring this classification.
12. **When a workload processes sensitive/PII data**, PII fields MUST be
    identified at ingestion time (in the source connector's schema
    discovery, where implemented, or the first stage's contract), not
    discovered incidentally downstream.
13. Data minimization: a pipeline MUST NOT extract, transform, or persist
    PII/restricted fields it does not have a documented business need for.
    Extracting "everything the source returns, just in case" is prohibited
    for restricted fields.

### Masking, tokenization, hashing, and logs

14. Restricted/PII fields MUST NOT appear in logs at any level — this
    includes error messages, stack traces (via exception chaining, ensure
    the raw record is not attached to the exception in a way that gets
    logged), and debug output.
15. Where a restricted field's value is needed for joining/deduplication
    but not for direct display, it MUST be tokenized or hashed
    (see `TRANSFORMATION_STANDARDS.md` rule 17 for hash-key mechanics)
    rather than carried in plaintext further than necessary.
16. Masking rules (partial redaction, format-preserving masking) MUST be
    applied consistently per field across every pipeline that touches that
    field — masking logic MUST be a shared, tested utility, not
    reimplemented ad hoc per pipeline.

### Test/sample data and production access

17. Production PII MUST NOT be copied into development, test, or staging
    environments or fixtures without an explicit, documented, and approved
    exception (e.g., a signed-off, time-boxed data-sharing agreement).
18. Test and sample data MUST be synthetic by default (see
    `TESTING_STANDARDS.md`). Where a realistic data *shape* is required for
    a bug reproduction, restricted fields MUST be masked/synthesized before
    use outside production.
19. Ad hoc production data access (a developer querying PROD directly for
    debugging) MUST go through an audited access path and MUST NOT bypass
    the access controls that would otherwise apply to a pipeline's service
    identity.

### Retention, deletion, exports, temp files

20. Retention periods (see `DATA_ENGINEERING_STANDARDS.md` rule 22) for
    restricted/PII data MUST be no longer than the documented legal/business
    justification requires, and MUST have an enforceable deletion mechanism
    reaching every copy (raw, staging, curated, cache) — a deletion request
    MUST NOT be satisfiable only in the serving layer while raw copies
    persist indefinitely.
21. Temporary files created during processing (spill files, decompressed
    payloads) that contain restricted data MUST be written to a location
    with access controls equivalent to the source, MUST use secure
    permissions, and MUST be deleted deterministically (via a context
    manager/`finally`, not "the OS will clean `/tmp` eventually").
22. Exports of restricted data (to a file, an API response, a third-party
    system) MUST be classified and approved per the same rules as the
    source data — an export path MUST NOT be treated as exempt from
    classification rules just because it is not a full pipeline sink.

## Recommended Practices

- SHOULD implement secret-provider abstractions behind a shared `Protocol`
  so cloud-specific implementations (`AzureKeyVaultSecretProvider`,
  `AwsSecretsManagerProvider`, `GcpSecretManagerProvider`) are
  interchangeable where portability is a real requirement — conceptual
  design only; do not implement these concrete classes speculatively (see
  `ENGINEERING_STANDARDS.md` rule 12).
- SHOULD run dependency and static-security scanning (see
  `PYTHON_STANDARDS.md` → Tooling) as part of every merge, not only
  periodically.
- MAY use format-preserving tokenization for restricted fields that must
  remain joinable across systems without being reversible by unauthorized
  parties.

## Architecture / Structure

```text
SecretProvider (Protocol)
    ├── AzureKeyVaultSecretProvider   (conceptual — not implemented in this task)
    ├── AwsSecretsManagerProvider     (conceptual — not implemented in this task)
    └── GcpSecretManagerProvider      (conceptual — not implemented in this task)
```

Connectors and sinks depend on the `SecretProvider` `Protocol`, never on a
concrete cloud SDK, keeping credential resolution portable and testable
(inject a fake `SecretProvider` in unit tests).

## Testing / Validation

Security-relevant behavior MUST be tested: a test proving no secret value
appears in any log output on a simulated failure path (see
`SOURCE_CONNECTOR_STANDARDS.md` / `SINK_CONNECTOR_STANDARDS.md` review
checklists), and a test proving masking/classification is applied to every
field marked restricted in the relevant data contract.

## Security Considerations

This entire document is a security-considerations document; see
`DATA_CONTRACT_STANDARDS.md` for where classification is declared and
`DATA_ENGINEERING_STANDARDS.md` for environment-separation architecture.

## Review Checklist

- [ ] Credentials are obtained via a `SecretProvider` abstraction, not embedded in code/config.
- [ ] No credential or restricted-data value appears in logs, exceptions, or debug output.
- [ ] Managed/workload identity is used where the platform supports it; static credentials are justified and rotated.
- [ ] DEV/QA/PROD secrets and data locations are fully separated by construction.
- [ ] Every data contract field has an explicit sensitivity classification; none default to "unclassified."
- [ ] PII fields are identified at ingestion, not discovered downstream.
- [ ] Only fields with a documented business need are extracted/retained.
- [ ] Masking/tokenization/hashing is applied via shared, tested utilities, consistently across pipelines.
- [ ] Test/sample data is synthetic by default; no unapproved production PII in non-PROD environments.
- [ ] Retention and deletion mechanisms reach every copy of the data, not just the serving layer.
- [ ] Temporary files containing restricted data are access-controlled and deterministically deleted.

## Related Standards

- [DATA_CONTRACT_STANDARDS.md](DATA_CONTRACT_STANDARDS.md) — where PII classification is declared per field.
- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — environment separation and retention architecture.
- [SOURCE_CONNECTOR_STANDARDS.md](SOURCE_CONNECTOR_STANDARDS.md) / [SINK_CONNECTOR_STANDARDS.md](SINK_CONNECTOR_STANDARDS.md) — connector-specific credential and log-redaction rules.
- [CONFIGURATION_STANDARDS.md](CONFIGURATION_STANDARDS.md) — how secrets are kept out of ordinary configuration.
- [TESTING_STANDARDS.md](TESTING_STANDARDS.md) — synthetic test data requirements.
