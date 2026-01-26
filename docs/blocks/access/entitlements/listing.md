---
title: Listing entitlements
sidebar: true
---

# Listing entitlements

You can list all entitlements with the following request:

```
GET https://api.crm-kit.com/v1/entitlements/list
```

This endpoint will return a JSON object with a list of all entitlements that are available for your application, a short human-readable description of each entitlement that can be shown in a UI, and a sort value that can be used to show the entitlements in a consistent order.

```json
{
  "entitlements": [
    {
      "name": "superuser",
      "description": "This user is a superuser and has all permissions.",
      "sort": 0
    },
    {
      "name": "users:read",
      "description": "The user can read all users.",
      "sort": 1
    },
    // ...
  ]
}
```

## Required entitlements

The requesting user must have the `entitlements:read` entitlement to list all entitlements.