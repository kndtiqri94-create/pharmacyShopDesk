# Frontend Project Standards and Guidelines

## Project Overview
This standard applies to the Angular frontend applications (`frontend-app` and `mobile-pwa`) with:
- **Framework**: Angular 18+ with TypeScript
- **UI Library**: Project component styles and Ionic where applicable
- **Authentication**: Azure Active Directory / JWT integration as features require
- **Styling**: SCSS with Angular Material theming
- **State Management**: RxJS Observables and Services
- **HTTP Client**: Angular HttpClient with custom interceptors

## Technology Stack

### Core Dependencies
- **Angular**: Use the version pinned in each app's `package.json`
- **TypeScript**: Strict mode enabled
- **RxJS**: 7.8.0

### Development Dependencies
- **Prettier**: 3.0.0 (code formatting)
- **Vitest via Angular test builder**: Testing framework
- **Angular CLI**: Use the version pinned in each app's `package.json`

## Project Structure

```
frontend-app/
├── src/
│   ├── app/
│   │   ├── core/                     # Core app models, services, forms, offline helpers
│   │   │   ├── models/
│   │   │   │   ├── domain/           # Entity domain models and feature DTOs (Country, user-admin, etc.)
│   │   │   │   ├── enums/            # API-aligned string enums (UserRole, ThemePreference, etc.)
│   │   │   │   └── shared/           # Shared technical contracts (ApiEnvelope, EntityEndpoint)
│   │   │   ├── utils/                # Domain helpers (enum display labels, formatters)
│   │   │   ├── services/             # Entity services and shared service bases
│   │   │   ├── forms/                # Typed form utilities
│   │   │   └── offline/              # PWA offline helpers, when applicable
│   │   ├── shared/                   # Reusable presentation components; utils/ for generic helpers
│   │   ├── features/                 # Feature pages and workflows
│   │   ├── app.component.*           # Root component
│   │   ├── app.config.ts             # Application configuration
│   │   ├── app.routes.ts             # Routing configuration
│   │   └── material.module.ts        # Angular Material imports
│   ├── assets/                       # Static assets
│   ├── environments/                 # Environment configurations
│   ├── core/i18n/                    # TranslationService, translate pipe (see Internationalization)
│   ├── styles/                       # Global SCSS partials (tokens, utilities, components)
│   └── styles.scss                   # Imports partials; no feature-specific rules here
├── public/                           # Public assets
├── angular.json                      # Angular CLI configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Dependencies and scripts
```

`mobile-pwa` uses the same `app/core/models` layout (`domain`, `enums`, `shared`) for models that apply to that app. Do not duplicate enum definitions in domain model files.

## Coding Standards

### TypeScript Configuration
- **Strict Mode**: Enabled with all strict flags
- **Target**: ES2022
- **Module Resolution**: Bundler
- **Path Mapping**: Configured for clean imports
- **No Implicit Any**: Enabled
- **No Unused Locals/Parameters**: Enabled
- **Managing Files**: Always use separate files for every class, interface, enum, model, service, and test. Do not keep multiple entity models or services in the same file.


### Path Mapping (tsconfig.json)
```json
{
  "paths": {
    "@app/*": ["app/*"],
    "@shared/*": ["app/shared/*"],
    "@models/*": ["app/shared/models/*"],
    "@services/*": ["app/shared/services/*"],
    "@components/*": ["app/shared/components/*"],
    "@environments/*": ["../environments/*"],
    "@assets/*": ["assets/*"]
  }
}
```

### Component Standards

#### Component Structure
- Use **standalone components** (Angular 18+ approach)
- Follow the naming convention: `feature-name.component.ts`
- Include corresponding `.html`, `.scss`, and `.spec.ts` files
- Use `OnInit` when the component needs initialization; keep `ngOnInit()` synchronous (see **Lifecycle hooks (OnInit)** below)

#### Lifecycle hooks (OnInit)
Angular’s `OnInit.ngOnInit()` must return **`void`**. Do **not** declare `async ngOnInit()` or return a `Promise` from a lifecycle hook. Sonar flags it as: Promise-returning method provided where a void return was expected by extended/implemented type `OnInit`.

Angular does not await lifecycle promises; an `async` hook only hides errors and fails static analysis.

```typescript
// Bad — Sonar: Promise-returning method where void was expected (OnInit)
async ngOnInit(): Promise<void> {
  await this.reload();
}

// Good — sync hook; fire-and-forget with .catch (see void operator)
ngOnInit(): void {
  this.reload().catch(() => undefined);
}

// Good — multi-step init extracted to a private async helper
ngOnInit(): void {
  this.initialize().catch(() => undefined);
}

private async initialize(): Promise<void> {
  await Promise.all([this.loadRaces(), this.reload()]);
}
```

- Prefer calling an existing async helper (`reload()`, `loadProfile()`, …) from `ngOnInit` when one already exists.
- Use `.catch(() => undefined)` (or a real error handler) — **not** the `void` operator — for intentional fire-and-forget (see **void operator (Sonar)**).
- Applies to **`frontend-app`** and **`mobile-pwa`**.

#### Component Template
```typescript
@Component({
  selector: 'app-feature-name',
  standalone: true,
  imports: [MaterialResourceModule, SharedModule],
  templateUrl: './feature-name.component.html',
  styleUrl: './feature-name.component.scss'
})
export class FeatureNameComponent implements OnInit {
  ngOnInit(): void {
    this.reload().catch(() => undefined);
  }

  private async reload(): Promise<void> {
    // ...
  }
}
```

#### Component Naming Conventions
- **Components**: `FeatureNameComponent` (PascalCase)
- **Files**: `feature-name.component.ts` (kebab-case)
- **Selectors**: `app-feature-name` (kebab-case with app prefix)

#### Identifier Naming (no abbreviations)
Use full, descriptive names for injected dependencies, fields, and locals. Do not abbreviate service or builder names.

| Avoid | Prefer |
|-------|--------|
| `fb` | `formBuilder` (`NonNullableFormBuilder`) |
| `http` | `httpClient` (`HttpClient`) |
| `auth` | `authService` (`AuthService`) |
| `msal` | `msalService` (`MsalService`) |
| `userAdmin` | `userAdminService` (`UserAdminService`) |
| `tenantAdmin` | `tenantAdminService` (`TenantAdminService`) |
| `themeService` | `themePreferenceService` (`ThemePreferenceService`) |
| `tenantApi` | `tenantApiService` (`TenantApiService`) |

```typescript
export class UserInviteModalComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly userAdminService = inject(UserAdminService);

  protected readonly form = this.formBuilder.group({
    email: this.formBuilder.control('', { validators: [Validators.email] }),
  });
}
```

- Template bindings must use the same full names (for example `authService.signOut()`, not `auth.signOut()`).
- Well-known framework types may keep their conventional parameter names in callbacks only when required by an API signature (for example RxJS `map((response) => ...)`).
- Environment keys and third-party config property paths (for example `environment.auth`) are not inject aliases and are unchanged.

### Service Standards

#### Service Structure
- Use `@Injectable({ providedIn: 'root' })` for singleton services
- Follow naming convention: `<Entity>Service`, for example `CountryService`, `SignTypeService`
- Use TypeScript interfaces for method signatures
- Implement proper error handling with RxJS operators
- Place app-wide entity services under `app/core/services`
- Use one service per entity. Do not create one umbrella service for unrelated entities.
- Put future operations for the same entity (`get`, `getAll`, `save`, `edit`, `delete`, `search`) in that entity service.
- Shared cross-entity behavior may live in an abstract/base service, for example `TenantScopedReadService`.

#### Entity Service Example
```typescript
@Injectable({ providedIn: 'root' })
export class SignTypeService extends TenantScopedReadService {
  getAll(): Observable<readonly SignType[]> {
    return this.getAllFromEndpoint<SignType>('sign-types');
  }
}
```

#### Shared Tenant-Scoped Read Base
Use a shared base for repeated tenant-scoped read behavior. This keeps entity services small while avoiding a single multi-entity facade.

```typescript
export abstract class TenantScopedReadService {
  private readonly httpClient = inject(HttpClient);
  private readonly cache = new Map<string, Observable<readonly unknown[]>>();
  private activeTenantId: number | null = null;

  setActiveTenantId(tenantId: number): void {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new Error('A positive tenant id is required for entity reads.');
    }

    if (this.activeTenantId !== tenantId) {
      this.activeTenantId = tenantId;
      this.clearCache();
    }
  }

  protected getAllFromEndpoint<T>(endpoint: EntityEndpoint): Observable<readonly T[]> {
    const tenantId = this.requireActiveTenantId();

    return this.httpClient.get<ApiEnvelope<readonly T[]>>(buildApiV1Url(endpoint), {
      headers: { 'x-tenant-id': tenantId.toString() },
    }).pipe(
      map((response) => response.data ?? []),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
```

Tenant-scoped service rules:
- Every caller must set the active tenant id before calling tenant-scoped reads.
- Cache entries must be tenant-scoped.
- Clear caches when the active tenant changes.
- Use API entity routes such as `/api/v1/countries` and `/api/v1/sign-types`.
- Do not call legacy grouped routes such as `/api/v1/lookups/<entity>`.

### Model Standards

