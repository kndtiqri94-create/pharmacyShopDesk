# Source Connector Standards

## Purpose

Defines the common contract every PyTIQ source connector MUST implement, and
the category-specific rules for REST/GraphQL APIs, relational/NoSQL
databases, and files/object storage. This is one of PyTIQ's most critical
standards: connectors are the boundary between PyTIQ and every external
system it reads from, and are the most common place vendor coupling leaks
into business logic if this contract is not enforced.

## Scope

Covers extraction only. A source connector MUST NOT contain business
transformation logic (see `TRANSFORMATION_STANDARDS.md`) or destination
concerns (see `SINK_CONNECTOR_STANDARDS.md`). Covers REST APIs, GraphQL,
relational databases, NoSQL databases, files, object storage, SaaS systems,
queues, event systems, and streaming systems at the level of a shared
contract plus category-specific extraction mechanics.

## Referenced Standards

- [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585) (HTTP `429 Too Many
  Requests`) and the `Retry-After` header semantics in
  [RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3) —
  adopted for API rate-limit handling.
- General idempotency/error-boundary principles from
  [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md).

## Principles

- A connector's only job is to get data out of a source system and into a
  PyTIQ-shaped record stream — reliably, incrementally when possible, and
  without leaking vendor SDK types past its boundary.
- Extraction failure modes (auth, rate limit, transient network, schema
  surprise) are connector concerns; what to do with a bad record downstream
  is a pipeline/DQ concern.

## Connector Contract

PyTIQ has **one** source connector architectural model — not a "simple"
function-based style and a separate "enterprise" class-based style. Every
connector, from a local CSV reader to a CDC-consuming database connector,
shares the same core contract. What differs between a trivial connector and
an enterprise one is which **optional capabilities** it declares — never
the shape of the abstraction itself.

### Core contract (mandatory for every connector, every category)

1. **Initialization** — construct with typed configuration (see
   `CONFIGURATION_STANDARDS.md`) and, when the source requires
   authentication, an injected credential/secret provider (see
   `SECURITY_AND_PII_STANDARDS.md`). MUST NOT perform network I/O in
   `__init__`.
2. **Extraction** — one or more `extract(...) -> Iterator[Record]` methods
   per supported mode (see Extraction Modes below), returning a lazily
   consumed stream rather than a fully materialized list whenever the
   source's size is not known to be small and bounded (see
   `PERFORMANCE_AND_SCALE_STANDARDS.md`).
3. **Cleanup** — MUST be implemented, via a context manager
   (`__enter__`/`__exit__` or `__aenter__`/`__aexit__`; see
   `PYTHON_STANDARDS.md` rules 20–21), **whenever the connector acquires a
   releasable resource** (a connection, session, cursor, or a file handle
   held open across multiple calls). A connector that acquires no
   releasable resource beyond a single `with open(...)` already scoped
   inside `extract()` (e.g., one local file read start-to-finish) is not
   required to implement an empty context-manager pair merely to satisfy
   this item — the obligation is to release what is actually held open,
   never ceremony over nothing.

### Optional capabilities (declared, never faked)

A connector declares which of the capabilities below it supports by
implementing the corresponding `Protocol` (see `PYTHON_STANDARDS.md` rule 6)
and advertising support through an explicit, inspectable declaration (e.g.,
a `capabilities: frozenset[ConnectorCapability]` class attribute), so a
caller can query support (`ConnectorCapability.SCHEMA_DISCOVERY in
connector.capabilities`) instead of calling a method that may not
meaningfully exist. **A connector MUST NOT implement a capability method as
a meaningless no-op** (`return None`, `pass`, a hardcoded "not supported"
placeholder) solely to satisfy an interface shape — if a capability is
genuinely unsupported by the underlying source, the connector simply does
not implement that `Protocol` and does not list it in `capabilities`. The
absence of a capability is expressed structurally (the Protocol isn't
implemented), not behaviorally (a method that runs and does nothing).

