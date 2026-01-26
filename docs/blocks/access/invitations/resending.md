---
title: Resending invitations
sidebar: true
---

# Resending invitations

Resending an invitation is useful if you need to resend an invitation after it has expired. When you resend an invitation, the user will be sent another email. Resending an invitation will mark the invitation as `pending` and restart the 24 hour expiration timer.

```
POST https://api.crm-kit.com/v1/users/invitations/<invitation-id>/resend
```

If successful, the response will look like this:

```json
{
  "status": "success"
}
```

## Required entitlements

The requesting user must have the `invitations:write` entitlement to resend an invitation.