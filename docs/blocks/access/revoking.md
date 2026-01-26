---
title: Revoking access
sidebar: true
---

# Revoking access

:::warning

Revoking access to your CRM will immediately revoke access for the user. No data will be deleted, but the user will no longer be able to log in. You can re-activate the user's access by [inviting them to your CRM](/blocks/access/invitations/accepting.html) again.

:::

Revoking access to your CRM is important to ensure that only authorized users have access to your CRM. When you revoke access, the user will immediately lose access to the CRM and will not be able to log in.

```
DELETE https://api.crm-kit.com/v1/users/<user-id>
```

If successful, the response will look like this:

```json
{
  "status": "success"
}
```

## Required entitlements

The requesting user must have the `users:write` entitlement to revoke access.