| Capability | `Protocol` | Mandatory when |
|---|---|---|
| **Connectivity check** — `test_connection() -> ConnectionCheck` | `SupportsConnectivityCheck` | The source is a remote/networked system (REST/GraphQL API, database, SaaS, queue, streaming system) where reachability and authentication can fail independently of extraction. A connector over a local/static file source MAY omit this — there is no remote endpoint to check. |
| **Schema/metadata discovery** — `discover_schema() -> Schema` | `SupportsSchemaDiscovery` | The source itself exposes schema discovery, or the source's schema can evolve independently of the pipeline (see `DATA_ENGINEERING_STANDARDS.md` rule 14). A connector over a fixed, known-stable schema MAY omit this. |
| **Incremental/checkpointed extraction** — `extract_incremental(cursor) -> Iterator[Record]` plus checkpoint persistence | `SupportsIncrementalExtraction` | The connector supports or performs repeated/incremental ingestion (see Incremental State below). A connector that only ever performs a single, one-shot full extraction MAY omit this. |

**Remote/networked connectors MUST implement `SupportsConnectivityCheck`**
and MUST validate authentication as part of that check — this is not
optional once a network boundary exists, even though it is optional for a
local file source. See APIs / Databases below for the concrete validation
requirements those categories must meet.

### Mandatory principles

1. A source connector MUST focus on extraction concerns only.
2. A source connector MUST NOT contain unrelated business transformation
   logic (renaming, filtering, deriving values) — pass raw/typed records
   through to the staging layer for `TRANSFORMATION_STANDARDS.md` to handle.
3. Vendor SDK types and vendor-specific exceptions MUST remain inside the
   connector; the connector MUST translate them into PyTIQ record types and
   PyTIQ exception types before returning/raising past its boundary (see
   `PYTHON_STANDARDS.md` rule 23 for the shared/reusable-code scoping of
   this translation).
4. Secrets MUST NOT be logged, including in exception messages, debug logs,
   or repr() output of config/request objects. This rule is unconditional —
   it applies even to a connector with no other mandatory capability.
5. Raw sensitive payloads SHOULD NOT be logged at any level above `DEBUG`,
   and MUST NOT be logged at all when they contain data classified as
   restricted per `SECURITY_AND_PII_STANDARDS.md`.
6. Extraction metrics (records read, bytes read, retries, duration) MUST be
   emitted per `OBSERVABILITY_STANDARDS.md` **when the connector is
   production-deployed or otherwise monitored**. SHOULD be emitted
   otherwise (e.g., a simple log line) — the marginal cost is low even for
   a one-off script.
7. Resources MUST be closed/released deterministically, including on the
   exception path, whenever the connector acquires them (see Core contract
   item 3) — this rule is unconditional wherever a resource is actually
   held open.

## Extraction Modes

A connector MUST explicitly declare which modes it supports; a mode MUST NOT
be implied by convention.

| Mode | Description | Required for |
|---|---|---|
| **Full** | Extract the entire current dataset. | All connectors, as a baseline/fallback. |
| **Incremental** | Extract only records changed/created since the last watermark. | Any source large enough that full extraction is not viable per run cadence. |
| **Snapshot** | Extract a point-in-time full copy, distinct from "full" in that it is intentionally repeated on a schedule to detect drift/deletes via diffing. | Sources with no reliable change-tracking mechanism. |
| **CDC** | Consume a change stream (log-based or trigger-based) with insert/update/delete semantics and ordering. | Sources exposing a native CDC mechanism (e.g., DB replication log, CDC-enabled SaaS webhook stream). |
| **Streaming** | Continuous consumption from a queue/topic. | Queue/event/streaming sources. |

**Full** is the baseline every connector supports. Incremental, snapshot,
CDC, and streaming modes apply only to connectors that declare
`SupportsIncrementalExtraction` (see Connector Contract above) — a
connector performing a single one-shot extraction implements Full only and
is fully compliant.

## Incremental State

Applies only to connectors declaring `SupportsIncrementalExtraction`. A
connector that only ever performs a single full extraction has no state to
manage and is exempt from this section.

- Incremental extraction MUST track its position using one of: a
  **watermark** (timestamp-based), a **cursor** (opaque, source-provided
  pagination/change token), a **sequence number**, or a **CDC checkpoint**
  (LSN/offset).
