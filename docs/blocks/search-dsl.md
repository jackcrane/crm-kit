---
title: Search DSL
sidebar: true
---

# Search DSL

Search DSL is a powerful query language that allows you to communicate search queries to the API. Different endpoints support different fields, so be sure to check the documentation for the endpoint you are using.

The list of allowed keys in the search DSL object is as follows:
- Fields: The fields the API has access to search on. Check the documentation for the endpoint you are using.
- Operators: A list of operators
  - `EQ`: Equal to
  - `NEQ`: Not equal to
  - `LT`: Less than
  - `LTE`: Less than or equal to
  - `GT`: Greater than
  - `GTE`: Greater than or equal to
  - `IN`: In
  - `NIN`: Not in
  - `LIKE`: Like. LIKE uses SQL-style pattern matching, where % matches zero or more characters. Case sensitivity is endpoint-specific.
  - `NLIKE`: Not like. LIKE uses SQL-style pattern matching, where % matches zero or more characters. Case sensitivity is endpoint-specific.
  - `BEFORE`: Before
  - `AFTER`: After
- Logical operators: A list of logical operators
  - `AND`: And (Everything inside must be true)
  - `OR`: Or (At least one of the things inside must be true)
  - `NOT`: Not (The opposite of the expression inside). NOT always accepts exactly one expression
- Ordering, limiting, and pagination: A list of ordering, limiting, and pagination operators
  - `ORDER`: Order by
    - `ASC`: Ascending
    - `DESC`: Descending
  - `LIMIT`: Limit
  - `OFFSET`: Offset

## Examples

### Searching for an entity by ID

**NOTE:** This is a shorthand for searching for a single entity by ID. If you need to search for multiple entities, use the `AND` operator.

```json
{
  "id": {                  // id is a field expected by the API
    "EQ": "ent_123456789"  // checking if the id is equal to "ent_123456789"
  }
}
```

### Searching for an entity with a specific name AND email

This will search for an entity with the name "John Doe" and the email `john@example.com`. If there is an entity with the name "John Doe" and the email `john@doe.com`, it will not be returned.

```json
{
  "AND": [
    {"name": { "EQ": "John Doe" }},
    {"email": { "EQ": "john@example.com" }}
  ]
}
```

### Searching for an entity that was created between two dates

This will search for an entity that was created between `2022-01-01` and `2022-12-31`.

```json
{
  "AND": [
    {"createdAt": { "BEFORE": "2022-12-31" }},
    {"createdAt": { "AFTER": "2022-01-01" }}
  ]
}
```

Or equivalently:

```json
{
  "createdAt": {
    "AND": [
      { "BEFORE": "2022-12-31" },
      { "AFTER": "2022-01-01" }
    ]
  }
}
```

See how there were multiple ways to express the same thing? Logical operators may appear either at the root level (combining field expressions) or within a field expression (combining operators for a single field). Both forms are semantically equivalent.

### Searching for entities whose name starts with "John" but not "Joe", ordered by lifetime value, limited to 10 results, and excluding the top 5 entities

```json
{
  "AND": [
    {"name": { "LIKE": "John%" }},
    {"NOT": { "name": { "LIKE": "John%" }}},
  ],
  "ORDER": { "lifetime_value": "DESC" },
  "LIMIT": 10,
  "OFFSET": 5
}
```

NOT always accepts exactly one expression. You cannot pass an array of expressions to NOT.

## Invalid Examples

### Searching for an entity with a specific name AND email

This should be wrapped in an `AND` operator.

```json
{
  "name": { "EQ": "John Doe" },
  "email": { "EQ": "john@example.com" }
}
```

Having multiple fields (not operators, logical, or ordering) in the same object is not allowed. Having one is permitted, but having more than one must be wrapped in an `AND` or `OR` operator.

A search fragment can contain exactly one logical or field expression, and zero or more control keys (ORDER, LIMIT, OFFSET)