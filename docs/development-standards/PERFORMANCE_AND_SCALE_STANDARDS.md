# Performance and Scale Standards

## Purpose

Defines PyTIQ's approach to memory-safe, scalable processing — the rules
that keep a pipeline correct and stable as data volume grows, without
forcing every workload onto heavyweight distributed infrastructure it does
not need.

## Scope

Covers processing-pattern rules applicable across connectors, sinks, and
transformations. Connector/sink-specific mechanics (fetch size, batch size)
are also referenced from their owning standards; this document is the
canonical source for the underlying principle.

## Referenced Standards

No single external standard governs this; PyTIQ's approach is informed by
standard streaming/iterator-based processing patterns widely used across
the Python data ecosystem (generators, chunked I/O), applied consistently.

## Principles

- **Never assume an input dataset fits entirely in memory unless it is
  actually known to be small and bounded.** This is the core mandatory
  rule of this document; every other rule below exists in service of it.
- Optimize based on evidence (a measured bottleneck, a stated SLA), not
  speculation — but never architect in a way that blocks scaling later
  when the workload does grow.
- Distributed processing (Spark, etc.) is a tool for a specific class of
  workload, not a default architecture.
- Per `ENGINEERING_STANDARDS.md`'s Proportionality principle, streaming
  infrastructure, explicit chunk-size configuration, and concurrency
  tuning are mandatory once data volume is actually unbounded or large. A
  known-small dataset (a reference table, a local CSV under a sane size
  threshold) may simply be loaded and processed directly — the memory-
  safety guarantee still holds, it is just trivially satisfied.

## Mandatory Rules

### Memory safety