- State MUST be persisted through the pipeline's watermark/checkpoint store
  (see `DATA_ENGINEERING_STANDARDS.md` → State management), not held only in
  connector-instance memory.
- On recovery from a crash, the connector MUST resume from the last
  **committed** state, never from an assumed or reconstructed state.
- A connector MUST document whether its incremental mode can miss records
  under clock skew or eventual consistency (e.g., a source that indexes
  `updated_at` with replication lag), and MUST support a configurable
  lookback/overlap window to mitigate it.

## APIs (REST / GraphQL / SaaS)

Applies to any connector over a REST/GraphQL/SaaS source. These are, by
definition, remote/networked sources — per the Connector Contract's
capability table, such connectors MUST implement `SupportsConnectivityCheck`
with real authentication validation; none of the rules below are optional
for this category.

- **Pagination**: the connector MUST implement the source's actual
  pagination mechanism (cursor-based preferred when available; offset/page
  as a fallback) to completion — a connector MUST NOT silently stop after
  the first page.
- **Rate limiting**: the connector MUST respect `Retry-After` /
  rate-limit-remaining headers when present, and MUST implement client-side
  throttling (e.g., a token bucket) when the source has known limits but no
  reactive header.
- **Retries**: retries MUST use exponential backoff with jitter, and MUST
  only apply to retryable failures (network errors, `408`, `429`, `5xx`) —
  never to `4xx` errors indicating a client-side/programmer error (`400`,
  `401`, `403`, `404`, `422`), which MUST fail fast.
- **Timeouts**: every HTTP call MUST have an explicit connect and read
  timeout; a connector MUST NOT rely on a library's default (which may be
  "no timeout").
- **HTTP status classification**: the connector MUST classify statuses into
  retryable, auth-failure (trigger token refresh, then retry once),
  client-error (fail fast, no retry), and success — this classification
  MUST be centralized, not duplicated per call site.
- **Authentication refresh**: token-based auth (OAuth2, JWT) MUST refresh
  proactively before expiry or reactively on a single `401`, then retry
  once; a second consecutive `401` after refresh MUST fail fast, not loop.