#### Model Folder Layout
- Entity domain models live under `app/core/models/domain`.
- API-aligned enumerations live under `app/core/models/enums` (one enum per file).
- Shared technical models live under `app/core/models/shared`.
- Domain model files use the entity name, for example `country.model.ts`, `sign-type.model.ts`, `user-admin.model.ts`.
- Enum files use kebab-case with an `.enum.ts` suffix, for example `user-role.enum.ts`, `theme-preference.enum.ts`.
- Shared model files use their technical contract name, for example `api-envelope.model.ts`, `entity-endpoint.model.ts`.
- Do not put technical wrappers such as `ApiEnvelope` or endpoint unions in the domain folder.
- Do not define shared API enums inline in domain model files; import them from `core/models/enums`.
- Do not suffix entity model names with feature names such as `Lookup`; use `Country`, `SignType`, `MarshalType`, `ZoneType`, etc.

#### Enum Standards
- **One enum per file** under `app/core/models/enums/`. Do not combine `UserRole`, `ThemePreference`, and similar types in a single file.
- **Align with backend** string values in `backend-app/src/models/enums/` (for example `UserRole`, `ThemePreference`, `UserTenantRoleStatus` on the server maps to `UserMembershipStatus` in the Web admin UI).
- **File naming**: `user-role.enum.ts`, `theme-preference.enum.ts`, `user-membership-status.enum.ts`.
- **Type shape**: Prefer a `const` object plus exported type alias so components, guards, and services can use runtime values without duplicating string literals:

```typescript
// user-role.enum.ts
export const UserRole = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  ADMIN: 'ADMIN',
  RACE_DIRECTOR: 'RACE_DIRECTOR',
  CHIEF_MARSHAL: 'CHIEF_MARSHAL',
  MARSHAL: 'MARSHAL',
  SIGN_MANAGER: 'SIGN_MANAGER',
  POLICE_NPRA: 'POLICE_NPRA',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ASSIGNABLE_USER_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.RACE_DIRECTOR,
  UserRole.CHIEF_MARSHAL,
  UserRole.MARSHAL,
  UserRole.SIGN_MANAGER,
  UserRole.POLICE_NPRA,
];
```

```typescript
// theme-preference.enum.ts
export type ThemePreference = 'LIGHT' | 'DARK';
```

Use a `const` object when the enum needs runtime members (role guards, nav `roles`, form defaults). Use a string union type alone when only typing is required and no shared runtime object is needed.

- **Domain models** import enum types from `../enums/...` and use them on interfaces (for example `role: UserRole` on `TenantUserListItem`, `themePreference: ThemePreference` on profile DTOs).
- **Role checks**: Centralize role comparisons in `app/core/auth/role.util.ts` using `UserRole` constants (for example `UserRole.ADMIN`, `UserRole.SYSTEM_ADMIN`). Navigation `roles` arrays and `NavItem.roles` should use `UserRole` values, not raw strings.
- **Role display labels**: Centralize human-readable role labels in `app/core/utils/user-role-label.util.ts` (`USER_ROLE_LABELS`, `formatUserRoleLabel`). Do not duplicate `Record<UserRole, string>` maps in feature components. See **Shared helpers and reused behavior** below.
- **Do not** use the TypeScript `enum` keyword in frontend apps unless a future ADR standardizes it; the `const` object pattern keeps values aligned with backend string enums and works cleanly with `NonNullableFormBuilder` when you type controls explicitly (for example `this.formBuilder.control<UserRole>(UserRole.MARSHAL)`).

#### Shared helpers and reused behavior

Extract logic to a shared module when the **same mapping, formatter, constant, or pure function** appears in more than one component, service, or template — not only enum labels.

| Kind of behavior | Location | Example |
|------------------|----------|---------|
| API-aligned enum display labels | `app/core/utils/<entity>-label.util.ts` | `user-role-label.util.ts` → `formatUserRoleLabel` |
| Authorization / role membership checks | `app/core/auth/role.util.ts` | `hasAnyRole`, `isTenantAdminRole` |
| Generic, non-domain helpers (CSV, dates, strings) | `app/shared/utils/<name>.util.ts` | `download-csv.util.ts` |
| API URL building | `app/core/api/api-url.util.ts` | `buildApiV1Url` |

Rules:

- **One file per concern** — separate `*.util.ts` files; do not grow a catch-all `helpers.ts`.
- **Naming** — `<concern>.util.ts` with exported functions in camelCase (`formatUserRoleLabel`) and exported constant maps in `SCREAMING_SNAKE` (`USER_ROLE_LABELS`).
- **No duplication in features** — feature components import the util; they may expose `protected formatX = formatXUtil` only when the template needs a method reference.
- **Tests** — add `*.util.spec.ts` when the helper encodes non-trivial rules (escaping, fallbacks, mappings). Skip tests for one-line pass-through wrappers.
- **i18n** — when labels must be translated, use `TranslationService` / translation keys instead of a static English map in a util (see Internationalization). Static English maps are acceptable only where product explicitly defers i18n for that surface.

```typescript
// app/core/utils/user-role-label.util.ts
import { UserRole } from '../models/enums/user-role.enum';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  // ...
};

export function formatUserRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role] ?? role;
}
```

```typescript
// users.component.ts — reuse; do not redefine ROLE_LABELS
import { formatUserRoleLabel } from '../../core/utils/user-role-label.util';

export class UsersComponent {
  protected formatRole = formatUserRoleLabel;
}
```

#### Interface Naming
- **Domain Models**: `Feature` (singular, PascalCase)
- **List Items**: `FeatureListItem` (for grid/list views)
- **DTOs**: `CreateFeatureDto`, `UpdateFeatureDto`, `SearchFeatureDto`
- **Response Models**: `PaginatedFeatureResponse`
- **Shared API Envelopes**: `ApiEnvelope<T>`, `ApiError`, and `ApiEnvelopeMeta` belong in `core/models/shared`
- **Endpoint Unions**: `EntityEndpoint` belongs in `core/models/shared`

#### Base Models
- Extend `AuditableEntryBase` for entities with audit fields when the frontend owns audit-aware UI
- Use consistent property naming (camelCase)
- Include proper TypeScript types

#### Model Example
```typescript
export interface SignType {
  id: number;
  signCategoryId: number;
  name: string;
  icon: string;
  displayOrder: number;
}
```

### API Integration Standards

#### API URL Management
- Configure the backend host in `src/environments/environment.ts` as `api.baseUrl` (Azure Functions origin, **no trailing slash** — e.g. `http://localhost:7071` for local dev). Use an empty string when the Angular app and API are served from the same origin (reverse proxy).
- **Never** hardcode `/api/v1/...` in services. Use `buildApiV1Url()` from `app/core/api/api-url.util.ts`:

```typescript
import { buildApiV1Url } from '../api/api-url.util';

this.httpClient.get<ApiEnvelope<UsersListResponse>>(buildApiV1Url('users'));
this.httpClient.post<ApiEnvelope<TenantListItem>>(buildApiV1Url('tenants'), request);
this.httpClient.patch<ApiEnvelope<UserProfile>>(buildApiV1Url('users/me/profile'), request);
```

- Pass only the path **after** `/api/v1/` (e.g. `'users'`, `'auth/switch-tenant'`, `'users/7/reinvite'`). `EntityEndpoint` values (`'countries'`, `'sign-types'`, …) map directly to `buildApiV1Url(endpoint)`.
- Interceptors (`authTokenInterceptor`, `tenantHeaderInterceptor`) use `normalizeRequestPath()` from the same util so Bearer and `x-tenant-id` rules work for both relative and absolute URLs.
- Unit tests clear `environment.api.baseUrl` in `src/test-setup.ts` so `HttpTestingController` expectations stay as `/api/v1/...`.
- For entity services, use backend entity route segments directly or a shared `EntityEndpoint` union
- Follow RESTful naming conventions
- Do not introduce grouped frontend URLs such as `/api/v1/lookups/<entity>` for concrete entity reads

#### API URLs Example
```typescript
export type EntityEndpoint =
  | 'countries'
  | 'sign-categories'
  | 'sign-types'
  | 'marshal-categories'
  | 'marshal-types'
  | 'zone-categories'
  | 'zone-types';
```

#### HTTP Response Handling
- Use `ApiEnvelope<T>` for backend-app API responses
- Implement proper error handling in services
- Use RxJS operators for data transformation

### Authentication Standards

#### MSAL Configuration
- Use Azure AD authentication with MSAL
- Configure interceptors for automatic token handling
- Implement route guards for protected routes

#### Authentication Flow
1. **MSAL Instance**: Configured in `app.config.ts`
2. **Route Guards**: Use `MsalGuard` for protected routes
3. **Token Interceptors**: Automatic token injection via `IdTokenInterceptor`
4. **User Context**: Access user information via MSAL service

### Internationalization (i18n)

v1 ships **frontend-owned** translations for **`nb-NO`** (default) and **`en-GB`** via **runtime JSON bundles** loaded by `TranslationService`. The backend persists `User.PreferredLocale` only; it does not expose `/api/v1/locales` or translation-management APIs (see `FR-I18N-*` in `docs/SOLUTION_PRD.md`).

Applies to **`frontend-app`** and **`mobile-pwa`** unless a story explicitly defers PWA i18n setup.

#### Mandatory rule: always update language references

Whenever you add or change **any user-visible string**, you **must** update **all** language JSON files in the same change.

| Change type | Required updates |
|-------------|------------------|
| New or edited label, button, heading, hint, toast, aria-label, placeholder | Add a stable key in templates (`{{ 'area.key' \| translate }}`) or call `TranslationService.translate('area.key')` in TypeScript |
| New or renamed key | Update **`public/assets/i18n/en.json`** and **`public/assets/i18n/no.json`** |
| New shipped locale (rare) | Add `public/assets/i18n/<lang>.json`, extend `translation-lang.ts`, `SHIPPED_LOCALES`, and profile selectors |

