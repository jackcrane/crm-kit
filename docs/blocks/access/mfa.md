---
title: Multi-Factor Authentication
sidebar: true
---

# Authentication: MFA challenges

If a user has MFA enabled, successful password login attempts will return a `challenge` response with type `mfa` and a one-time `nonce`. You must collect the MFA code from the user and exchange it for a session token.

## Example challenge response

```json
{
  "status": "challenge",
  "challenge": {
    "type": "mfa",
    "nonce": "<challenge-nonce>"
  }
}
```

## Verifying an MFA code

Submit the MFA code alongside the `nonce` to the challenge endpoint:

```
POST https://api.crm-kit.com/v1/auth/challenge
```

```json
{
  "nonce": "<challenge-nonce>",
  "response": "123456",
  "cf-turnstile-response": "<token>"
}
```

For the current demo environment, the MFA code is always `123456`. The `cf-turnstile-response` field is required when captcha enforcement is enabled for your application.

## Successful response

On a valid code, the user receives the same payload as a normal login:

```json
{
  "status": "success",
  "token": "<token>",
  "user": {
    "id": "<user-id>",
    "email": "<user-email>",
    "name": "<user-name>"
  },
  "userPermissions": [Entitlement]
}
```

If the nonce is invalid, expired, or the MFA code is incorrect, you will receive a `failure` response with details and should prompt the user to try again.
