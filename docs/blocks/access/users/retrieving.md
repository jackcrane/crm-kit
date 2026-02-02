# Retrieving users

Use this endpoint to list the users who have access to your CRM. Results are paginated and support simple text search, field-scoped search, and advanced Search DSL queries.

```
GET https://api.crm-kit.com/v1/users
```

## Response shape

```json
{
  "users": [
    {
      "id": "usr_123",
      "email": "user@example.com",
      "name": "Example User",
      "status": "active",
      "createdAt": "2024-12-01T12:00:00.000Z",
      "updatedAt": "2024-12-02T12:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

## Searching

Basic text search checks the `email`, `name`, and `id` fields:

```
GET https://api.crm-kit.com/v1/users?search=jane
```

### Refining search

Limit the fields considered by search with `searchFields` (comma-separated):

```
GET https://api.crm-kit.com/v1/users?search=jane&searchFields=name
```

Valid `searchFields` values: `email`, `name`, `id`. Unknown fields return a `400` error.

### Advanced searches

Pass a [`searchDsl`](/blocks/search-dsl) JSON object for complex queries:

```
GET https://api.crm-kit.com/v1/users?searchDsl={"AND":[{"email":{"EQ":"jane@example.com"}}, {"status":{"EQ":"active"}}]}
```

Supported `searchDsl` fields: `id`, `email`, `name`, `status`, `createdAt`, `updatedAt` in addition to the operators and pagination controls outlined in the [Search DSL spec page](/blocks/search-dsl).

## Pagination

Use `page` (default `1`) and `limit` (default `10`, max `100`) to page through results.

## Required entitlements

The caller must have the `users:read` entitlement to list users.
