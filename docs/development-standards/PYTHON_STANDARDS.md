# Python Standards

## Purpose

Defines PyTIQ's Python language baseline: supported versions, PEP alignment,
typing discipline, language-feature conventions, and the tooling baseline
(formatter, linter, type checker, test runner). This is the concrete
implementation, in Python, of the principles in
[ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md).

## Scope

Applies to all Python source in PyTIQ: connectors, sinks, transformations,
shared libraries, orchestration glue, and tests. Packaging/CI mechanics are
defined in [DEPLOYMENT_STANDARDS.md](DEPLOYMENT_STANDARDS.md); this document
covers only the `pyproject.toml` sections that configure language tooling.

## Referenced Standards

See `ENGINEERING_STANDARDS.md`'s Proportionality principle (rule 21) for how
to read the MUST rules below: a rule with an explicit applicability
trigger applies only once that condition holds; typing, style, and
tooling rules in this document carry no such trigger and are therefore
low-cost, universal baselines (typing costs the same whether a script is 5
lines or 5,000) — they are not weakened by workload size.

PyTIQ Python code MUST follow the PEPs below unless a rule in this document
explicitly overrides one, in which case the override, and its rationale, is
stated next to the PEP.

| PEP | Title | PyTIQ alignment |
|---|---|---|
| [PEP 8](https://peps.python.org/pep-0008/) | Style Guide for Python Code | Adopted. Enforced by the automated formatter/linter (see Tooling), never manually debated in review. |
| [PEP 257](https://peps.python.org/pep-0257/) | Docstring Conventions | Adopted for structure (summary line, blank line, body). PyTIQ additionally requires Google-style sections (`Args`, `Returns`, `Raises`) — see Docstrings below. |
| [PEP 440](https://peps.python.org/pep-0440/) | Version Identification and Dependency Specification | Adopted for all package versions and dependency specifiers. Combined with SemVer semantics from `ENGINEERING_STANDARDS.md`. |
| [PEP 484](https://peps.python.org/pep-0484/) | Type Hints | Adopted; strict typing is mandatory on public APIs (see Type Safety). |
| [PEP 526](https://peps.python.org/pep-0526/) | Syntax for Variable Annotations | Adopted for class attributes and module-level constants. |
| [PEP 544](https://peps.python.org/pep-0544/) | Protocols (Structural Subtyping) | Adopted; preferred over ABCs when only method shape matters (see Protocols vs ABCs). |
| [PEP 585](https://peps.python.org/pep-0585/) | Generic Alias Types (`list[str]`) | Adopted. `typing.List`, `typing.Dict`, etc. MUST NOT be used — see Modern syntax. |
| [PEP 604](https://peps.python.org/pep-0604/) | `X \| Y` Union Syntax | Adopted. `typing.Optional`/`typing.Union` MUST NOT be used in new code — see Modern syntax. |
| [PEP 621](https://peps.python.org/pep-0621/) | Project Metadata in `pyproject.toml` | Adopted; see [DEPLOYMENT_STANDARDS.md](DEPLOYMENT_STANDARDS.md). |
| [PEP 20](https://peps.python.org/pep-0020/) | The Zen of Python | Referenced informally as design guidance ("explicit is better than implicit"), not enforced mechanically. |

No PEP in this table is intentionally overridden as of this version. Any
future deviation MUST be documented here, in this same table format, with the
overridden rule, the PyTIQ rule, and the rationale.

## Principles

- Prefer explicit, typed, boring code over clever code.
- Modern syntax over legacy `typing` module verbosity, bounded by the
  supported version floor below.
- `Any` is a narrow, named escape hatch — not a way to avoid thinking about a
  type.

## Python Version Policy

- **Minimum supported version: Python 3.11.** PyTIQ code MUST run on 3.11 and
  MAY use any standard-library feature or syntax available in 3.11
  (`X | Y` unions, `list[str]`, `tomllib`, exception groups where useful).
- Version support is reviewed at least yearly; raising the floor is a
  documented decision in this file's changelog (see
  [INDEX.md](INDEX.md) → Standards versioning), not an ad hoc per-PR choice.
- Code MUST NOT use `from __future__ import annotations` as a substitute for
  meeting the version floor — if a syntax feature requires it, either use the
  PEP 604/585 syntax directly (supported natively at 3.11) or raise the
  version floor explicitly.

## Mandatory Rules

### Type safety

1. Every public function, method, and class attribute MUST declare parameter
   types, return types, and attribute types (PEP 484 / PEP 526).
2. `Any` MUST NOT be used to silence a type checker error. `Any` MAY be used
   only at a genuinely untyped boundary (e.g., a raw JSON payload from an
   external API before validation) and MUST be narrowed to a concrete type
   (via a `TypedDict`, `pydantic` model, or `dataclass`) as early as possible
   after entering the codebase.
3. Use PEP 585/604 syntax for all new type hints: `list[str]`, `dict[str,
   int]`, `str | None`. `typing.List`, `typing.Dict`, `typing.Optional`, and
   `typing.Union` MUST NOT appear in new code.
4. Private/internal helper functions SHOULD still be typed; type hints MAY be
   omitted only where a type checker can fully infer the type from a typed
   caller and omitting it does not reduce clarity.
5. `# type: ignore` MUST include the specific error code
   (`# type: ignore[arg-type]`) and MUST NOT be used to suppress an error that
   indicates a real bug rather than a type-checker limitation.

### Protocols, ABCs, and classes

6. Use `Protocol` (PEP 544) when code depends on a method shape from
   potentially multiple, unrelated implementations (e.g., "anything with a
   `.extract() -> Iterator[Record]`"). Use an ABC (`abc.ABC`) when
   implementations share a common lifecycle, shared concrete helper methods,
   or must not be instantiated directly (e.g., `BaseSourceConnector`).
7. Do NOT force a `Protocol` or ABC where a single concrete class is
   sufficient and no second implementation is planned with a named use case.
8. Prefer composition over inheritance for sharing behavior across unrelated
   classes. Inheritance is reserved for genuine is-a relationships with
   shared lifecycle (connector/sink base classes; see
   `SOURCE_CONNECTOR_STANDARDS.md`, `SINK_CONNECTOR_STANDARDS.md`).

### Dataclasses vs Pydantic models

9. Use `@dataclass(frozen=True, slots=True)` for internal, in-process value
   objects that do not require runtime validation, parsing from untrusted
   input, or serialization to/from JSON at a system boundary.
10. Use a Pydantic model (or an equivalent validating model) for any object
    that is: parsed from external input (API responses, config files, CLI
    args), a data contract exposed to consumers (see
    `DATA_CONTRACT_STANDARDS.md`), or requires field-level validation
    (ranges, patterns, required/optional semantics).
11. Do NOT use a plain `dict` or `TypedDict` where a dataclass or Pydantic
    model would give equivalent structure with validation and type safety —
    reserve `TypedDict` for interop with dict-shaped external APIs only.
12. Mutable default arguments MUST NOT be used
    (`def f(items: list[str] = [])`); use `None` with an internal default, or
    `field(default_factory=list)` on dataclasses.

### Enums and constants

13. Use `enum.Enum` (or `enum.StrEnum` on 3.11+ when the value must serialize
    as a plain string) for closed sets of named values — extraction modes,
    DQ severities, connector lifecycle states. Do NOT use bare string/int
    literals scattered across the codebase for the same conceptual set of
    values ("magic values").
14. Module-level constants MUST be `SCREAMING_SNAKE_CASE`, annotated with
    their type, and MUST NOT be re-declared with different values in more
    than one module.

### Functions, methods, and complexity

15. A function/method's cyclomatic complexity SHOULD stay at or below 10 and
    MUST NOT exceed 15 without an explicit, reviewed justification comment;
    Ruff's `C901` (or `mccabe`) enforces this in CI (see Tooling). Extract
    helpers instead of suppressing the check.
16. A function SHOULD do one thing at one level of abstraction. If a function
    mixes I/O, business rules, and formatting in one body, extract each
    concern into its own function.
17. Function signatures MUST use keyword-only arguments (`*,`) for any
    parameter beyond the third positional parameter, or where positional
    calls would be ambiguous (e.g., two `bool` parameters in a row).

### Async, generators, iterators, context managers

18. Async functions MUST be used only for genuinely asynchronous I/O
    (network calls via an async client, async queue consumers). Do NOT mark
    a function `async def` when its body performs no `await`.
19. Prefer generators (`yield`) over building and returning a full `list`
    when a caller can consume results incrementally — this is mandatory for
    any component that reads or writes large record streams (see
    `PERFORMANCE_AND_SCALE_STANDARDS.md`).
20. Any resource that must be released (file handle, DB connection, HTTP
    session, temp directory) MUST be managed with a context manager
    (`with` / `async with`) or an equivalent `try`/`finally`. Manual
    `.close()` calls without a `finally`/context manager are not acceptable.
21. A class that owns a releasable resource MUST implement `__enter__`/
    `__exit__` (or the async equivalents) rather than relying on callers to
    remember to close it, unless the resource's lifetime is managed entirely
    by a framework (e.g., a dependency-injected, pooled connection).

### Decorators and exceptions

22. Custom decorators MUST use `functools.wraps` to preserve the wrapped
    function's metadata (name, docstring, signature) for introspection and
    tooling.
23. Shared/reusable PyTIQ code (connector SDKs, sink SDKs, shared
    transformation/DQ libraries) MUST define and raise from a
    project-specific exception hierarchy (e.g., `PyTiqError` →
    `SourceExtractionError`, `SinkWriteError`, `DataQualityError`) rather
    than raising bare `Exception`, `ValueError`, or vendor exception types
    across a module boundary (see `ENGINEERING_STANDARDS.md` rule 8 → error
    boundaries). A simple, single-use pipeline SHOULD follow the same
    pattern but MAY raise a well-chosen standard-library exception type
    directly when no second caller needs to classify the failure.
24. When translating a caught exception into a different exception type,
    use exception chaining (`raise NewError(...) from original_exc`) so the
    original traceback is preserved. Do NOT swallow the original exception
    (`raise NewError(...) from None`) unless the original genuinely carries
    no diagnostic value and that is documented inline.
25. Do NOT use broad `except Exception` (or bare `except:`) to continue
    execution silently. See `ENGINEERING_STANDARDS.md` rule 9 for the one
    permitted top-level classification-boundary use.

### Imports, dependency injection, and module boundaries

26. Imports MUST be absolute, grouped standard library / third-party /
    first-party (enforced by Ruff's `isort` rules), one import per line.
27. Modules MUST NOT perform network calls, file I/O, or environment reads
    at import time (module-level side effects). Initialization belongs in an
    explicit `configure()`/`connect()` call or constructor.
28. Dependencies MUST be injected via constructor parameters or function
    arguments, not imported and instantiated inside the consuming function
    (see `ENGINEERING_STANDARDS.md` rule 4), **when the dependency is
    external or nondeterministic (network client, database connection,
    secret provider, clock, randomness source) and isolating it enables
    meaningful unit testing**. A component with no external or
    nondeterministic dependency (a pure function, a stdlib-only helper) is
    not required to accept injected collaborators it does not have —
    injection is a means to testability, not an end in itself.

### Logging, configuration access, file/path handling

29. Modules MUST use the standard `logging` module (via a module-level
    `logger = logging.getLogger(__name__)`), never `print()`, for anything
    beyond a throwaway local script. See `OBSERVABILITY_STANDARDS.md` for
    structured logging format and level rules.
30. Configuration MUST be read through the typed configuration objects
    defined per `CONFIGURATION_STANDARDS.md` — modules MUST NOT call
    `os.environ.get(...)` directly outside the configuration-loading layer.
31. File paths MUST be handled with `pathlib.Path`, not string
    concatenation. Path handling MUST be platform-independent (no hardcoded
    `/` or `\` separators).

### Datetime, serialization, environment independence

32. All `datetime` values that cross a module, process, or storage boundary
    MUST be timezone-aware (`tzinfo` set), stored/compared in UTC. Naive
    `datetime.now()`/`datetime.utcnow()` MUST NOT be used — use
    `datetime.now(timezone.utc)`. (`datetime.utcnow()` is deprecated upstream
    and returns a naive datetime; PyTIQ code MUST NOT use it.)
33. Serialization (to JSON, Parquet, etc.) MUST be explicit about datetime
    format (ISO 8601 with offset) and MUST NOT rely on a library's implicit
    default when that default is ambiguous about timezone.
34. Code MUST NOT depend on the machine's local timezone, locale, or
    filesystem case-sensitivity for correctness. Locale-sensitive operations
    (date parsing, string comparison) MUST specify the locale/format
    explicitly.

## Tooling

PyTIQ standardizes on one tool per concern to avoid overlapping, contradictory
enforcement:

| Concern | Tool | Rationale |
|---|---|---|
| Linting | **Ruff** | Fast, actively maintained, replaces Flake8 + isort + several plugins in one tool. |
| Formatting | **Ruff formatter** | Black-compatible output; keeps formatting and linting in a single dependency and config surface. |
| Static type checking | **mypy**, run in `--strict` mode for library/shared code | Mature, widely adopted, integrates with `pyproject.toml`. Pyright is a valid alternative but PyTIQ does not run both — see rule below. |
| Testing | **pytest** | De facto standard; fixture model fits connector/sink test doubles well (see `TESTING_STANDARDS.md`). |
| Dependency/security scanning | **pip-audit** (dependency CVEs) and **Ruff's `S` (bandit-derived) rules** (static security lint) | Covers known-vulnerability and common-insecure-pattern scanning without adding a second full SAST tool. |

Rules:

- PyTIQ MUST NOT run both mypy and Pyright as required CI gates — pick one
  primary type checker per the table above. A contributor MAY use Pyright
  locally in their editor for live feedback, but CI enforcement is mypy only.
- All tool configuration MUST live in `pyproject.toml` (`[tool.ruff]`,
  `[tool.mypy]`, `[tool.pytest.ini_options]`) rather than scattered
  `setup.cfg`, `.flake8`, or `tox.ini` files, unless a tool genuinely cannot
  read `pyproject.toml`.
- Formatting MUST be automated and enforced in CI (`ruff format --check`);
  formatting is never a manual review discussion point.
- New third-party dependencies MUST NOT duplicate the responsibility of an
  already-adopted tool (e.g., do not add `black` alongside `ruff format`, do
  not add `isort` alongside Ruff's import sorting).

## Docstrings

- Follow PEP 257 structural conventions (one-line summary, blank line, body)
  plus Google-style sections for parameters, returns, and raised exceptions:

```python
def resolve_incremental_cursor(
    watermark: Watermark,
    *,
    lookback: timedelta = timedelta(0),
) -> Cursor:
    """Compute the next extraction cursor from a stored watermark.

    Args:
        watermark: The last successfully committed watermark for this source.
        lookback: Optional overlap window to re-read for late-arriving data.

    Returns:
        The cursor to use as the lower bound for the next extraction.

    Raises:
        InvalidWatermarkError: If the watermark is missing required fields.
    """
```

- Every public module, class, and function MUST have a docstring. Private
  helpers MAY omit one when the signature and name are self-explanatory.
- Docstrings MUST NOT restate the function name in prose ("This function
  resolves...") — state what it does and why, not that it exists.

## Examples

```python
# Bad — Any everywhere, legacy typing, mutable default, bare except
from typing import Any, List, Optional

def load_records(items: List[Any] = []) -> Optional[Any]:
    try:
        return process(items)
    except:
        return None

# Good — modern syntax, narrow Any, no mutable default, explicit exception
def load_records(items: list[Record] | None = None) -> ProcessedBatch | None:
    resolved_items = items if items is not None else []
    try:
        return process(resolved_items)
    except ProcessingError as exc:
        logger.warning("Failed to process batch", exc_info=exc)
        return None
```

```python
# Bad — ABC forced onto a single implementation with no second use case
class AbstractRegionMapper(abc.ABC):
    @abc.abstractmethod
    def map_region(self, code: str) -> str: ...

class RegionMapper(AbstractRegionMapper):
    def map_region(self, code: str) -> str:
        return REGION_NAMES[code]

# Good — plain function/class; Protocol introduced only when a second
# implementation with a real use case exists
def map_region(code: str) -> str:
    return REGION_NAMES[code]
```

## Testing / Validation

See `TESTING_STANDARDS.md` for full test taxonomy. Type-checking (`mypy`) and
linting (`ruff check`) MUST pass in CI as a precondition for merge, alongside
`pytest`. A change that requires a `# type: ignore` or `# noqa` MUST justify
it in the same review.

## Review Checklist

- [ ] Public functions/classes/attributes are fully typed; no bare `Any` without a narrowing boundary.
- [ ] `list[...]`, `dict[...]`, `X | None` used — no `typing.List`/`Optional`/`Union`.
- [ ] No mutable default arguments.
- [ ] Dataclass vs Pydantic choice matches the rule (validated/external input → Pydantic; internal value object → dataclass).
- [ ] Enums used instead of scattered string/int magic values.
- [ ] No `except Exception`/bare `except` used to silently continue.
- [ ] Exception chaining (`raise ... from ...`) preserved when translating exceptions.
- [ ] Resources (files, connections, sessions) are managed with context managers.
- [ ] `datetime` values are timezone-aware and UTC at boundaries.
- [ ] No module-level I/O/network/env-read side effects.
- [ ] `ruff check`, `ruff format --check`, `mypy`, and `pytest` all pass.

## Related Standards

- [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) — the general principles these rules implement.
- [TESTING_STANDARDS.md](TESTING_STANDARDS.md) — pytest conventions and test taxonomy.
- [DEPLOYMENT_STANDARDS.md](DEPLOYMENT_STANDARDS.md) — `pyproject.toml` packaging metadata (PEP 621) and CI gate wiring.
- [CONFIGURATION_STANDARDS.md](CONFIGURATION_STANDARDS.md) — typed configuration access, referenced by rule 30.
- [OBSERVABILITY_STANDARDS.md](OBSERVABILITY_STANDARDS.md) — structured logging conventions, referenced by rule 29.