1. A component reading from a source or writing to a sink MUST NOT
   materialize an entire dataset into memory (a full `list`, a
   fully-loaded `DataFrame`) **when the dataset's size is unbounded or not
   known to be small** — a documented, reasonable assumption that the data
   is small (e.g., "a reference table capped at 10,000 rows by business
   definition," or "this script converts one CSV export known to be a few
   MB") is sufficient justification and does not require a formal contract
   artifact; it simply must be a stated assumption, not an unexamined
   default.
2. **When a connector or sink handles data whose size is unbounded or not
   known to be small**, streaming reads and writes MUST use iterators/
   generators (`Iterator[Record]`, chunked reads) as the default shape (see
   `SOURCE_CONNECTOR_STANDARDS.md`, `SINK_CONNECTOR_STANDARDS.md`). A
   component handling a known-small, bounded dataset MAY use a simple,
   direct load (e.g., `pandas.read_csv` followed by `to_parquet`) without
   building streaming infrastructure.
3. **When a component streams/chunks data at all** (per rule 2), batch/chunk
   sizes (DB fetch size, HTTP page size, write batch size, file read chunk
   size) MUST be explicit, configurable values (see
   `CONFIGURATION_STANDARDS.md`) — MUST NOT be hardcoded magic numbers
   buried in implementation code. A component that loads its known-small
   input directly (per rule 1's exception) has no chunk size to configure.
4. Where in-memory buffering is used for batching, it MUST have a hard
   upper bound (row count or byte size) enforced in code, with an explicit
   flush/spill-to-disk path when the bound is reached — a buffer MUST NOT
   be allowed to grow unbounded based on input size alone.

### Processing patterns

5. Predicate pushdown MUST be used wherever the source system supports it
   (filter conditions applied at the source, not after loading full data
   into Python) — see `SOURCE_CONNECTOR_STANDARDS.md` → Databases.
6. Column pruning (selecting only needed columns) MUST be applied at
   extraction time wherever the source format/system supports partial
   column reads (columnar file formats, `SELECT` with named columns) rather
   than loading all columns and dropping unneeded ones in Python.
7. Partition pruning MUST be used when reading partitioned datasets —
   a read MUST NOT scan partitions outside its declared processing window
   when the partition scheme makes that window determinable in advance.
8. Row-by-row Python loops MUST NOT be used for operations expressible as
   vectorized/set-based operations in the dataframe/processing library in
   use (e.g., column arithmetic, `.map`/`.apply` alternatives, joins) —
   vectorized operations MUST be preferred for performance-sensitive
   transformation code.
9. Unnecessary copies of large in-memory structures (defensive
   `.copy()` calls on data that is not mutated, repeated
   materialization of the same intermediate result) SHOULD be avoided;
   where a copy is required for correctness (e.g., isolating a transform
   from mutating shared input), it MUST be documented as intentional.
10. Lazy evaluation (generator pipelines, or a dataframe library's native
    lazy/query-plan mode) SHOULD be preferred over eager evaluation for
    multi-step transformation chains over large data, so intermediate
    results are not unnecessarily materialized.

### Network, serialization, compression

11. Bulk operations (bulk insert/copy APIs, batched HTTP requests) MUST be
    used over per-record network round trips wherever the source/sink
    supports them (see `SINK_CONNECTOR_STANDARDS.md` rule 7).
12. Data transferred over the network in bulk SHOULD use compression where
    the source/sink and format support it and CPU cost is justified by the
    network savings; the choice MUST be documented, not incidental.
13. Serialization format choice (JSON vs. a binary/columnar format) MUST
    consider both the serialization/deserialization CPU cost and the
    network/storage volume for the expected data size — a format choice
    that is fine for a small reference table is not automatically fine for
    a high-volume fact table.

### Concurrency, parallelism, backpressure

14. Concurrent/parallel processing (async I/O, thread/process pools) MUST
    respect the destination and source's stated connection/rate limits —
    a component MUST NOT increase concurrency in a way that silently
    exceeds a documented API rate limit or database connection pool size
    (see `SOURCE_CONNECTOR_STANDARDS.md` → APIs, Databases).
15. A component consuming from a queue/stream faster than downstream can
    process MUST implement backpressure (bounded queues, pause/resume
    signaling) rather than allowing unbounded in-memory queuing.
16. Connection pool sizes MUST be explicit, configurable, and sized with
    the destination's documented connection limit in mind — not left at a
    library's arbitrary default without review.

### Distributed processing and scaling thresholds

17. A workload MUST NOT be forced onto a distributed processing engine
    (Spark or equivalent) by default — single-process, streaming/chunked
    processing is the default architecture; distributed processing is
    adopted when a measured or clearly anticipated data volume exceeds
    what single-process streaming can handle within the pipeline's SLA.
18. Where distributed processing is used, partition strategy MUST be
    chosen deliberately to avoid data skew (a small number of partitions
    receiving a disproportionate share of the data) — skew MUST be
    something the pipeline's design considered, not an unexamined
    consequence of an arbitrary partition key.
19. Architecture MUST NOT unnecessarily block future scaling: a
    single-process design today MUST still allow partitioning/parallelizing
    the workload later (e.g., by designing extraction/transformation as
    partition-addressable units) without a full rewrite, where growth is a
    realistic possibility for that dataset.

## Recommended Practices

- SHOULD benchmark before optimizing — a performance change MUST be
  justified by a measured bottleneck or a stated SLA/volume requirement,
  not intuition.
- SHOULD default to the simplest processing pattern (single-process
  streaming) that meets the current, known volume and SLA.
- MAY introduce parallelism within a single process (e.g., a bounded
  thread pool for I/O-bound connector calls) before reaching for a
  distributed engine.

## Examples

```python
# Bad — loads the entire table into memory regardless of size
def extract_all(connection) -> list[dict]:
    return connection.execute("SELECT * FROM orders").fetchall()

# Good — server-side cursor, explicit fetch size, generator output
def extract_all(connection, *, fetch_size: int = 5000) -> Iterator[OrderRow]:
    cursor = connection.execute(
        "SELECT order_id, customer_id, amount, status FROM orders"
    )
    while rows := cursor.fetchmany(fetch_size):
        for row in rows:
            yield OrderRow(*row)
```

```python
# Bad — row-by-row Python loop for a vectorizable operation
def apply_discount(df):
    for i in range(len(df)):
        df.loc[i, "final_price"] = df.loc[i, "price"] * (1 - df.loc[i, "discount"])
    return df

# Good — vectorized column operation
def apply_discount(df):
    df["final_price"] = df["price"] * (1 - df["discount"])
    return df
```

## Testing / Validation

See `TESTING_STANDARDS.md` → performance tests and large-data behavior
tests. Where a component has a stated memory or throughput bound, a test
SHOULD exercise it with a dataset large enough to prove the bound holds
(e.g., asserting peak memory stays roughly constant as input size grows,
using a streaming source fixture).

## Review Checklist

- [ ] No unbounded or not-known-to-be-small dataset is fully materialized in memory without a documented size assumption.
- [ ] Streaming/generator patterns are used for potentially large reads/writes; a direct load is acceptable only for a known-small, bounded dataset.
- [ ] Batch/chunk/fetch sizes are explicit configuration values, not hardcoded — where chunking is used at all.
- [ ] In-memory buffers have an enforced upper bound with a spill/flush path.
- [ ] Predicate and column pushdown/pruning are applied at the source where supported.
- [ ] Vectorized operations are used instead of row-by-row Python loops where applicable.
- [ ] Bulk write/read APIs are used over per-record round trips where supported.
- [ ] Concurrency respects documented source/sink rate and connection limits.
- [ ] Distributed processing is adopted only where volume/SLA justify it, with a deliberate partition strategy avoiding skew.

## Related Standards

- [SOURCE_CONNECTOR_STANDARDS.md](SOURCE_CONNECTOR_STANDARDS.md) — connector-level fetch size, pagination, and streaming rules.
- [SINK_CONNECTOR_STANDARDS.md](SINK_CONNECTOR_STANDARDS.md) — sink-level batching and bulk write rules.
- [PYTHON_STANDARDS.md](PYTHON_STANDARDS.md) — generator/iterator language rules (rule 19) this document builds on.
- [CONFIGURATION_STANDARDS.md](CONFIGURATION_STANDARDS.md) — where batch/chunk size configuration values are declared.
