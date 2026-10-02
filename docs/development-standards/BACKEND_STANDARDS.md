# Backend Project Standards and Guidelines

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
   - [Intentional no-op methods (Sonar)](#intentional-no-op-methods-sonar)
   - [Cognitive complexity (Sonar)](#cognitive-complexity-sonar)
   - [Regular expressions (Sonar)](#regular-expressions-sonar)
   - [`String#replaceAll` literal needles (Sonar)](#stringreplaceall-literal-needles-sonar)
   - [Nested template literals (Sonar)](#nested-template-literals-sonar)
   - [`String.raw` for backslashes (Sonar)](#stringraw-for-backslashes-sonar)
   - [Readonly class members (Sonar)](#readonly-class-members-sonar)
5. [API Design Standards](#api-design-standards)
   - [Paginated search endpoints](#paginated-search-endpoints)
6. [Database Standards](#database-standards)
7. [Dependency Injection](#dependency-injection)
8. [Error Handling](#error-handling)
9. [Validation](#validation)
10. [Partial Update Payloads](#partial-update-payloads)
11. [Testing Standards](#testing-standards)
12. [Security Standards](#security-standards)
13. [Documentation Standards](#documentation-standards)

## Project Overview

This is an Azure Functions backend application built with:
- **Runtime**: Node.js with TypeScript
- **Framework**: Azure Functions v4
- **Database**: Azure SQL with Prisma ORM
- **Authentication**: Azure Active Directory (planned)
- **Architecture**: Clean Architecture with Dependency Injection
- **Validation**: class-validator and class-transformer

## Architecture Patterns

### Clean Architecture
The project follows Clean Architecture principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Functions Layer                    │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                     │
│  (Services - Business Rules & Orchestration)               │
├─────────────────────────────────────────────────────────────┤
│                    Data Access Layer                        │
│  (Repositories - Data Persistence)                         │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                     │
│  (Database, External Services)                             │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Injection
- Uses **InversifyJS** for dependency injection
- All services and repositories are registered in the container
- Follows interface-based programming for loose coupling

## Project Structure

```
backend-app/
├── src/
│   ├── functions/                    # Azure Functions (API endpoints)
│   │   ├── countries/               # Country functions
│   │   ├── sign-categories/         # Sign category functions
│   │   ├── sign-types/              # Sign type functions
│   │   └── users/                   # User functions
│   ├── interfaces/                  # Contract definitions
│   │   ├── repositories/           # Repository interfaces
│   │   └── services/               # Service interfaces
│   ├── models/                     # Data models and DTOs
│   │   ├── base/                   # Base models (AuditableEntryBase)
│   │   ├── common/                 # Shared models (ApiEnvelope, ApiResponse, PaginatedResponse)
│   │   ├── domain/                 # Domain entities
│   │   ├── dtos/                   # Data Transfer Objects
│   │   └── enums/                  # Enumeration types
│   ├── services/                   # Business logic and data access
│   │   ├── business/               # Business logic implementations
│   │   ├── repositories/           # Data access implementations
│   │   ├── mappers/                # Data transformation logic
│   │   ├── database/               # Database service
│   │   ├── container.ts            # DI container setup
│   │   └── types.ts                # DI type definitions
│   └── helpers/                    # Utility classes
│       ├── http-request.helper.ts  # HTTP request/header utilities
│       ├── http-response.helper.ts # HTTP response utilities
│       └── update.helper.ts        # Partial update (PATCH) field helpers
├── prisma/                         # Database schema and migrations
├── docs/                           # API documentation
└── scripts/                        # Build and deployment scripts
```

## Coding Standards

### TypeScript Configuration
- **Strict Mode**: Enabled with all strict checks
- **Target**: ES2020
- **Module**: CommonJS (for Azure Functions compatibility)
- **Decorators**: Enabled for DI and validation
- **No Implicit Any**: All types must be explicitly defined

### Naming Conventions
- **Files**: kebab-case (e.g., `user.service.impl.ts`)
- **Classes**: PascalCase (e.g., `UserService`)
- **Interfaces**: PascalCase with 'I' prefix (e.g., `IUserService`)
- **Methods**: camelCase (e.g., `getUserById`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `TYPES`)
- **Enums**: PascalCase (e.g., `UserRole`)

### Code Organization
- **Single Responsibility**: Each class has one clear purpose
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions
- **Separation of Concerns**: Clear boundaries between layers
- **Managing Files**: Always use separate files for every class, interface, enum, DTO, mapper, service, repository, and Azure Function. Do not keep multiple entities or contracts in the same file.

### backend-app Entity File Layout
For `backend-app`, organize by entity rather than broad umbrella folders:

- Azure Functions live under `src/functions/<entity-route>/`, for example `src/functions/sign-types/get-sign-types.ts`.
- Domain models live directly under `src/models/domain/`, for example `src/models/domain/sign-type.model.ts`.
- DTOs live directly under `src/models/dtos/`, for example `src/models/dtos/sign-type.dto.ts`.
- Repository interfaces live under `src/interfaces/repositories/<entity>.repository.interface.ts`.
- Service interfaces live under `src/interfaces/services/<entity>.service.interface.ts`.
- Repository implementations live under `src/services/repositories/<entity>.repository.ts`.
- Business services live under `src/services/business/<entity>.service.ts`.
- Mappers live under `src/services/mappers/<entity>.mapper.ts` (and `<entity>-list-item.mapper.ts` for paginated list DTOs).
- Shared search paging/sorting: `src/models/dtos/search-query-base.dto.ts`; per-entity: `src/models/dtos/<entity>-search-query.dto.ts`.

Do not introduce grouping folders such as `models/domain/lookups`, `models/dtos/lookups`, or `functions/lookups` for entity-specific code. Use one folder/file per entity so future `get`, `save`, `edit`, `delete`, and `search` functions can be added next to the existing entity function.

### Source formatting (no spurious line breaks)
Do **not** insert a blank line after every statement, import, property, or brace. Match the compact style used in existing handlers and services (for example `patch-race-stage.ts`, `race-management.service.ts`).

- **Imports**: One `import` per line; no blank line between consecutive imports. Use a single blank line after the import block before the first declaration.
- **Types and interfaces**: One property per line inside the body; no blank line between properties unless separating logical groups.
- **Classes, functions, and handlers**: One blank line between top-level declarations (constants, factories, `app.http` registration). Inside a function body, use a blank line only **after a block** closes — `if`, `try`/`catch`, `for`/`for…of`, `switch`, or a nested function — not after every statement.
- **Object literals and argument lists**: Keep compact single-line or conventional multi-line formatting; do not add a blank line between each property or argument.
- **Before commit**: If an editor or agent produced “double-spaced” TypeScript, normalize it before review. Align new Azure Function files with the `Function Structure` example in [API Design Standards](#function-structure).

### Intentional no-op methods (Sonar)
When a class must implement an interface method that is intentionally a no-op for the current story (stub publishers, deferred event publishers, fakes), do **not** use an empty `async` method body. Sonar flags `Unexpected empty async method '…'`.

Prefer a non-`async` method that returns `Promise.resolve()`:

```typescript
// Bad — Sonar: Unexpected empty async method
async publishStageStarted(_payload: StageLifecycleEventPayload): Promise<void> {}

// Good — explicit no-op, still satisfies Promise<void>
publishStageStarted(_payload: StageLifecycleEventPayload): Promise<void> {
  return Promise.resolve();
}
```

Rules:
- Keep the interface return type as `Promise<void>`; callers may still `await` the method.
- Prefix unused parameters with `_` (for example `_payload`) when the signature is required by the interface.
- Document at class/module level why methods are deferred (for example a short JSDoc on the class), not with per-method “no-op” comments.
- Apply the same pattern in production stubs and test fakes that implement the interface.

### Cognitive complexity (Sonar)
Do **not** write a function or method whose Sonar cognitive complexity exceeds **15**. Sonar flags this as: `Refactor this function to reduce its Cognitive Complexity from N to the 15 allowed.`

Cognitive complexity rises with nested `if` / `for` / `while` / `switch` / `catch`, nested ternaries, and boolean operator sequences (`&&` / `||`). Keep handlers, mappers, validators, and rule evaluators flat.

**Required approach when approaching or exceeding 15:**
- Extract focused helpers (one concern each) so branching moves out of the parent function.
- Replace nested ternaries with early returns, lookup maps, or small pure helpers.
- Split large rule/switch blocks into category helpers (for example race rules vs stage rules vs personnel rules).
- Prefer `.some()` / `.every()` / keyed maps over nested loops with deep conditionals when behavior stays identical.

```typescript
// Bad — nested ternaries and catch/if ladder in one function (Sonar cognitive complexity > 15)
const target =
  body.a != null ? String(body.a).trim()
    : body.b != null ? String(body.b).trim()
      : body.c != null ? String(body.c).trim()
        : null;

// Good — complexity lives in a tiny helper; caller stays flat
const firstDefinedLabel = (metadata: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = metadata[key];
    if (value === undefined || value === null) {
      continue;
    }
    return String(value).trim();
  }
  return null;
};

const target = firstDefinedLabel(body, ['a', 'b', 'c']);
```

Rules:
- Apply to all `backend-app` TypeScript: Azure Function handlers, helpers, services, mappers, and validators.
- Do not disable the Sonar rule or suppress with comments; refactor instead.
- Public APIs and behavior must stay unchanged when extracting helpers for complexity only.
- When Sonar reports a violation on a file you touch, fix it in the same change set.

### Regular expressions (Sonar)
Do **not** ship regexes with unbounded / ambiguous quantifiers that can backtrack super-linearly. Sonar flags them as: Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.

Prefer linear string logic (`split` / `filter` / `join`, `startsWith` / `endsWith`, bounded loops) over trim-with-quantifier patterns.

| Avoid (common smells) | Prefer |
|---|---|
| `.replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '')` | `split(/[^a-z0-9]+/).filter(Boolean).join('-')` (see `slugifyIdentifier` in sign-catalogue constants) |
| `.replace(/^-+/, '')` / `.replace(/-+$/, '')` | Leading/trailing trim via `split`+`filter`, or a bounded `while` loop |
| Nested / overlapping `+` / `*` quantifiers | Bounded quantifiers or non-regex string walks |

```typescript
// Bad — Sonar: super-linear backtracking risk on leading/trailing dash trims
export function slugifyIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 50);
}

// Good — linear; no leading/trailing dash regex
export function slugifyIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-')
    .slice(0, 50);
}
```

Rules:
- Reuse shared helpers (for example `slugifyIdentifier`) instead of copying ad-hoc slugify regex chains.
- Do not suppress the rule; rewrite the pattern or replace regex with linear string logic.
- When Sonar reports a violation on a file you touch, fix it in the same change set.

### `String#replaceAll` literal needles (Sonar)
When replacing a **literal single character** (or fixed literal string) globally, pass a **string** needle to `replaceAll`, not a single-character `RegExp`. Sonar flags `replaceAll(/…/g, …)` as: This pattern can be replaced with `'…'`.

```typescript
// Bad — Sonar: This pattern can be replaced with '"' / '&' / etc.
cell.replaceAll(/"/g, '""');
value.replaceAll(/&/g, '&amp;').replaceAll(/</g, '&lt;');
escapeHtml(value).replaceAll(/`/g, '&#96;');

// Good — literal needles as strings (ES2021+)
cell.replaceAll('"', '""');
value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
escapeHtml(value).replaceAll('`', '&#96;');

// Good — pattern still needs a RegExp (keep the `g` flag with replaceAll)
raw.replaceAll(/\D/g, '');
```

Rules:
- Use string needles for CSV escaping (`"` → `""`), HTML escaping (`&`, `<`, `>`, `"`, `'`, `` ` ``), and any other fixed-character global replace.
- Keep a `RegExp` only when the match is a real pattern (character classes, quantifiers, anchors).
- When passing a RegExp to `replaceAll`, it **must** include the `g` flag or the runtime throws.
- Prefer `replaceAll` over global `.replace(/…/g, …)` when replacing all occurrences.
- When Sonar reports a violation on a file you touch, fix it in the same change set.

### Nested template literals (Sonar)
Do **not** nest template literals (including `String.raw\`…\`` inside another template). Sonar flags them as: Refactor this code to not use nested template literals.

Extract intermediate strings into locals, then build the outer template or `RegExp`. Prefer `String.raw` for backslash content (see **`String.raw` for backslashes** below) — just do not nest one template inside another.

```typescript
// Bad — nested String.raw / template literals
const pattern = new RegExp(
  String.raw`^${prefix.replace('-', String.raw`\-`)}(\d+)$`,
  'i',
);

// Good — escape into a local with String.raw, then one outer String.raw
const escapedPrefix = prefix.replace('-', String.raw`\-`);
const pattern = new RegExp(String.raw`^${escapedPrefix}(\d+)$`, 'i');
```

```typescript
// Bad — nested replacement template inside outer String.raw
const pattern = new RegExp(
  String.raw`^${segment.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}(\d{3})$`,
);

// Good — escape into a local, then one outer String.raw
const escapedSegment = segment.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const pattern = new RegExp(String.raw`^${escapedSegment}(\d{3})$`);
```

Rules:
- Keep `${…}` interpolations shallow: compute values before the template expression.
- Do not nest `String.raw` (or any template) inside another template to satisfy the backslash rule.
- When Sonar reports a violation on a file you touch, fix it in the same change set.

### `String.raw` for backslashes (Sonar)
When a template literal contains backslashes (regex sources, Windows paths, escape sequences written literally), use `String.raw\`…\`` instead of manually escaping `\` as `\\`. Sonar flags ordinary templates/strings with `\\` as: `String.raw` should be used to avoid escaping `\`.

```typescript
// Bad — Sonar: String.raw should be used to avoid escaping `\`
const escapedPrefix = prefix.replace('-', '\\-');
const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');

// Good
const escapedPrefix = prefix.replace('-', String.raw`\-`);
const pattern = new RegExp(String.raw`^${escapedPrefix}(\d+)$`, 'i');
```

```typescript
// Bad
segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Good
segment.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
```

Rules:
- Use `String.raw` for regex *source* strings that need literal backslashes.
- Regex *literals* (e.g. `/[\]\\]/`) are fine; this rule targets string/template content.
- Combine with the nested-template rule: extract locals first, then apply `String.raw` on each template separately.
- When Sonar reports a violation on a file you touch, fix it in the same change set.

### Readonly class members (Sonar)
Mark class fields as `readonly` when they are assigned once (typically in the constructor) and never reassigned. Sonar flags them as: Mark this member as `readonly`.

```typescript
// Bad — Sonar: Mark this member as `readonly`
@injectable()
export class IncidentRepository implements IIncidentRepository {
  private prisma: PrismaClient;

  constructor(@inject(TYPES.DatabaseService) databaseService: DatabaseService) {
    this.prisma = databaseService.getPrismaClient();
  }
}

// Good
@injectable()
export class IncidentRepository implements IIncidentRepository {
  private readonly prisma: PrismaClient;

  constructor(@inject(TYPES.DatabaseService) databaseService: DatabaseService) {
    this.prisma = databaseService.getPrismaClient();
  }
}
```

Rules:
- Apply to injected clients and services stored on the instance (`prisma`, collaborators, config) when the reference is fixed for the object lifetime.
- Prefer constructor parameter properties (`private readonly prisma: PrismaClient`) only when the project already uses that style in the same area; otherwise match existing `this.prisma = …` assignment with an explicit `readonly` field.
- Do not mark fields `readonly` if they are intentionally reassigned (caches that swap instances, lazy rebinding).
- When Sonar reports a violation on a file you touch, fix it in the same change set.

### Domain Models and DTOs
- Domain models should be classes that extend `AuditableEntryBase` when they represent persisted application data.
- Required fields should use definite assignment (`field!: Type`) instead of optional fields (`field?: Type`).
- Use `| null` only for fields that are nullable in the database/domain, for example `callingCode!: string | null`.
- Read response DTOs should use required fields for fields the API always returns.
- Create/edit request DTOs should be separate DTOs; do not weaken read DTO contracts by making fields optional for future writes.

### Partial Update Payloads

PATCH/update flows must only persist fields the client explicitly supplied. Optional request DTO fields use `undefined` for "not in this update" and `null` when the client is clearing a nullable value.

Use `UpdateHelper.pickDefinedValue` from `src/helpers/update.helper.ts` when building repository `data` objects and service-to-repository update inputs. Do **not** repeat inline spread conditionals such as `...(input.name !== undefined ? { Name: input.name } : {})`.

Prisma omits `undefined` properties from update payloads, so assign helper results directly on the target object:

```typescript
import { UpdateHelper } from '../../helpers/update.helper';

data: {
  StageNumber: UpdateHelper.pickDefinedValue(input.stageNumber),
  Date: UpdateHelper.pickDefinedValue(input.date),
  UpdatedBy: input.actorEmail,
}
```

`UpdateHelper.pickDefinedValue` supports three forms:

| Form | Usage | Example |
|------|--------|---------|
| Single argument | Field value is used as-is when defined | `UpdateHelper.pickDefinedValue(request.stageNumber)` |
| Source + mapped value | Include a computed value only when the source field was provided | `UpdateHelper.pickDefinedValue(request.name, nextName)` |
| Source + resolver | Transform only when the source field was provided (resolver is not called when source is `undefined`) | `UpdateHelper.pickDefinedValue(request.name, (name) => name.trim())` |

Rules:
- Keep property names on the left (`Name`, `stageNumber`, etc.); the helper only resolves the value.
- Use the two-argument form when the service already computed a derived value (for example `nextName`, parsed `startDate`).
- Use the resolver form for trims, parsing, and type coercion so transforms are not evaluated when the field was omitted.
- Do not use spread syntax with the helper; assign `propertyName: UpdateHelper.pickDefinedValue(...)`.
- Always set audit/actor fields (`UpdatedBy`, `actorEmail`) outside the helper — they are required on every update, not PATCH-optional.

Example in a business service:

```typescript
await this.raceRepository.update(context.tenantId, raceId, {
  name: UpdateHelper.pickDefinedValue(request.name, nextName),
  startDate: UpdateHelper.pickDefinedValue(request.startDate, startDate),
  sanction: UpdateHelper.pickDefinedValue(request.sanction, (sanction) => sanction.trim()),
  actorEmail: context.actorEmail,
});
```

Example with nullable clear:

```typescript
description: UpdateHelper.pickDefinedValue(
  request.description,
  (description) => description?.trim() || null,
),
```

## API Design Standards

### Function Structure
```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { HttpRequestHelper } from '../../helpers/http-request.helper';
import { HttpResponseHelper } from '../../helpers/http-response.helper';
import { IExampleService } from '../../interfaces/services/example.service.interface';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';

const getExampleService = (): IExampleService => container.get<IExampleService>(TYPES.ExampleService);

export const createGetExamplesHandler =
  (serviceFactory: () => IExampleService = getExampleService) =>
  async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const correlationId = HttpRequestHelper.getCorrelationId(request, context);
    const tenantId = HttpRequestHelper.parseTenantId(request);

    if (tenantId === null) {
      return HttpResponseHelper.unauthorized(correlationId, 'Active tenant context is required.');
    }

    try {
      const service = serviceFactory();
      const data = await service.getAll(tenantId);

      return HttpResponseHelper.success(data, correlationId, tenantId);
    } catch (error) {
      context.error('Example read failed.', { correlationId, tenantId, error });

      return HttpResponseHelper.internalServerError(correlationId, tenantId, 'Example read failed.');
    }
  };

app.http('getExamples', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/examples',
  handler: createGetExamplesHandler(),
});
```

Function rules:
- Keep the handler factory in the same function file for testability (`createGetExamplesHandler`).
- Resolve the concrete service through a small local service factory.
- Use `HttpRequestHelper` for shared header, correlation id, and tenant id parsing.
- Use `HttpResponseHelper` for all response envelopes.
- Keep cross-cutting request parsing in helpers, not duplicated across functions.

### HTTP Response Standards
- **Success Responses**: Use `HttpResponseHelper.success()`
- **Created Responses**: Use or add a `HttpResponseHelper.created()` helper when implementing create endpoints.
- **Error Responses**: Use appropriate error helpers
- **Consistent Format**: backend-app HTTP responses use `{ data, error, meta }` with camelCase fields.
- **Tenant Metadata**: Successful tenant-aware responses include `meta.correlationId` and `meta.tenantId`.

### Route Naming
- **GET**: `get{Resource}` for simple reads without a search body (e.g., `getMyProfile`, `getCountries`).
- **POST**: `create{Resource}` (e.g., `createTenant`, `inviteUser`).
- **PUT/PATCH**: `update{Resource}` (e.g., `updateUser`).
- **DELETE**: `delete{Resource}` (e.g., `deleteMyProfileImage`).
- **Search (paginated lists)**: `search{Resource}` (e.g., `searchUsers`, `searchTenants`) — see [Paginated search endpoints](#paginated-search-endpoints). Do **not** use `get{Resource}` with `?page=` / `?pageSize=` query parameters for new list APIs.
- **Route Paths**: Use entity routes under `v1/<entity-route>`, for example `v1/countries`, `v1/sign-types`, and `v1/users`.
- **No Umbrella Segments**: Do not add route grouping segments such as `v1/lookups/<entity>` when the endpoint is for a concrete entity.
- **Azure Functions Prefix**: The runtime adds `/api`; function route values should not include `/api`.

### Paginated search endpoints

Use **POST** with a JSON search body for any tenant-scoped or platform list that supports paging, sorting, and optional text filter. Reference implementations: `search-users.ts`, `search-tenants.ts`.

#### HTTP contract
- **Method**: `POST` only (not `GET` with query string pagination).
- **Function name**: `search{Resource}` (Azure Functions registration id), e.g. `searchUsers`.
- **Handler factory**: `createSearch{Resource}Handler` in `src/functions/<entity>/search-{resource}.ts`.
- **Route**:
  - Prefer `v1/<entity-route>` when the collection route is not already used for another `POST` action (example: `POST v1/users` → search users).
  - Use `v1/<entity-route>/search` when `POST` on the collection is reserved for create (example: `POST v1/tenants` creates a tenant, so search is `POST v1/tenants/search`).
- **Response**: Existing paginated envelope via `HttpResponseHelper.success(..., { page, pageSize, total })`; list payload shape unchanged for clients (e.g. `{ users, page, pageSize, total }`).

#### Search query DTOs
- **Base**: `SearchQueryBaseDto` in `src/models/dtos/search-query-base.dto.ts` — shared paging, sorting, and text filter:

| Field | Default | Rules |
|-------|---------|--------|
| `page` | `1` | Min 1 after normalization |
| `pageSize` | `10` | Min 1, max 100 after normalization |
| `sortBy` | entity default | Optional; constrain per entity in subclass |
| `sortOrder` | `asc` | `asc` or `desc` |
| `searchText` | — | Optional, max 255 chars; trimmed; empty → omitted |

- **Entity subclass**: `{Entity}SearchQueryDto extends SearchQueryBaseDto` in `src/models/dtos/{entity}-search-query.dto.ts`.
  - Override `sortBy` with `@IsIn([...])` for allowed sort columns only (example: users — `displayName`, `email`, `role`, `status`; tenants — `name`, `slug`, `contactEmail`, `plan`, `isActive`).
  - Add entity-specific filter fields on the subclass only when needed (do not put entity filters on the base DTO).
- **Normalization**: Call `dto.normalizePagination()` in the handler **after** `validateDto` and **before** calling the service.

#### Handler pattern
```typescript
const body = (await request.json()) as Partial<UsersSearchQueryDto>;
const validation = await validateDto(UsersSearchQueryDto, body, correlationId, tenantContext.tenantId);
if ('response' in validation) {
  return validation.response;
}
validation.dto.normalizePagination();

const response = await service.searchTenantUsers({
  tenantId: tenantContext.tenantId,
  query: validation.dto,
});
```

- Use `validateDto` from `validation.helper.ts` (uses `plainToInstance` + `class-validator` with `whitelist` and `forbidNonWhitelisted`).
- Pass the **validated DTO instance** through the stack; do not destructure into loose `page` / `pageSize` fields at the handler.

#### Service layer
- Method: `search{Resource}(input: Search{Resource}Input)`.
- Input type: `{ tenantId: number; query: {Entity}SearchQueryDto }` when tenant-scoped, or `{ query: {Entity}SearchQueryDto }` for platform-wide lists (e.g. tenants).
- Read `page` / `pageSize` from `input.query` for the response envelope after normalization.
- Orchestrate repository `search*` and `count*` in parallel; apply cross-cutting concerns here (e.g. signed blob URLs), not in the repository.

#### Repository layer
- Methods: `search{Resource}(tenantId, query)` and `count{Resource}(tenantId, query)` — accept `{Entity}SearchQueryDto` directly (no separate `List*Query` with `skip`/`take` at the interface).
- **Query construction stays in the repository**: private helpers such as `build*Where`, `build*OrderBy`, `build*Pagination` that read from the DTO.
- **`count*` must use the same `where` clause as `search*`** so `meta.total` matches the filtered result set.
- **`searchText`**: use Prisma `contains` on the entity’s documented columns (substring match); trim in repository or rely on DTO normalization.
- **Do not** put Prisma `where` / `orderBy` / `skip` / `take` builders in mapper classes.

#### Mappers (list/search only)
- Use a dedicated list-item mapper when mapping Prisma rows to list DTOs, e.g. `TenantUserListItemMapper`, `TenantListItemMapper`.
- Mappers for search/list: **`toDto` / `toDtoList` from persistence row → read DTO only**.
- Keep `toDomain` on entity mappers (e.g. `UserTenantRoleMapper`, `TenantMapper`) for single-entity reads and writes.
- Inline `.map((row) => ({ ... }))` in repositories is discouraged for paginated list results; use a mapper class instead.

#### File checklist for a new paginated search API
1. `src/models/dtos/search-query-base.dto.ts` — extend, do not duplicate paging fields.
2. `src/models/dtos/{entity}-search-query.dto.ts` — entity `sortBy` (and extra filters if any).
3. `src/functions/{entity}/search-{resource}.ts` — POST handler.
4. `Search{Resource}Input` on the service interface; `search{Resource}` on service and repository interfaces.
5. Repository private query builders + list-item mapper.
6. Register function in `src/index.ts`; document in `docs/api-docs/`.
7. Handler tests: authz, validation (`sortBy`, `searchText` trim), DTO passed to service.

#### When not to use this pattern
- **Unpaginated reads**: full master lists or small fixed sets (e.g. `getCountries`) remain `GET` without a search body.
- **Identity / auth lists**: `GET /auth/tenants` (membership picker) is not a paginated search endpoint unless explicitly redesigned.

## Database Standards

### Prisma Schema (`backend-app`)

The Azure Functions backend uses Prisma against Azure SQL. Follow `backend-app/prisma/CONVENTIONS.md` as the authoritative schema guide. Key rules:

- **Model names**: PascalCase singular (`Race`, `Tenant`, `SignCategory`).
- **Column names**: PascalCase matching persisted SQL columns (`Id`, `TenantId`, `CreatedAt`).
- **Primary keys**: `Id Int @id @default(autoincrement())` on every application table (`INT IDENTITY(1,1)` in Azure SQL). Do not use `cuid()` or string UUIDs for primary keys.
- **Foreign keys**: All `*Id` reference columns must be `Int` (or `Int?` when optional), matching the referenced table's integer `Id`.
- **Master tables**: Global reference data such as `Country` uses integer `Id` but no `TenantId`.
- **Tenanted tables**: Include `TenantId Int` and register the model in `AGGREGATE_OWNERSHIP.md` and `TENANTED_MODELS`.
- **Table mapping**: Use `@@map("PascalCaseTable")` when Prisma defaults would drift from Azure SQL naming.
- **Validation**: `backend-app/scripts/validate-prisma-schema.js` enforces identity keys, audit fields, and tenant scope before merge.
- **Migration authoring vs apply (mandatory):** Agents and developers **create** migration folders and SQL under `backend-app/prisma/migrations/` and run `npm run prisma:validate`, `npm run prisma:cli-validate`, and aggregate/schema tests locally. They **must not** run `prisma migrate dev`, `prisma migrate deploy`, or any command that applies pending migrations to a developer, shared, or production database **unless the user or Team Lead explicitly requests it**. Schema drift is validated via committed migration SQL, `prisma migrate diff`, and CI (`prisma-migration-validation` per `MIGRATION_POLICY.md`); applying migrations to a target database is a separate, human-approved deploy step.

Legacy examples elsewhere in this document that use camelCase columns or string IDs apply to other backends only, not `backend-app`.

### Soft Delete Pattern
All entities implement soft delete with these fields:
```typescript
isArchived!: boolean;
archivedAt?: Date | null;
archivedBy?: string | null;
```

### Audit Trail
All entities extend `AuditableEntryBase` with:
```typescript
id!: number;
createdAt!: Date;
createdBy!: string;
updatedAt!: Date;
updatedBy!: string;
isArchived!: boolean;
archivedAt?: Date | null;
archivedBy?: string | null;
```

## Dependency Injection

### Container Setup
```typescript
// Register in container.ts
container.bind<DatabaseService>(TYPES.DatabaseService).to(DatabaseService).inSingletonScope();
container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository).inTransientScope();
container.bind<IUserService>(TYPES.UserService).to(UserService).inSingletonScope();
```

### Service Registration
- **Services**: Singleton scope for stateless services
- **Repositories**: Transient scope (created per request)
- **Database**: Singleton scope

### Type Definitions
```typescript
export const TYPES = {
  DatabaseService: Symbol.for('DatabaseService'),
  UserService: Symbol.for('UserService'),
  UserRepository: Symbol.for('UserRepository'),
  // ... other types
};
```

### Repository Pattern
Repositories must use `DatabaseService` to access Prisma. Do not bind or inject ad-hoc Prisma client abstractions for one feature.

```typescript
@injectable()
export class ExampleRepository implements IExampleRepository {
  private prisma: PrismaClient;

  constructor(@inject(TYPES.DatabaseService) databaseService: DatabaseService) {
    this.prisma = databaseService.getPrismaClient();
  }

  async getAll(tenantId: number): Promise<Example[]> {
    const rows = await this.prisma.example.findMany({
      where: {
        TenantId: tenantId,
        IsActive: true,
        IsArchived: false,
      },
      orderBy: [{ DisplayOrder: 'asc' }, { Name: 'asc' }],
    });

    return rows.map(ExampleMapper.toDomain);
  }
}
```

Repository rules:
- Repositories return **domain models** for single-entity reads and writes.
- Repositories may return **list read DTOs** for `search*` methods, mapped via list-item mappers (`toDto` / `toDtoList`).
- Services return DTOs for all API read use cases.
- Mappers own row → domain (`toDomain`) and row → list DTO (`toDto`) transformations; **not** Prisma query construction.
- Paginated `search*` / `count*` methods accept the entity `*SearchQueryDto` and build `where` / `orderBy` / pagination inside the repository.
- Partial updates use `UpdateHelper.pickDefinedValue` for optional PATCH fields (see [Partial Update Payloads](#partial-update-payloads)); do not inline `...(field !== undefined ? { ... } : {})` spreads.
- Tenant-owned entities must filter by `TenantId`, `IsActive=true`, and `IsArchived=false` (plus `searchText` when provided).
- Global master entities may omit `TenantId` but still apply active/archive filters where the schema supports them.

## Error Handling

### Error Response Structure
```typescript
{
  data: null,
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Error description"
  },
  meta: {
    correlationId: "corr-123",
    tenantId: 7
  }
}
```

### Error Types
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict
- **500 Internal Server Error**: Server-side errors

### Error Handling Pattern
```typescript
try {
  // Business logic
} catch (error) {
  context.error('Error description.', { correlationId, tenantId, error });

  return HttpResponseHelper.internalServerError(correlationId, tenantId, 'Unexpected error occurred.');
}
```

## Validation

### DTO Validation
- Use `class-validator` decorators
- Validate all input DTOs before processing
- Return detailed validation error messages

### Validation Pattern

Use `validateDto` for all JSON body validation (mutations and search):

```typescript
import { validateDto } from '../../helpers/validation.helper';

const body = (await request.json()) as Partial<CreateUserDto>;
const validation = await validateDto(CreateUserDto, body, correlationId, tenantId);

if ('response' in validation) {
  return validation.response;
}

// Search endpoints only:
validation.dto.normalizePagination();
```

`validateDto` uses `plainToInstance` so `@Type(() => Number)` on search DTOs works for numeric fields. It returns `400` with code `VALIDATION_ERROR` and per-field constraints when validation fails.

For search query DTOs, always call `normalizePagination()` after a successful `validateDto` and before invoking the service.

If the required response helper does not exist yet, add it to `HttpResponseHelper` instead of building response envelopes inline in function files.

### Common Validators
- `@IsEmail()`: Email validation
- `@IsString()`: String validation
- `@IsEnum()`: Enum validation
- `@IsOptional()`: Optional fields
- `@IsBoolean()`: Boolean validation
- `@ValidateNested()`: Nested object validation

## Testing Standards

### Running tests (developers and agents)
- **Developers** run backend tests manually when validating work (for example `npm test` in `backend-app`). CI may run on pull requests.
- **AI agents** must **not** run the full test suite automatically after every implementation step unless the user explicitly asks.
- Agents **should** still add or update tests when changing behavior. Before merge, the human author confirms tests pass locally or in CI.

### Test Structure
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API endpoints
- **Repository Tests**: Test data access layer
- **Service Tests**: Test business logic
- **Static Route Tests**: Verify Azure Function route registration, folder path, and absence of explicitly out-of-scope routes.
- **Source Guard Tests**: Verify out-of-scope data access is not introduced, for example no locale/translation table references in canonical lookup reads.

### Test Naming
- **Format**: `describe('ClassName', () => { describe('methodName', () => { it('should do something', () => {}) }) })`
- **Example**: `describe('UserService', () => { describe('createUser', () => { it('should create user successfully', () => {}) }) })`

### Mocking
- Use dependency injection for testability
- Mock external dependencies
- Test error scenarios

## Security Standards

### Authentication
- Azure AD integration (planned)
- JWT token validation
- Role-based access control

### Authorization
- Validate user permissions
- Check resource ownership
- Implement proper access controls

### Input Validation
- Validate all user inputs
- Sanitize data before database operations
- Use parameterized queries (Prisma handles this)

### Error Information
- Don't expose internal error details
- Log errors for debugging
- Return generic error messages to clients

## Documentation Standards

### API Documentation
- Document all endpoints in `docs/api-docs/`
- Include request/response examples
- Document error scenarios
- Keep documentation up-to-date

### Code Documentation
- Use JSDoc for public methods
- Document complex business logic
- Include usage examples

### README Files
- Project setup instructions
- Environment configuration
- Deployment procedures
- Development guidelines

## Development Workflow

### Creating New Functions
1. Create or reuse an entity folder under `src/functions/<entity-route>/`.
2. Create one Azure Function file per endpoint, for example `get-sign-types.ts` or `search-users.ts`.
3. Keep the handler factory inside the function file and use shared helpers for request parsing.
4. Define domain model and DTO files directly under `src/models/domain/` and `src/models/dtos/`.
5. For **paginated lists**, add `{entity}-search-query.dto.ts` extending `SearchQueryBaseDto` and a `search-{resource}.ts` POST handler (see [Paginated search endpoints](#paginated-search-endpoints)).
6. Implement repository interface and repository implementation for the entity.
7. Implement service interface and business service for the entity.
8. Add entity mapper with `toDomain`; add a list-item mapper with `toDto` when the repository returns list DTOs.
9. Register repository/service dependencies in `container.ts` and symbols in `types.ts`.
10. Update `src/index.ts` to import the function file.
11. Write service, repository, handler, and static route tests.
12. Update API documentation and story/DoD evidence.

### Code Review Checklist
- [ ] Follows naming conventions
- [ ] Uses entity folders and direct model/DTO folders, not umbrella feature folders
- [ ] Uses entity route URLs (`v1/<entity-route>`) without unnecessary grouping segments
- [ ] Paginated lists use `POST` + `search{Resource}` + `*SearchQueryDto`, not `GET` with query params
- [ ] Search handlers use `validateDto`, `normalizePagination()`, and pass the DTO to the service
- [ ] Repository `search*` / `count*` share the same filter; query builders live in the repository, not mappers
- [ ] List results mapped with a list-item mapper (`toDto` / `toDtoList`)
- [ ] Implements proper error handling
- [ ] Includes input validation
- [ ] Uses dependency injection
- [ ] Repositories inject `DatabaseService`; single-entity reads return domain models
- [ ] Services return DTOs and mappers keep row → domain / row → DTO transformations explicit
- [ ] PATCH/update payloads use `UpdateHelper.pickDefinedValue` for optional fields
- [ ] Follows soft delete pattern
- [ ] Includes audit trail
- [ ] Has appropriate tests
- [ ] Documentation is updated

### Deployment
- Use Azure Functions deployment
- Environment-specific configurations
- Database migrations with Prisma — **commit migration SQL only during feature work; do not apply migrations to any database unless explicitly requested** (see Database Standards → Prisma Schema → Migration authoring vs apply)
- Health checks and monitoring

## Best Practices

### Performance
- Use database indexes appropriately
- Implement pagination for large datasets via [paginated search endpoints](#paginated-search-endpoints) (`pageSize` max 100)
- Cache frequently accessed data
- Optimize database queries

### Maintainability
- Keep functions small and focused
- Use meaningful variable names
- Add comments for complex logic
- Follow DRY principle

### Scalability
- Design for horizontal scaling
- Use stateless functions
- Implement proper connection pooling
- Monitor resource usage

### Monitoring
- Use Application Insights
- Log important events
- Monitor performance metrics
- Set up alerts for errors

This document should be updated as the project evolves and new patterns emerge.
