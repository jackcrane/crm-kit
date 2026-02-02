---
title: Retrieving people
---

# Retrieving people

Listing people is the core functionality of a CRM.

## Retrieving a single person

```
GET https://api.crm-kit.com/v1/people/<person-id>
```

The API will respond with an object as outlined in the [person](/blocks/people) page.

## Retrieving multiple people

```
GET https://api.crm-kit.com/v1/people
```

The API will respond with an array of objects as outlined in the [person](/blocks/people) page.

### Searching

You can search for invitations by providing a search query parameter. The search query will be matched against the name, emails, phone numbers, and id (starting with psn_) fields.

```
GET https://api.crm-kit.com/v1/people?search=john
```

*NOTE:* You must have the `people.contact:read` entitlement to search against email and phone number fields. If your requesting user does not have these entitlements, emails and phone numbers will simply not be considered and the searcher will fall back to just name and id.

### Refining search results

You can refine the search by providing a searchFields query parameter. The search query will be matched against the specified fields.

```
GET https://api.crm-kit.com/v1/users/invitations?search=john&searchFields=name
```

Valid searchFields values are name, email, phone, and id. If omitted, all are used. Unknown fields will return a 400 response.

*NOTE:* You must have the `people.contact:read` entitlement to search against email and phone number fields. If your requesting user does not have these entitlements, emails and phone numbers will simply not be considered and the searcher will fall back to just name and id.

### Advanced searches

You can run advanced searches by providing a `searchDsl` query parameter. This will be a JSON object as described in the [Search DSL documentation](/blocks/search-dsl.html).

```
GET https://api.crm-kit.com/v1/people?searchDsl={"email": {"EQ": "john@example.com"}}
```

The invitations endpoint accepts the following `searchDsl` fields: `id`, `email`, `name`, `ltv`, `createdAt`, and `updatedAt`. Logical operators are fully supported, and the `ORDER` clause can be used to sort by any of those fields (for example, `{"ORDER": {"createdAt": "DESC"}}`). Pagination still uses the `page` and `limit` query parameters.

*NOTE:* You must have the `people.contact:read` entitlement to search against email and phone number fields. If your requesting user does not have these entitlements, emails and phone numbers will simply not be considered and the searcher will fall back to just name and id.

### Pagination

The response will contain a `total` field including the total number of invitations, the `page` field indicating the current page, and the `limit` field indicating the number of invitations per page.

You can use the `page` and `limit` fields to paginate through the invitations.

```
GET https://api.crm-kit.com/v1/users/invitations?page=2&limit=10
```
