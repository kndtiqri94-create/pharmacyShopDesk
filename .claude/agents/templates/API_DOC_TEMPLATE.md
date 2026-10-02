<!--
API DOCUMENTATION TEMPLATE (owned by the Backend Developer agent).
Target path: docs/api-docs/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_API_DOC.md
This is the CONTRACT the Frontend Developer codes against. It MUST match the implementation exactly.
Remove all HTML comments before finalising.
-->

# API Documentation <N.x> — <FEATURE TITLE>

- **Workstream:** <N>
- **User Story:** `docs/user-stories/<N.x>_<FEATURE>_USER_STORY.md`
- **Plan:** `docs/features/<N.x>_<FEATURE>_PLAN.md`
- **Author:** Harinda (Backend)
- **Version:** vX.Y (bump on any contract change)

## Conventions
- All responses JSON with camelCase.
- All endpoints require JWT auth unless explicitly marked anonymous.
- All list endpoints are paginated: `page`, `pageSize`, `sortBy`, `sortDir`, `search` (when applicable).
- Audit fields (`isArchived`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `archivedAt`, `archivedBy`) are NEVER returned in responses.
- Errors follow: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.

---

## Endpoint: `<METHOD> /api/<route>`

- **Purpose:** <one sentence>
- **AuthZ:** <role or permission>
- **Tenant-scoped:** Yes / No
- **Idempotent:** Yes / No
- **Success codes:** 200 / 201 / 204
- **Error codes:** 400, 401, 403, 404, 409, 422

### Path & Query Parameters
| Name | Type | Required | Description |
|---|---|---|---|
| id | Guid | Y | … |
| page | int | N (default 1) | … |

### Request Body
```json
{
  "name": "string (1-128)",
  "description": "string (0-512) | null"
}
```
| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| name | string | Y | 1–128 chars | must be unique per tenant |
| description | string | N | ≤ 512 chars | nullable |

### Response Body (Success)
```json
{
  "id": "Guid",
  "name": "string",
  "description": "string | null"
}
```
| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | Guid | N | |
| name | string | N | |
| description | string | Y | |

### Error Responses
| Code | When | `error.code` |
|---|---|---|
| 400 | Request validation failed | `validation_error` |
| 401 | Missing / invalid JWT | `unauthenticated` |
| 403 | Caller lacks role / wrong tenant | `forbidden` |
| 404 | Resource not found in this tenant | `not_found` |
| 409 | Name conflict within tenant | `conflict` |

### Examples
```http
POST /api/roles
Authorization: Bearer <jwt>

{ "name": "Approver", "description": "Can approve deals" }
```
```http
201 Created
{ "id": "…", "name": "Approver", "description": "Can approve deals" }
```

---

## Changelog
| Version | Date | Change |
|---|---|---|
| v1.0 | YYYY-MM-DD | Initial |