**Never** leave hard-coded user-visible strings when i18n is enabled. **Never** merge UI copy without updating **both** JSON files.

#### Translation files and keys

| File | Role |
|------|------|
| `public/assets/i18n/en.json` | English (`en-GB`) copy |
| `public/assets/i18n/no.json` | Norwegian (`nb-NO`) copy |
| `src/app/core/i18n/translation.service.ts` | Loads JSON and switches language at runtime (no page reload) |
| `src/app/core/i18n/translate.pipe.ts` | Template helper: `{{ 'users.title' \| translate }}` |
| `src/app/core/i18n/locale-labels.ts` | Human-readable language names in selectors |

- Key convention: dot-separated paths (`profile.saveProfile`, `apiError.forbidden`, `common.cancel`).
- Reuse shared keys instead of duplicating text with new ids.
- Interpolation: `{{ 'users.deactivate.message' | translate: { name: user.displayName } } }` with `{{name}}` placeholders in JSON.

#### Runtime behaviour

- On startup, `TranslationService` loads `no.json` (product default), then applies `User.PreferredLocale` after tenant bootstrap when authenticated.
- Profile language changes call `TranslationService.useShippedLocale()` — **instant UI update**, no navigation reload.
- API codes map through `api-error-message.service.ts` using translation keys under `apiError.*` and `signIn.error.*`.
- Register `registerLocaleData` / `LOCALE_ID` in `app.config.ts` when date/number formatting is required.

#### Local serve and build

| Intent | Command |
|--------|---------|
| Development | `npm start` / `ng serve` at `http://localhost:4200/` |
| Production build | `npm run build` → single `dist/locusbase/browser/` with both JSON bundles under `/assets/i18n/` |

#### Checklist before marking i18n work complete

- [ ] No raw translation keys visible in the UI (missing key in JSON).
- [ ] Both `en.json` and `no.json` updated for every new/changed key.
- [ ] TypeScript messages use `TranslationService.translate()`, not hard-coded English.
- [ ] Profile/invite locale selectors use `LOCALE_LABELS`, not bare `nb-NO` / `en-GB` codes.
- [ ] Language switch on Profile updates the UI without reload.

#### Out of scope (do not implement in frontend without a story)

- Backend `Locale` / `*Translation` tables or `PUT /lookups/translations/...`
- `GET /api/v1/locales` (use `SHIPPED_LOCALES` in `user-admin.model.ts`)
- System Admin in-app translation editors

### UI/UX Standards

#### Angular Material Usage
- Import all Material modules in `material.module.ts`
- Use Material components consistently across the application
- Follow Material Design principles

#### Component Library
- **Shared Components**: Located in `shared/components/`
- **Reusable Components**: `ListGridComponent`, `SpinnerComponent`, etc.
- **Custom Components**: Extend Material components when needed

#### Styling Standards
- Use SCSS for component styles
- Follow BEM methodology for CSS class naming where component-specific layout needs it
- Use Angular Material theming system
- Implement responsive design principles
- Always use '1st January 2025' as date format for display only views to show date fields.

#### Global styles and shared utilities (`frontend-app`)
- **Tokens and primitives** live under `src/styles/` and are imported once from `src/styles.scss`:
  - `_tokens.scss` — CSS custom properties (`--ink`, `--line`, `--surface`, etc.)
  - `_base.scss` — resets and layout helpers (`row-flex`, `scroll-y`, …)
  - `_utilities.scss` — **reusable state/typography classes** used across feature templates
  - `_buttons.scss`, `_forms.scss`, `_cards.scss`, `_tables.scss`, `_catalogue.scss`, `_modals.scss`, … — prefixed `lb-*` component patterns
- **Do not copy** utility rules into feature `*.component.scss` files. If a class appears on more than one screen, add or extend it in `_utilities.scss` (or the appropriate `lb-*` partial), then use the class in HTML.
- **Component `*.component.scss`** is for layout and styling that is **unique to that component** (screen shell, grid, avatar row, map pane, etc.).

##### Shared utility classes (use in templates)
| Class | Purpose |
|-------|---------|
| `.muted` | De-emphasized text (table cells, hints, secondary copy) |
| `.muted--spaced` | `.muted` with bottom margin for stacked form copy |
| `.loading` | Simple text placeholder while async data loads (prefer ghost skeletons for list/catalogue screens) |
| `.loading--page-gutter` | `.loading` aligned to page horizontal padding (`36px`) |
| `.loading-state` | Centred spinner + message (legacy; do not use on new list/catalogue screens) |
| `.sr-only` | Screen-reader-only text (e.g. hidden loading label on skeleton containers) |
| `.lb-ghost` | Shimmer skeleton block; combine with size/shape modifiers below |
| `.lb-ghost--xs` … `.lb-ghost--lg` | Skeleton bar heights |
| `.lb-ghost--circle`, `.lb-ghost--pill`, `.lb-ghost--chip` | Avatar, status pill, and swatch placeholders |
| `.lb-ghost--name`, `.lb-ghost--dates`, `.lb-ghost--count` | Common table cell widths (title, date range, numeric count) |
| `.lb-ghost--identifier`, `.lb-ghost--actions` | Slug/code column and compact action button placeholders |
| `.lb-table--skeleton` | Table using `.lb-ghost` placeholders in `th`/`td` (defined in `_tables.scss`) |
| `.lb-list-skeleton` | Non-interactive wrapper for single-card list loading states |
| `.lb-list-skeleton-footer` | Pagination/footer row placeholders under a list skeleton table |
| `.lb-catalogue-skeleton` | Two-column catalogue loading layout (rail + pane; defined in `_catalogue.scss`) |
| `.list-card` | `.lb-card` wrapper for tables/lists (`padding: 0`, `overflow: hidden`) |
| `.list-card--stack` | Full-height flex column list (marshals/signs side panels) |
| `.error-text` | Inline validation or blocking error message |
| `.panel-card` | Padded admin panel body (optional heading spacing) |
| `.panel-card--inset` | Panel with standard page side margins |
| `.form-actions` | Right-aligned Cancel / Submit button row |
| `.lb-screen` | Full-height flex column shell for list/admin pages |
| `.lb-screen-body` | Scrollable content area below `.lb-head` |
| `.lb-search--head` | Narrow search field in page header actions |
| `.row-actions` | Horizontal button group in table rows |
| `.lb-user-cell` | Avatar + name row in tables |
| `.lb-user-avatar--list` | Initials avatar in list/table context |
| `.lb-user-thumb` | Profile image in list/table context |
| `.lb-user-name` | Primary name label in user cells |
| `.lb-table-wrap` | Horizontal scroll wrapper around `.lb-table` |
| `.lb-table__sort` | Sortable column header control |
| `.lb-table__sort-icon` | Sort direction indicator in header |
| `.lb-catalogue-layout` | Two-column grid: category rail + detail pane (sign/marshal catalogue) |
| `.lb-side-rail`, `.lb-rail-item*` | Selectable category list rail with counts and inline admin actions |
| `.lb-catalogue-pane`, `.lb-pane-header*` | Detail pane card header (title, description, search) |
| `.lb-category-chip` | Coloured category label in catalogue tables |
| `.lb-table--hover-actions` | Table with action buttons revealed on row hover |
| `.row-actions--table` | Compact right-aligned action buttons inside `.lb-table--hover-actions` |
| `.col-actions`, `.empty-cell` | Fixed-width actions column; centred empty-state cell |
| `.lb-head__sep`, `.lb-head__lede` | Meta line separator and subtitle under `.lb-head` |
| `.lb-color-chip*`, `.lb-category-preview*` | Category modal colour picker and rail preview tile |
| `.lb-field` | Vertical label/control pair for text inputs, selects, and textareas |
| `.lb-grid` | Responsive form column layout (`.cols-2`, `.cols-3`, `.cols-4`) |
| `.lb-checkbox` | Custom checkbox label + control (navy fill, animated checkmark, focus ring) |
| `.lb-modal-backdrop` | Fixed full-screen overlay behind a dialog (navy scrim + `backdrop-filter` blur) |
| `.lb-modal` | Dialog shell (border, radius, shadow, scroll) |
| `.lb-modal-head` | Header row: title on the left, close control on the right |
| `.lb-modal-body` | Padded form/content area |
| `.lb-modal-foot` | Footer row: right-aligned Cancel + primary submit |

##### Modal patterns (`_modals.scss`)

Use shared modal primitives from `src/styles/_modals.scss` and button variants from `_buttons.scss` for **all** feature modals and confirmation dialogs (users, sign, marshal, zone catalogue, and future admin screens). Do **not** invent per-feature close or submit button styles in component SCSS.

**Reference implementation:** `frontend-app/src/app/features/users/user-invite-modal/`.

**Structure**

```html
@if (open()) {
  <div class="lb-modal-backdrop" role="presentation" (click)="close()" (keydown.escape)="close()">
    <div
      class="lb-modal"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'feature.modalTitle' | translate"
      tabindex="-1"
      (click)="$event.stopPropagation()"
      (keydown.escape)="close()"
    >
      <div class="lb-modal-head">
        <h2>{{ 'feature.modalTitle' | translate }}</h2>
        <!-- header close — see below -->
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="lb-modal-body">…</div>
        <div class="lb-modal-foot">…</div>
      </form>
    </div>
  </div>
}
```

**Header close control (mandatory)**

Every modal header uses the same ghost close button: Cross icon + **Cancel** label. Do **not** use `data-icon="only"` or `common.close` as the sole accessible name for the header dismiss control.

