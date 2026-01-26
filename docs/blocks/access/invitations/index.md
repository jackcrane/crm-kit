---
title: Inviting users
sidebar: true
---

# Authentication: Inviting users

Inviting users to your CRM is a common use case. It is how you can grant access to your CRM to new people. When inviting a new user to your CRM, you will either need to provide a user's email address or request an invitation code for the user to use.

The invitation API request must come from a user that has been authenticated and has the appropriate entitlements to perform this action. An invitation is valid for 24 hours, after which it will be expired, and you will need to [resend the invitation](resending.html).

## Inviting users

```
POST https://api.crm-kit.com/v1/users/invitations
```

When you make the request, an email will be sent to the recipient with a unique access code that they can use to accept the invitation and set up their password.

Your request body should contain the following fields:

```json
{
  "email": "<user-email>",
  "name": "<user-name>", // Optional
  "entitlements": [Entitlement] // Optional
}
```

If you wish to invite multiple users, you can submit an array of objects instead of a single object:

```json
[
  {
    "email": "<user-email>",
    "name": "<user-name>", // Optional
    "entitlements": [Entitlement] // Optional
  },
  {
    "email": "<user-email>",
    "name": "<user-name>", // Optional
    "entitlements": [Entitlement] // Optional
  }
]
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | The email address of the user to invite. |
| `name` | string | No | The name of the user to invite. |
| `entitlements` | [[Entitlement](/blocks/entitlements.html)] | No | The entitlements to grant to the user. If not provided, the user will have the most restrictive entitlements possible, meaning they will really only be allowed to log in. |
| `message` | string | No | A message to include in the invitation email |
| `ctaUrl` | String | No | A URL to include in a "Accept Invitation" button in the invitation email. This url will be appended with `?code=<invitation-code>`. |

## Required entitlements

The requesting user must have the `invitations:write` entitlement to invite a user.