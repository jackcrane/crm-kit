---
title: Retrieving entitlements
sidebar: true
---

# Retrieving entitlements

You can retrieve a user's entitlements with the following request:

```
GET https://api.crm-kit.com/v1/entitlements/<userId>
```

This endpoint will return an array of entitlements that the user has. The response will look like this:

```json
[
  "superuser",
  "users:read",
  // ...
]
```

## Required entitlements

The requesting user must have the `entitlements:read` entitlement to retrieve a user's entitlements.
The requesting user does not need any entitlements to retrieve their own entitlements.