```html
<button class="lb-btn" type="button" data-variant="ghost" (click)="close()">
  <lb-icon name="Cross" [size]="14" />
  <span>{{ 'common.cancel' | translate }}</span>
</button>
```

**Footer actions (form modals)**

| Control | Variant | Notes |
|---------|---------|-------|
| Cancel | default `lb-btn` (no `data-variant`) | Outlined secondary; calls `close()` |
| Submit / Save / Create | `data-variant="primary"` | Dark navy fill, white text — same as **Send invite** |

```html
<div class="lb-modal-foot">
  <button class="lb-btn" type="button" (click)="close()">
    {{ 'common.cancel' | translate }}
  </button>
  <button class="lb-btn" type="submit" data-variant="primary" [disabled]="submitting()">
    {{ 'feature.submit' | translate }}
  </button>
</div>
```

- Use `data-variant="primary"` for all form submit actions. Do **not** use `data-variant="accent"` (orange) on modal footers.
- Disable submit while `submitting()` is true.

**Confirmation / delete dialogs**

Destructive confirms keep `data-variant="danger"` on the confirm button (not `primary`). Header close and footer Cancel follow the same rules as form modals.

```html
<button class="lb-btn" type="button" data-variant="danger" [disabled]="submitting()" (click)="confirm()">
  {{ 'feature.delete.confirm' | translate }}
</button>
```

**Type modals with rich headers**

Catalogue **type** modals (sign, marshal, zone) may use a feature-specific header wrapper (for example `sign-type-modal__head`) for eyebrow, title, and lede copy. The header close button and footer submit variant must still match the patterns above. Component SCSS may adjust header/footer padding only; do not restyle `lb-btn` variants locally.

**Backdrop (mandatory visual)**

Every modal and confirmation dialog uses `.lb-modal-backdrop` from `_modals.scss`. The backdrop combines a semi-transparent navy scrim (`rgba(14, 27, 51, 0.45)`) with a **12px backdrop blur** so the page behind the dialog is softened and de-emphasized while the modal stays in focus. Do **not** add per-feature backdrop colours, blur, or opacity in component SCSS — adjust the shared partial if the product-wide treatment changes.

```scss
// src/styles/_modals.scss — single source for all user, sign, marshal, and zone modals
.lb-modal-backdrop {
  background: rgba(14, 27, 51, 0.45);
  backdrop-filter: blur(12px);
}
```

**Rules**

- Reuse `common.cancel` for both header close label and footer Cancel.
- Backdrop click and `Escape` call the same `close()` handler as the header and footer Cancel buttons.
- Stop propagation on the dialog panel so backdrop clicks do not fire when interacting inside the modal.
- Put modal-specific layout (preview panes, glyph grids) in the feature `*.component.scss`; keep shell, head, body, and foot on shared `lb-modal-*` classes.
- New modals: copy `user-invite-modal` structure before adding fields — do not copy legacy icon-only close buttons from older templates.

##### Form patterns (`_forms.scss`)

Use shared form primitives from `src/styles/_forms.scss` for all modal and admin forms. Do **not** use bare browser-default checkboxes or restyle checkboxes in feature `*.component.scss`.

**`.lb-field`** — vertical label above control; applies text-input border, padding, and focus halo to `input`, `select`, and `textarea` only. Checkbox, radio, and file inputs are **excluded** so they do not inherit text-field dimensions.

**`.lb-checkbox`** — the standard checkbox pattern for optional flags (for example marshal type **Requires mobile certification**, user invite **Set initial language and theme**). Put `class="lb-checkbox"` on the `<label>` that wraps the checkbox and label text.

```html
<div class="lb-field">
  <label class="lb-checkbox">
    <input type="checkbox" formControlName="includePreferences" />
    <span>{{ 'users.invite.includePreferences' | translate }}</span>
  </label>
</div>
```

Rules:

- Always use `lb-checkbox` on the label; do not leave `<input type="checkbox">` unstyled.
- Bind with reactive forms (`formControlName`) or `[checked]` / `(change)` as appropriate; keep the native input for accessibility.
- Do not add component-specific checkbox dimensions, borders, or checkmark styles — extend `_forms.scss` if the shared pattern needs a global change.
- Optional helper copy below a checkbox (for example inherited-colour notes) uses normal `.muted` or feature-specific spacing in component SCSS; only the checkbox control itself is shared.

**Label ↔ control association (WCAG / Sonar)**

Every form control must have a **programmatically associated** label with **accessible text**. Sonar flags missing association as: Associate a valid label to this input field / Add an `id` attribute to this input field and associate it with a label / A form label must be associated with a control and have accessible text.

```html
<!-- Bad — Angular binding; Sonar often cannot resolve [attr.for] -->
<label [attr.for]="'users-filter-name'">{{ 'users.filters.name' | translate }}</label>
<input id="users-filter-name" type="search" />

<!-- Bad — label has no text (icon is aria-hidden) and no for/id -->
<label class="search-field">
  <lb-icon name="Search" aria-hidden="true" />
  <input type="search" />
</label>

<!-- Bad — visible label not linked; separate orphan label for the file input -->
<label><span>{{ '…fileLabel' | translate }}</span></label>
<input id="race-document-file-input" type="file" hidden />

<!-- Good — static for + matching id; visible text on the label -->
<label for="users-filter-name">{{ 'users.filters.name' | translate }}</label>
<input id="users-filter-name" type="search" />

<!-- Good — wrapping label with sr-only text + id on the control -->
<label class="search-field" for="marshal-assign-search">
  <span class="sr-only">{{ '…searchPlaceholder' | translate }}</span>
  <lb-icon name="Search" aria-hidden="true" />
  <input id="marshal-assign-search" type="search" />
</label>

<!-- Good — one label for= the file input -->
<label for="race-document-file-input">
  <span>{{ '…fileLabel' | translate }}</span>
  <span class="req">*</span>
</label>
<input id="race-document-file-input" type="file" hidden />
```

- Prefer **static** `for="…"` / `id="…"` over `[attr.for]` / `[attr.id]` when the id is a fixed string — analyzers and assistive tech resolve static attributes reliably.
- Hidden file inputs still need an associated label (visible or `.sr-only`).
- When the real control is injected by a library (Places autocomplete), do **not** wrap a bare `<div>` in `<label>`. Use `role="search"` on a container and set `aria-label` (or `aria-labelledby`) on the generated `<input>` (see `mountPlaceAutocomplete`).
- Reuse `common.actions` (or the feature’s `*.column.actions` key) for empty table actions columns via `.sr-only` — do not leave header cells unlabeled.

##### Ghost skeleton loading (list and catalogue screens)

Use **layout-shaped ghost skeletons** instead of centred spinners (`.loading-state`) when a screen loads tabular or catalogue data. The skeleton should mirror the loaded layout so the transition feels stable.

**Rules**

- Wrap the skeleton in a native `<output>` with `aria-busy="true"` (see **Semantic status regions (Sonar)**). Do **not** use `role="status"` or redundant `aria-live="polite"` on a generic element.
- Provide a screen-reader-only loading label via `.sr-only` and the feature’s `*.loading` translation key.
- Mark **decorative** skeleton regions (for example the outer wrapper or ghost bars) with `aria-hidden="true"`.
- Do **not** put `aria-hidden="true"` on focusable or table-header cells (`<th>`, `<button>`, `<a>`, `[tabindex]`). Sonar flags it as: `aria-hidden="true"` must not be set on focusable elements. For empty actions columns use `<th scope="col"><span class="sr-only">{{ 'common.actions' | translate }}</span></th>` instead (ghost bars inside may still be `aria-hidden`).
- When a parent already has `aria-hidden="true"`, do not repeat it on nested `<th>` cells.
- Reuse shared classes from `_utilities.scss`, `_tables.scss`, and `_catalogue.scss`. Do not redefine shimmer animation or ghost bar styles in component SCSS.
- Put **layout-specific** skeleton dimensions only in the feature `*.component.scss` when no shared modifier exists (e.g. users detail panel).
- Show **7 skeleton rows** for paginated lists unless the loaded view consistently shows fewer.
- Respect role-gated columns in the skeleton (e.g. admin actions column, duplicate-race buttons) using the same `@if` guards as the loaded template.

**Patterns**

| Screen type | Wrapper class | Shared partials |
|-------------|---------------|-----------------|
| Paginated list (races) | `.lb-list-skeleton` inside `.list-card` | `_utilities.scss`, `_tables.scss` |
| List + detail (users) | `.lb-users-skeleton` on grid + `.lb-list-skeleton-footer` | `_utilities.scss`, `_tables.scss`; detail pane in component SCSS |
| Catalogue (sign/marshal/zone) | `.lb-catalogue-layout.lb-catalogue-skeleton` | `_catalogue.scss`, `_tables.scss` |

Example (paginated list — races):

```html
<div class="lb-card list-card">
  @if (loading()) {
    <output class="lb-list-skeleton" aria-busy="true">
      <span class="sr-only">{{ 'races.loading' | translate }}</span>
      <div class="lb-table-wrap" aria-hidden="true">
        <table class="lb-table lb-table--skeleton">
          <thead>…</thead>
          <tbody>
            @for (row of [1, 2, 3, 4, 5, 6, 7]; track row) {
              <tr>
                <td><span class="lb-ghost lb-ghost--sm lb-ghost--name"></span></td>
                …
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="lb-list-skeleton-footer">…</div>
    </output>
  } @else {
    <table class="lb-table">…</table>
  }
</div>
```

Example (catalogue — sign/marshal/zone):

