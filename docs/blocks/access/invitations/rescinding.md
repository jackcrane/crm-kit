---
title: Rescinding invitations
sidebar: true
---

# Rescinding invitations

:::warning
Rescinding an invitation will prevent the user from being able to accept the invitation. Once rescinded, the invitation will instantly be rendered useless and the user will have to be re-invited.
:::

```
DELETE https://api.crm-kit.com/v1/users/invitations/<invitation-id>
```

If successful, the response will look like this:

```json
{
  "status": "success"
}
```

## Required entitlements

The requesting user must have the `invitations:write` entitlement to rescind an invitation.