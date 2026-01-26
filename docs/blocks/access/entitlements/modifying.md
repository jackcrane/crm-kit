---
title: Modifying entitlements
sidebar: true
---

# Modifying a user's entitlements

:::warning
Be careful when modifying entitlements. Entitlement changes go into effect immediately and it is possible to accidentally block your own access to the settings and data you need!
:::

You can modify a user's entitlements with the following request:

```
POST https://api.crm-kit.com/v1/entitlements/<userId>
```

Your request body should contain an array of entitlements and a requested action for each.

```json
[
  {
    "entitlement": "superuser",
    "action": "add"
  },
  {
    "entitlement": "users:read",
    "action": "remove"
  }
  // ...
]
```

The above request would add the `superuser` entitlement and remove the `users:read` entitlement from the user.

When updated, the changes will immediately take effect. The API will return the updated entitlements for the user.

```json
{
  "status": "success",
  "entitlements": [
    "invitations:read",
    "invitations:write",
    "entitlements:read",
    "entitlements:write"
  ]
}
```

## Required entitlements

The requesting user must have the `entitlements:write` entitlement to modify a user's entitlements.