```html
@if (loading()) {
  <output class="lb-catalogue-layout lb-catalogue-skeleton" aria-busy="true">
    <span class="sr-only">{{ 'signCatalogue.loading' | translate }}</span>
    <aside class="lb-side-rail lb-card" aria-hidden="true">…category rail ghosts…</aside>
    <div class="lb-catalogue-pane lb-card" aria-hidden="true">…table ghosts…</div>
  </output>
} @else {
  <div class="lb-catalogue-layout">…</div>
}
```

```scss
// Feature component SCSS — shell/layout only; skeleton primitives live in global partials
:host {
  display: block;
  height: 100%;
}
```

- Prefer **`lb-*` prefixed** classes for new shared UI primitives (buttons, fields, cards). Use **unprefixed utility names** above for cross-cutting states already established in F-6.2 screens.
- When a utility needs a one-off tweak, prefer a **modifier class** in `_utilities.scss` or `_tables.scss` (for example `lb-ghost--dates`) over redefining the base utility in a component file.
- Do **not** add centred `.loading-state` spinners to new list or catalogue screens.

##### SCSS mixins and nesting selectors (Sonar)
Do **not** use the nesting selector `&` at the top level of an `@mixin` (or other at-rule without a parent selector). Sonar / Stylelint flag it as: Missing scoping root.

Expand `&::-webkit-*` (and similar) on the concrete selector that includes the mixin, not inside the mixin itself.

```scss
// Bad — & has no scoping root inside the mixin
@mixin lb-scrollbar {
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    width: 8px;
  }
}

// Good — mixin holds non-nested props; webkit rules live on the include site
@mixin lb-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.scroll-y,
.lb-page {
  @include lb-scrollbar;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
}
```

##### Stylesheet entry (`@use` / `@import`)
- Prefer Sass **`@use`** for all partials and for Bootstrap (`@use 'bootstrap/scss/bootstrap'`).
- Do **not** place CSS `@import` after `@use` or after other rules. Sonar flags it as: Invalid position for `@import` rule.
- Keep app global rules (`html`, `body`, …) **after** the `@use` block in `styles.scss`.

#### Global styles (`mobile-pwa`)
- Import shared partials from `src/styles.scss` via `@use` (before any plain CSS rules).
- Reuse the same utility **names** where applicable (`.loading`, `.error-text`, `.muted`, `.sr-only`). Add PWA-specific tokens or modifiers in `mobile-pwa/src/styles/_utilities.scss` only when field/Ionic layout requires it.
- Include `.sr-only` in `mobile-pwa` utilities whenever templates need screen-reader-only text (same clip pattern as `frontend-app`).

### State Management

#### Service-Based State
- Use Angular services for state management
- Implement reactive patterns with RxJS
- Use `BehaviorSubject` for shared state
- Avoid global state management libraries unless necessary

#### Data Flow
1. **Services**: Handle API calls and data transformation
2. **Components**: Subscribe to service observables
3. **Templates**: Use async pipe for reactive data binding

### Error Handling

#### Service Level
- Use RxJS error operators (`catchError`, `retry`)
- Implement proper error logging
- Return meaningful error messages

#### Component Level
- Use `AlertService` for user notifications
- Use ghost skeleton utilities (see **Ghost skeleton loading**) for initial list/catalogue fetches; reserve `LoaderService` for blocking actions (save, export, etc.)
- Handle errors gracefully in templates

### Testing Standards

#### Unit Testing
- Use Vitest through the Angular test builder for unit tests
- Test components, services, and pipes
- Maintain high test coverage
- Use Angular testing utilities

#### Assertions (Sonar S2699)
Every `it(...)` / `test(...)` case **must** include at least one explicit assertion via `expect(...)` (or an equivalent Vitest matcher such as `expect.soft`). Sonar does **not** treat HTTP testing helpers as assertions even when they throw on failure.

| Not enough alone (Sonar still flags) | Add an explicit assertion |
|--------------------------------------|---------------------------|
| `http.expectOne(...)` | `expect(request.request.url).toBe(...)` |
| `http.expectNone(...)` | `expect(values).toEqual(...)` after flush |
| `http.verify()` | `expect(request.request.headers.has(...)).toBe(...)` |
| `.subscribe()` with no checks | Assert emitted values, request URL, headers, or call counts |

```typescript
// Bad — no expect(...); Sonar: "Add at least one assertion to this test case."
it('uses canonical entity endpoints', () => {
  const http = configureServices(7);
  TestBed.inject(SignTypeService).getAll().subscribe();
  http.expectOne(buildApiV1Url('sign-types')).flush({ data: [], error: null });
  http.verify();
});

// Good — expect(...) plus HttpTestingController helpers
it('uses canonical entity endpoints without a locales endpoint', () => {
  const http = configureServices(7);
  TestBed.inject(SignTypeService).getAll().subscribe();

  const request = http.expectOne(buildApiV1Url('sign-types'));
  expect(request.request.url).toBe(buildApiV1Url('sign-types'));
  request.flush({ data: [], error: null });

  http.expectNone(buildApiV1Url('locales'));
  http.verify();
});
```

#### Running tests (developers and agents)
- **Developers** run tests manually when validating work (for example `npm test` in `frontend-app` or `mobile-pwa`). Do not assume CI or another agent has already run them.
- **AI agents** must **not** run the full test suite automatically after every implementation step or at the end of every task. The user triggers tests manually (or explicitly asks the agent to run them, e.g. via `*run-tests`).
- Agents **should** still add or update `.spec.ts` files when implementing or changing behavior, and may run a **single** targeted test only when the user asks for verification of that specific test.
- Before merge, the author (human) confirms tests pass locally or in CI — agents do not block on having executed the suite themselves unless the user requests it.

#### Test File Structure
- **Component Tests**: `component-name.component.spec.ts`
- **Service Tests**: `service-name.service.spec.ts`
- **Pipe Tests**: `pipe-name.pipe.spec.ts`
- **Entity Service Tests**: may be grouped in `entity-services.spec.ts` when they verify the same shared base behavior across related entity services.

#### Entity Service Test Expectations
- Verify each entity service calls its canonical `/api/v1/<entity-route>` URL.
- Verify tenant headers are sent for tenant-scoped reads.
- Verify cache entries are not replayed across tenant changes.
- Verify out-of-scope endpoints are not requested, for example `/api/v1/locales`.

### Performance Standards

#### Bundle Optimization
- Use Angular CLI production builds
- Implement lazy loading for feature modules
- Use `OnPush` change detection strategy where appropriate
- Minimize bundle size with tree shaking

#### Runtime Performance
- Use `trackBy` functions for `*ngFor` loops
- Implement virtual scrolling for large lists
- Use `async` pipe to prevent memory leaks
- Optimize change detection cycles

### Security Standards

#### Authentication
- Use Azure AD for secure authentication
- Implement proper token management
- Use HTTPS for all API communications
- Validate user permissions on both client and server

#### Data Protection
- Sanitize user inputs
- Use Angular's built-in XSS protection
- Implement proper CORS policies
- Follow OWASP security guidelines

#### Random values and unique IDs
- Do **not** use `Math.random()` for IDs, tokens, nonces, session keys, or any value that must be unpredictable. Sonar flags it as an insecure pseudorandom generator.
- For unique DOM ids (for example `aria-controls`, listbox/option ids), use `crypto.randomUUID()`:
  ```typescript
  const listId = `lb-place-autocomplete-list-${crypto.randomUUID()}`;
  ```
- For binary random bytes (nonces, salts when required on the client), use `crypto.getRandomValues()`.
- Prefer a counter, stable key, or framework-generated id when uniqueness alone is enough and cryptographic unpredictability is not required.

### Code Quality Standards

#### Async returns (Sonar)
In an `async` function or method, do **not** wrap the result in `Promise.resolve(...)`. Sonar flags `return Promise.resolve(value)` as: prefer `return value` over `return Promise.resolve(value)`.

`async` already wraps the returned value (or `undefined` for a bare `return`) in a resolved promise.

```typescript
// Bad — Sonar: Prefer `return value` over `return Promise.resolve(value)`
async connect(raceId: number): Promise<void> {
  if (this.connectionHealthState() === 'connected') {
    return Promise.resolve();
  }
  // ...
}

// Good — bare return / return value; async wraps it
async connect(raceId: number): Promise<void> {
  if (this.connectionHealthState() === 'connected') {
    return;
  }
  // ...
}
```

- Use `return;` for `Promise<void>` early exits.
- Use `return value;` (not `return Promise.resolve(value)`) when returning a concrete result from an `async` method.
- Returning an existing `Promise` (for example `return this.startPromise`) is fine — that is awaiting/delegating work, not wrapping a sync value.
- Prefer a non-`async` method that returns `Promise.resolve()` only when you must satisfy a `Promise`-typed API without using `async` (see backend intentional no-op guidance when applicable).

#### Await only Thenables (Sonar)
Do **not** `await` a value that is not a Promise (or other Thenable). Sonar flags `await` of a non-Promise as: Unexpected `await` of a non-Promise (non-"Thenable") value.

Check the library type signature before awaiting. Sync APIs that return `void` must be called without `await`.

```typescript
// WebPubSubClient: start(): Promise<void>; stop(): void;

// Bad — Sonar: Unexpected `await` of a non-Promise (non-"Thenable") value.
await client.stop();

// Good — stop is synchronous
client.stop();

// Good — start returns a Promise
await client.start();
```