- **API versioning**: the connector MUST pin an explicit API version
  (URL path, header, or query param per the source's convention) rather than
  floating to "whatever is latest" implicitly.
- **Partial responses / response validation**: the connector MUST validate
  that a response contains the expected shape (via a typed model — see
  `PYTHON_STANDARDS.md` rule 10) before yielding records, and MUST raise a
  classified error rather than yielding partially-parsed/garbage records.

## Databases (Relational / NoSQL)

Applies to any connector over a relational or NoSQL database. Like APIs,
these are remote/networked sources — `SupportsConnectivityCheck` with real
authentication validation is mandatory, not optional, for this category.

- Queries MUST be parameterized; string-built SQL/query bodies from
  untrusted or config-supplied input MUST NOT be used (SQL injection
  boundary — see `SECURITY_AND_PII_STANDARDS.md`).
- Connections MUST be pooled and released via context managers; a
  connector MUST NOT open a new unpooled connection per record or per page.
- Large-table extraction MUST use server-side cursors / keyset pagination
  and an explicit fetch size — MUST NOT load an entire result set into
  memory (see `PERFORMANCE_AND_SCALE_STANDARDS.md`).
- The connector SHOULD be aware of and MUST document the transaction
  isolation level it reads under, since this affects whether concurrent
  writes are visible mid-extraction.
- Incremental predicates (e.g., `WHERE updated_at > :watermark`) MUST be
  pushed down to the database, not applied by filtering a full table scan
  in Python.
- Column selection MUST be explicit (`SELECT` named columns) rather than
  `SELECT *`, so that upstream schema additions do not silently flow
  through unexamined, and drift in expected columns is detectable.

## Files / Object Storage

- File discovery MUST use an explicit, documented pattern (glob, prefix,
  manifest file) — MUST NOT assume "every file in the bucket" — **when the
  connector reads from a location holding more than one candidate file**. A
  connector reading one explicitly named file has nothing to discover.
- **When the connector runs repeatedly against a source location that
  accumulates new files over time** (e.g., an inbox/drop folder), it MUST
  record and check processed-file state (a manifest or checkpoint of
  already-ingested file identifiers/checksums) so reruns do not reprocess
  or skip files incorrectly — this is the file/object-storage instance of
  `SupportsIncrementalExtraction` (see Connector Contract above). A
  one-shot conversion of a single, explicitly named file has no repeated-run
  state to track and is exempt.
- Encoding, delimiter, and compression MUST be explicit configuration, not
  auto-detected silently in a way that can misparse a file without error.
- A corrupt or unparseable file MUST be routed to a quarantine/dead-letter
  location with the failure reason, and MUST NOT abort extraction of other,
  valid files in the same batch unless the pipeline's failure policy
  requires strict all-or-nothing semantics.
- Partition discovery (e.g., `year=2026/month=08/day=18/` layouts) MUST be
  driven by an explicit partition scheme, not inferred by best-effort
  string parsing of arbitrary paths.

## Examples

```python
# Bad — pagination silently stops after page 1; secrets logged
def extract(self) -> list[dict]:
    logger.info("Requesting %s", self._config)  # leaks api_key in config repr
    response = requests.get(self._url, headers=self._auth_headers())
    return response.json()["items"]

# Good — full pagination, no secret leakage, typed records
def extract(self, *, since: Cursor | None = None) -> Iterator[OrderRecord]:
    cursor = since
    while True:
        page = self._client.get_orders(cursor=cursor, timeout=self._timeout)
        for raw in page.items:
            yield OrderRecord.model_validate(raw)
        if page.next_cursor is None:
            return
        cursor = page.next_cursor
```

## Testing / Validation

See `TESTING_STANDARDS.md` → source connector tests. At minimum: pagination
completeness, retry-on-retryable/fail-fast-on-client-error classification,
timeout configuration, checkpoint/recovery determinism, and a test proving no
secret value appears in any log record emitted during a failure path.

## Security Considerations

Credentials MUST be obtained through the `SecretProvider` boundary defined in
`SECURITY_AND_PII_STANDARDS.md`, never embedded in connector config files or
source code. See that document for full secret-handling and PII rules.

## Review Checklist

- [ ] Authentication is externalized via a secret provider, not embedded in config/code (where the source requires authentication).
- [ ] No secrets are logged, including in exception messages and object reprs.
- [ ] The connector's declared `capabilities` accurately reflect what it supports; unsupported capabilities are absent, not faked with no-op methods.
- [ ] Remote/networked connectors (API, database, SaaS, queue, streaming) implement `SupportsConnectivityCheck` with real authentication validation.
- [ ] Full/incremental (and CDC/streaming, if applicable) behavior is explicit and documented.
- [ ] Pagination runs to completion (API/GraphQL/SaaS connectors).
- [ ] Retries target retryable failures only; client errors fail fast (remote/networked connectors).
- [ ] Timeouts are configured on every network call (remote/networked connectors).
- [ ] Checkpoint/watermark recovery is deterministic and resumes from committed state (connectors declaring `SupportsIncrementalExtraction`).
- [ ] Large responses/result sets are not unnecessarily loaded fully into memory.
- [ ] Extraction metrics are emitted (mandatory when production-deployed/monitored; SHOULD otherwise).
- [ ] Resources (connections, sessions, cursors, files) are released correctly, including on failure, wherever the connector acquires them.
- [ ] Business transformations are not embedded in the source connector.
- [ ] Failure and recovery paths are tested.

## Related Standards

- [DATA_ENGINEERING_STANDARDS.md](DATA_ENGINEERING_STANDARDS.md) — pipeline-level state, restartability, and schema-drift handling this connector's state feeds into.
- [SECURITY_AND_PII_STANDARDS.md](SECURITY_AND_PII_STANDARDS.md) — secret provider boundary and log redaction rules.
- [DATA_QUALITY_STANDARDS.md](DATA_QUALITY_STANDARDS.md) — where malformed/quarantined records are validated and routed after extraction.
- [PERFORMANCE_AND_SCALE_STANDARDS.md](PERFORMANCE_AND_SCALE_STANDARDS.md) — streaming/chunked extraction and memory rules.
- [OBSERVABILITY_STANDARDS.md](OBSERVABILITY_STANDARDS.md) — required extraction metrics schema.