- Prefer `try` / `catch` around sync calls that may throw (for example best-effort dispose) without wrapping them in `await`.
- Keep `await` for methods typed as `Promise<…>` (for example `client.start()`, `client.joinGroup(...)`).
- When mirroring Azure Web PubSub client usage in `frontend-app` and `mobile-pwa`, treat `stop()` as sync in both apps.

#### Cognitive complexity (Sonar)
Do **not** write a function or method whose Sonar cognitive complexity exceeds **15**. Sonar flags this as: `Refactor this function to reduce its Cognitive Complexity from N to the 15 allowed.`

Extract helpers, replace nested ternaries with early returns or maps, and keep component methods / pipes / utilities flat. Do not suppress the Sonar rule; refactor instead. Preserve behavior when extracting helpers for complexity only.

#### Function nesting depth (Sonar)
Do **not** nest functions more than 4 levels deep. Sonar flags deep nesting as: Refactor this code to not nest functions more than 4 levels deep.

Nested `.then(() => …)` chains are a common cause (for example app initializer factories). Prefer sequential `async` / `await` so each step stays at one nesting level. Register initializers with `provideAppInitializer`, not the deprecated `APP_INITIALIZER` token.

```typescript
// Bad — Sonar: Refactor this code to not nest functions more than 4 levels deep.
return () =>
  translation.use(DEFAULT_TRANSLATION_LANG).then(() =>
    translation.preloadShippedLocales().then(() =>
      firstValueFrom(msalService.initialize()).then(() =>
        firstValueFrom(msalService.handleRedirectObservable()).then(async (result) => {
          // ...
        }),
      ),
    ),
  );

// Good — flat sequential awaits
return async () => {
  await translation.use(DEFAULT_TRANSLATION_LANG);
  await translation.preloadShippedLocales();
  await firstValueFrom(msalService.initialize());
  const result = await firstValueFrom(msalService.handleRedirectObservable());
  // ...
};
```

- Prefer `async` / `await` over nested `.then()` for sequential promise work in `frontend-app` and `mobile-pwa`.
- Extract a named helper when logic still needs callbacks and nesting would exceed 4 levels.
- Applies to arrow callbacks, `.then` handlers, and nested function declarations alike.

#### void operator (Sonar)
Do **not** use the TypeScript `void` operator on expression statements. Sonar flags it as: Remove this use of the "void" operator.

| Situation | Prefer |
|---|---|
| Call a sync method that returns `void` | Call it directly — no operator needed |
| Fire-and-forget a `Promise` (including from `ngOnInit`) | Chain `.catch(() => undefined)` (or handle the error) |
| Track a signal in an `effect` without using its value | Call the signal: `this.assignment();` |
| Inject a service only for constructor side effects (`provideAppInitializer` / DI) | Prefix the unused param with `_`, or call `inject(Service)` without binding when side-effect construction is enough |

```typescript
// Bad — Sonar: Remove this use of the "void" operator.
void this.resolveQrCode(code);
void this.syncDrawingManager(enabled);
void this.assignment().postId;
void themePreferenceService;

// Good — sync void call
this.resolveQrCode(code);

// Good — intentional fire-and-forget Promise
this.syncDrawingManager(enabled).catch(() => undefined);

// Good — effect dependency on a signal
effect(() => {
  this.assignment();
  this.hadValidProximity = false;
});

// Good — side-effect DI via APP_INITIALIZER deps (param unused on purpose)
function initializeApp(
  // ...
  _themePreferenceService: ThemePreferenceService,
  _localePreferenceService: LocalePreferenceService,
  // ...
): () => Promise<void> {
  return async () => {
    // services are constructed via deps; no need to reference them here
  };
}
```

- Do **not** use `void expr` to silence unused-variable or floating-promise warnings.
- Prefer `.catch(...)` over `void` for promises so rejections are handled (even as a no-op) instead of left floating.
- Reading a nested property (`this.assignment().postId`) as a bare statement is unnecessary when calling `this.assignment()` already establishes the signal dependency.
- Lifecycle hooks that start async work must stay sync and use `.catch(...)` — see **Lifecycle hooks (OnInit)**.

#### Regular expressions (Sonar)
Do **not** ship regexes with unbounded / ambiguous quantifiers that can backtrack super-linearly. Sonar flags them as: Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.

Prefer string loops, `endsWith` / `startsWith`, bounded quantifiers, or DOM APIs over risky patterns.

| Avoid (common smells) | Prefer |
|---|---|
| `.replace(/\/+$/, '')` / `.replace(/^\/+/, '')` | Trim with a `while` + `charCodeAt` / `endsWith` loop |
| `/[^\s@]+@[^\s@]+\.[^\s@]+/` | Bounded email pattern, e.g. `/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/` |
| `/[^a-z0-9]+/g` then trim `_` | Character-walk slugify helper (see `slugify-canonical-name.util.ts`) |
| `/<[^>]+>/g` HTML strip | `DOMParser().parseFromString(...).body.textContent` |
| `\d+\.?\d*` style numerics | `\d+(?:\.\d+)?` (optional group, no ambiguous digit backtrack) |

- Shared URL slash trimming belongs in `api-url.util.ts` helpers reused by both apps.
- Do not suppress the rule; rewrite the pattern or replace regex with linear string logic.

#### Accessibility: ARIA, roles, and focus (Sonar)
Keep interactive semantics on native interactive elements. Do not paper over markup with conflicting ARIA.

| Rule | Do | Don’t |
|---|---|---|
| Focusable + `aria-hidden` | Hide decorative **children** (icons, ghost bars) | `aria-hidden="true"` on `<th>`, `<button>`, `<a>`, or anything with `tabindex` |
| `tabindex` | Native controls; `autofocus` on a dialog’s close/primary control | `tabindex="0"` (or positive) on `<dialog>`, `<div>`, `<article>`, `<span>` |
| Interactive roles | Use `<button>`, `<a>`, `<input>` | `role="button"` / `role="link"` on `<div>` / `<article>` |
| Non-interactive roles on controls | Omit role, or use a real list (`<ul>`/`<li>`) | `role="listitem"` on a `<button>`; `role="presentation"` on an interactive control |
| Menu item wrappers | `role="presentation"` on `<li>` wrapping `role="menuitem"` | `role="none"` (Sonar treats it as invalid in our profile) |
| Clickable cards | `<button type="button" class="…card">` with phrasing content (`span`) | `<article role="button" tabindex="0">` with headings/paragraphs |

```html
<!-- Bad -->
<th scope="col" aria-hidden="true"></th>
<dialog tabindex="0" (keydown)="onKey($event)">…</dialog>
<article role="button" tabindex="0" (click)="open()">…</article>
<button type="button" role="listitem">…</button>
<li role="none"><button role="menuitem">…</button></li>

<!-- Good -->
<th scope="col"><span class="sr-only">{{ 'common.actions' | translate }}</span></th>
<dialog (keydown)="onKey($event)">
  <button type="button" autofocus [attr.aria-label]="'common.close' | translate">…</button>
</dialog>
<button type="button" class="card" (click)="open()">
  <span class="card-title">…</span>
</button>
<ul><li><button type="button">…</button></li></ul>
<li role="presentation"><button type="button" role="menuitem">…</button></li>
```

- Keyboard handlers on overlays should rely on focus inside the overlay (autofocus a button), not on making a non-interactive host tabbable.
- When converting a clickable card to `<button>`, replace `header` / `h2` / `p` with `span` (button content model is phrasing content).

#### Accessibility: click requires keyboard (Sonar)
Do **not** attach `(click)` to a non-interactive host (`div`, `tr`, `td`, `span`, `article`) without a keyboard path. Sonar flags it as: Add a `onKeyDown|onKeyUp` attribute to this tag.

**Prefer native controls** (avoids both this rule and interactive-role-on-non-interactive):

| Pattern | Prefer |
|---|---|
| Modal / sheet backdrop dismiss | `<button type="button" class="…backdrop" [attr.aria-label]="…">` |
| Clickable card / chip | `<button type="button">` (phrasing content only) |
| Row selection / expand | Keyboard handlers + `tabindex="0"` on `<tr>`, or a control inside the row |

```html
<!-- Bad — click-only div backdrop -->
<div class="layers-backdrop" (click)="close()" aria-hidden="true"></div>

<!-- Good — native button backdrop -->
<button
  type="button"
  class="layers-backdrop"
  [attr.aria-label]="'…close' | translate"
  (click)="close()"
></button>

<!-- Acceptable when a native control is impractical (e.g. whole-row select) -->
<tr
  tabindex="0"
  (click)="select(id)"
  (keydown.enter)="select(id)"
  (keydown.space)="$event.preventDefault(); select(id)"
>
```

- Backdrop buttons need CSS resets (`margin: 0; padding: 0; border: 0; cursor: pointer`) so they keep overlay styling.
- For stop-propagation shells, add `(keydown)="$event.stopPropagation()"` alongside `(click)`.
- For dismiss-on-outside-click overlays, also handle `(keydown.escape)`.
- Do **not** add `role="button"` on a `div`/`tr` as a shortcut — that reintroduces conflicting ARIA smells; use a real `<button>` when the whole surface is the control.

#### Image `alt` text (Sonar)
Do **not** put redundant words like **photo**, **image**, **picture**, or **icon** in `alt` — including in the **i18n key** and the translated string. Sonar analyzes the template string literal (for example `'incidents.detail.photoAlt'`), so a key containing `photo` still fails even when the English value is clean. Sonar flags it as: Remove redundant word 'photo' from the 'alt' attribute.

```html
<!-- Bad — key and/or value contain "photo" -->
<img [alt]="'incidents.detail.photoAlt' | translate" />
<!-- en: "Incident evidence photo" -->

<!-- Good — key and value avoid media-type words -->
<img [alt]="'incidents.detail.evidenceAlt' | translate" />
<!-- en: "Incident evidence" -->
```

- Keep `alt` short and descriptive of the content, not the media type.
- Name i18n keys for `alt` without `photo` / `image` / `picture` / `icon` (prefer `evidenceAlt`, `thumbnailAlt`, etc.).
- Decorative images use `alt=""` and `aria-hidden="true"` (or CSS background), not filler words.

#### List markup (Sonar)
Every `<li>` must be a direct child of `<ul>` or `<ol>` (or a script-supporting element inside those). Sonar flags orphaned items as: Surround this `<li>` item tag by a `<ul>` or `<ol>` container.

```html
<!-- Bad — li inside <output> without ul -->
<output aria-busy="true">
  @for (row of skeletonRows; track row) {
    <li>…</li>
  }
</output>

<!-- Good -->
<output aria-busy="true">
  <ul class="…skeleton-list">
    @for (row of skeletonRows; track row) {
      <li>…</li>
    }
  </ul>
</output>
```

#### `String#codePointAt` (Sonar)
Prefer `String#codePointAt()` over `String#charCodeAt()` when reading character codes. Sonar flags `charCodeAt` for Unicode / internationalization consistency.

```typescript
// Bad
while (index < value.length && value.charCodeAt(index) === 47) { … }

// Good
while (index < value.length && value.codePointAt(index) === 47) { … }

// Good — codePointAt may be undefined
acc + (c.codePointAt(0) ?? 0)
```

#### `String#replaceAll` (Sonar)
Prefer `String#replaceAll()` over `String#replace()` when replacing **all** occurrences (ES2021+). Sonar flags global `.replace(/…/g, …)` as: Prefer `String#replaceAll()` over `String#replace()`.

```typescript
// Bad
value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
payload.replace(/-/g, '+').replace(/_/g, '/');

// Good — literal needles as strings
value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
payload.replaceAll('-', '+').replaceAll('_', '/');

// Good — pattern still needs a RegExp (keep the `g` flag with replaceAll)
raw.replaceAll(/\D/g, '');
```

- Use `.replace()` only when replacing a **single** occurrence (for example anchored `^\uFEFF`).
- When passing a RegExp to `replaceAll`, it **must** include the `g` flag or the runtime throws.

#### DOM data attributes (Sonar)
Prefer the `dataset` API over `setAttribute` / `getAttribute` when reading or writing `data-*` attributes. Sonar flags `setAttribute('data-…', …)` as: prefer `.dataset` over `setAttribute(…)`.

```typescript
// Bad — Sonar: Prefer `.dataset` over `setAttribute(…)`
root.setAttribute('data-theme', theme === 'DARK' ? 'dark' : 'light');

// Good — use bracket access (TS4111: `DOMStringMap` is an index signature)
root.dataset['theme'] = theme === 'DARK' ? 'dark' : 'light';
```

- `data-theme` maps to `dataset['theme']`; kebab-case names become camelCase on `dataset` (for example `data-user-id` → `dataset['userId']`).
- Do **not** use dot access (`dataset.theme`) when `noPropertyAccessFromIndexSignature` is enabled — that triggers TS4111.
- Use `setAttribute` only for non-`data-*` attributes (for example `aria-*`, `role`, `class` when not using `classList`).

#### Semantic status regions (Sonar)
Do **not** put `role="status"` on a generic element (`div`, `p`, `span`, `section`, etc.). Sonar flags it as: Use `<output>` instead of the status role to ensure accessibility across all devices.

Prefer the native `<output>` element. It has an implicit status role and polite live region, so drop redundant `role="status"` and `aria-live="polite"`. Keep `aria-busy="true"` when the region represents an in-progress load.

Applies to **`frontend-app`** and **`mobile-pwa`** templates (loading skeletons, sync/status pills, empty/loading banners, busy overlays that announce status).

```html
<!-- Bad — Sonar: Use <output> instead of the status role -->
<div class="planner-loading" role="status" aria-live="polite" aria-busy="true">
  <p>{{ 'planner.loading' | translate }}</p>
</div>

<p class="places-hint" role="status">{{ 'planner.places.unavailable' | translate }}</p>

<!-- Good — native <output>; keep aria-busy when loading -->
<output class="planner-loading" aria-busy="true">
  <p>{{ 'planner.loading' | translate }}</p>
</output>

<output class="places-hint">{{ 'planner.places.unavailable' | translate }}</output>
```

- `<output>` is **inline** by default. If the previous element was block-level, ensure the CSS class sets `display: block` (or `flex` / `grid` / `inline-flex` as needed) so layout does not collapse.
- Do **not** suppress the Sonar rule; use `<output>` instead.
- This rule is only for **status** live regions. Do not blindly replace custom `role="dialog"`, `role="listbox"`, or `role="option"` widgets with native elements without a deliberate a11y redesign.

#### Deprecated Angular APIs (Sonar)
Do **not** use obsolete Angular tokens or Router APIs. Sonar flags them as deprecated / obsolete.

| Avoid | Prefer |
|---|---|
| `APP_INITIALIZER` multi-provider | `provideAppInitializer(() => …)` with `inject()` inside the initializer |
| Split `@angular/core` imports across multiple statements | One import list from `@angular/core` |
| `router.getCurrentNavigation()` | `router.currentNavigation()` (signal) |

```typescript
// Bad
import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
{ provide: APP_INITIALIZER, useFactory: initializeApp, deps: […], multi: true }
router.getCurrentNavigation()?.extras?.state?.['raceStatus']

// Good
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
provideAppInitializer(initializeApp)
router.currentNavigation()?.extras?.state?.['raceStatus']
```

- Initializers run in an injection context — call `inject(Service)` inside the initializer body (no `deps` array).
- Guard / resolver specs that previously spied on `getCurrentNavigation` must spy on `currentNavigation` instead.

#### TypeScript unions and aliases (Sonar)
Do **not** write `'A' | 'B' | string` (or any literal union widened by `string`) — the literals are redundant and Sonar flags them as overridden by `string`. Prefer a **named type alias** for repeated literal unions.

```typescript
// Bad — literals overridden by string; inline union repeated
function canEdit(status: 'DRAFT' | 'PLANNING' | 'READY' | string): boolean { … }

// Good — open-ended API / router values
function canEdit(status: string): boolean { … }

// Good — closed domain set
type RaceLifecycleStatus = 'DRAFT' | 'PLANNING' | 'READY' | 'LIVE';
function canEdit(status: RaceLifecycleStatus): boolean { … }
```

- Prefer shared enums / aliases from `core/models/enums` when the set is closed.
- Use plain `string` when the value is open-ended (navigation state, unknown API payloads).

#### Nested ternaries (Sonar)
Do **not** nest ternary operators. Sonar flags nested ternaries as: Extract this nested ternary operation into an independent statement.

Prefer `if` / `else`, early returns, or a small helper.

#### Array `.at()` (Sonar)
Prefer ES2022 `array.at(-n)` over `array[array.length - n]` when reading from the end.

```typescript
// Bad
const last = path[path.length - 1];

// Good
const last = path.at(-1);
```

#### `RegExp.exec()` (Sonar)
Prefer `RegExp#exec()` over `String#match()` when extracting capture groups from a single match.

```typescript
// Bad
const match = value.match(/…/);

// Good
const match = /…/.exec(value);
```

#### Re-exports (Sonar)
Prefer `export { name } from './module'` (or `export { a as b } from …`) over import-then-export for barrel / shim re-exports.

```typescript
// Bad
import { contrastingInk } from './sign-catalogue.util';
export { contrastingInk };

// Good
export { contrastingInk } from './sign-catalogue.util';
```

#### Optional chaining, defaults, and parameter order (Sonar)
| Smell | Prefer |
|---|---|
| `x && x.y` / `x != null ? x.y : undefined` | `x?.y` |
| `x ? x : defaultValue` for nullish defaults | `x ?? defaultValue` |
| `value !== undefined ? value : fallback` | `value ?? fallback` |
| Chained `.sort(...).map(...)` (mutates in place) | Sort in a **separate statement**, then `.map` (do **not** use `toSorted` until `lib` includes ES2023+) |
| `value = value === undefined ? 'jpg' : value` inside the body | Default param: `fileExtension = 'jpg'` |
| Default parameter before required parameter | Required params first; defaults last |
| `a > b ? a : b` for numeric max/min | `Math.max(a, b)` / `Math.min(a, b)` |
| `arr.findIndex((x) => x === value)` | `arr.indexOf(value)` when equality is enough |
| Useless `{...obj, ...{}}` / empty object in spreads | Drop the empty object |

```typescript
// Bad
function upload(file: File, fileExtension?: string): void {
  fileExtension = fileExtension === undefined ? 'jpg' : fileExtension;
}
const zoom = a > b ? a : b;
const i = options.findIndex((o) => o === active);

// Good
function upload(file: File, fileExtension = 'jpg'): void { … }
const zoom = Math.max(a, b);
const i = options.indexOf(active);
items.sort((a, b) => a.order - b.order);
const rows = items.map(toRow);
```

#### Array `sort` in expressions (Sonar)
Do **not** call mutating `Array#sort` inside a larger expression (for example before `.map`). Sonar flags it as: Move this array "sort" operation to a separate statement or replace it with "toSorted".

Prefer a **separate statement** then map:

```typescript
// Bad — sort chained in an expression
this.stages.set(rows.sort((a, b) => a.n - b.n).map((row) => ({ ...row, dirty: false })));

// Good — sort first, then map (works with current TS `lib`; project is pre-ES2023)
rows.sort((a, b) => a.n - b.n);
this.stages.set(rows.map((row) => ({ ...row, dirty: false })));
```

Do **not** use `toSorted()` until `tsconfig` `lib` includes `es2023` or later — it fails compile with TS2550 today.

#### Duplicate CSS selectors (Sonar)
Do **not** declare the same selector twice in one stylesheet. Sonar flags it as: Duplicate selector "…", first used at line N.

Merge properties into a single block (later overrides win when consolidating intentional overrides).

#### Viewport zoom (Sonar / a11y)
Do **not** disable pinch-zoom in the viewport meta (`user-scalable=no`, `maximum-scale=1`). Sonar flags it as: Meta viewport disables zoom via user-scalable=no.

```html
<!-- Bad -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

<!-- Good — keep viewport-fit for notched devices; allow user zoom -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

Applies to `frontend-app` and `mobile-pwa` `index.html`.

#### Accessible names (Sonar / WCAG 2 A)
Interactive controls and labeled regions must expose an accessible name. Sonar flags missing names as: Add an `aria-label` or `aria-labelledby` attribute to this element.

| Pattern | Prefer |
|---|---|
| Icon-only / unlabeled control | `[attr.aria-label]="'…' \| translate"` |
| Region next to a visible title | `aria-labelledby="title-id"` on the region + matching `id` on the title |
| Skeleton / loading rail that mirrors a titled region | Temporary `aria-label` until the live titled region mounts |

Applies to catalogue side rails (`sign-catalogue`, `zone-catalogue`, `marshal-catalogue`) and similar split layouts.

#### Color contrast (Sonar)
Text must meet **WCAG AA** contrast vs its background (≥ **4.5:1** for normal text). Sonar flags insufficient contrast as: Text does not meet the minimal contrast requirement with its background.

- Darken text or strengthen background tint until contrast passes; keep badge/chip hierarchy intact.
- Prefer shared token shades (`-800` / `-900` text on light tinted fills) over low-contrast mid tones.

#### Native HTML over ARIA roles (Sonar)
Prefer native elements over ARIA role polyfills when the widget matches the native semantics.

| Avoid | Prefer |
|---|---|
| `role="progressbar"` | `<progress>` |
| `role="dialog"` | `<dialog>` |
| `role="listbox"` / `role="option"` | `<select>` / `<datalist>` / `<option>`, or a plain `<ul>` of `<button>`s with `aria-pressed` when rich custom cards cannot use native select |

Do **not** force `<select>` when option content is a custom card layout — drop fake listbox roles and use buttons (or a documented custom pattern) instead.

#### Module imports once (Sonar)
Do **not** import the same module path twice in one file. Merge into a single import statement (for example one `@angular/core/rxjs-interop` import for `toSignal` + `toObservable`).

#### CSS `word-break: break-word` (Sonar)
Do **not** use the deprecated `word-break: break-word`. Prefer `overflow-wrap: anywhere` (or `overflow-wrap: break-word` when that matches layout intent).

#### Google Maps legacy types (Sonar)
`@types/google.maps` marks classic `Marker`, `MarkerOptions`, `DirectionsService`, and `DrawingManager` as `@deprecated`. Do **not** reference those names at feature call sites while `@angular/google-maps` / classic overlays are still in use.

- **frontend-app:** `PlannerMapMarkerOptions` + helpers in `core/utils/google-maps-legacy.util.ts`.
- **mobile-pwa:** `MapMarkerOptions`, `createMapMarker`, directions helpers in `core/utils/google-maps-legacy.util.ts`.
- Do not suppress Sonar; keep deprecated symbol names confined to the legacy util until Advanced Markers / Routes are migrated product-wide.

#### Test assertions (Sonar)
Prefer dedicated matchers over generic equality on `.length` / null.

```typescript
// Bad
expect(rows.length).toBe(1);
expect(value).toBe(null);

// Good
expect(rows).toHaveLength(1);
expect(value).toBeNull();
```

Use `toBeGreaterThan` / `toBeGreaterThanOrEqual` when the assertion is not an exact length.

#### Duplicate implementations (Sonar)
Do **not** leave two methods with identical bodies. Extract a shared helper or route one method through the other.

#### Linting and Formatting
- Use ESLint with Angular-specific rules
- Use Prettier for code formatting
- Run linting before commits
- Maintain consistent code style

#### Source formatting (no spurious line breaks)
Do **not** insert a blank line after every statement, import, property, or brace. Match the compact style used in existing services and components (for example `user-admin.service.ts`, `wizard-step-details.component.ts`).

- **Imports**: One `import` per line; no blank line between consecutive imports. Use a single blank line after the import block before the first declaration.
- **Types and interfaces**: One property per line inside the body; no blank line between properties unless separating logical groups.
- **Top-level declarations**: One blank line between standalone functions, constants, interfaces, and the `@Component` decorator.
- **Classes and components**: One blank line between methods. Group related fields (injections, inputs/outputs, signals) with a blank line between groups when it clarifies structure.
- **Inside methods and callbacks**: Use a blank line only **after a block** closes — `if` / `else if`, `try` / `catch` / `finally`, `for` / `for…of`, `switch`, or a nested function — when the next statement starts a different step. Do not add blank lines between consecutive statements inside the same block.
- **Object literals and argument lists**: Keep compact single-line or conventional multi-line formatting; do not add a blank line between each property or argument.
- **Before commit**: Run `npm run format` in the affected app (`frontend-app` or `mobile-pwa`) so Prettier normalizes spacing. If an editor or agent produced “double-spaced” TypeScript (or removed all spacing), fix it before review—do not leave it for the reviewer.

#### Code Organization
- Group related files in feature folders
- Use barrel exports for clean imports
- Follow single responsibility principle
- Keep components focused and small

### Build and Deployment

#### Build Configuration
- Use Angular CLI for builds
- Configure different environments (dev, prod)
- Implement proper asset optimization
- Use source maps for debugging

#### Scripts
```json
{
  "scripts": {
    "start": "ng serve",
    "build": "ng build",
    "build:prod": "ng build --configuration production",
    "test": "ng test",
    "lint": "ng lint",
    "format": "prettier --write \"src/**/*.{ts,html,scss,json}\""
  }
}
```

## Best Practices

### General Guidelines
1. **Consistency**: Follow established patterns across the application
2. **Reusability**: Create reusable components, services, and shared `*.util.ts` helpers (see **Shared helpers and reused behavior** under Model Standards)
3. **Maintainability**: Write clean, readable, and well-documented code
4. **Performance**: Optimize for both development and runtime performance
5. **Security**: Implement proper security measures
6. **Testing**: Write comprehensive tests for all features
7. **Accessibility**: Follow WCAG guidelines for accessibility; prefer native semantics (e.g. `<output>` for status regions — see **Semantic status regions (Sonar)**)

### Development Workflow
1. **Feature Development**: Create feature branches from main
2. **Code Review**: Require code reviews for all changes
3. **Testing**: Write and maintain unit tests; the author runs `npm test` (or CI) manually before merging — agents do not run the full suite unless asked
4. **Documentation**: Update documentation for new features
5. **Deployment**: Use automated deployment pipelines

### Common Patterns

#### CRUD Operations
```typescript
// Service pattern for CRUD operations
export class CrudService<T> {
  getAll(): Observable<ApiEnvelope<readonly T[]>> { /* ... */ }
  getById(id: number): Observable<ApiEnvelope<T>> { /* ... */ }
  create(item: Partial<T>): Observable<ApiEnvelope<T>> { /* ... */ }
  update(id: number, item: Partial<T>): Observable<ApiEnvelope<T>> { /* ... */ }
  delete(id: number): Observable<ApiEnvelope<void>> { /* ... */ }
}
```

For entity-specific services, prefer concrete entity services over a generic or umbrella service in application code:

```typescript
@Injectable({ providedIn: 'root' })
export class ZoneTypeService extends TenantScopedReadService {
  getAll(): Observable<readonly ZoneType[]> { /* ... */ }
  get(id: number): Observable<ZoneType> { /* future */ }
  save(zoneType: Partial<ZoneType>): Observable<ZoneType> { /* future */ }
  edit(id: number, zoneType: Partial<ZoneType>): Observable<ZoneType> { /* future */ }
  delete(id: number): Observable<void> { /* future */ }
  search(criteria: ZoneTypeSearchCriteria): Observable<readonly ZoneType[]> { /* future */ }
}
```

#### Component Communication
```typescript
// Parent-child communication
@Input() data: any;
@Output() dataChange = new EventEmitter<any>();

// Service-based communication
@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private dataSubject = new BehaviorSubject<any>(null);
  data$ = this.dataSubject.asObservable();
}
```

#### Error Handling Pattern
```typescript
// Service error handling
this.service.getData().pipe(
  catchError((error) => {
    this.alertService.showError('Failed to load data');
    return throwError(() => error);
  })
).subscribe(/* ... */);
```

## Migration and Maintenance

### Angular Version Updates
- Follow Angular update guide for major version migrations
- Test thoroughly after updates
- Update dependencies regularly
- Monitor for breaking changes

### Code Maintenance
- Regular code reviews and refactoring
- Update documentation as code changes
- Monitor performance metrics
- Address technical debt regularly

## Conclusion

This document outlines the standards and guidelines for the Angular frontend application. All developers should follow these patterns to maintain consistency, quality, and maintainability across the codebase. Regular reviews and updates to these standards ensure they remain relevant and effective.
