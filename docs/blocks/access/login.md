---
title: Authentication
sidebar: true
---

# Authentication: Logging in users

Users need to be able to login to view your CRM. Providing secure, reliable access to your CRM is critically important to the utility of your application.

:::tip

This documentation page is very technical and is a detailed overview of the login process. Visit the [Login Builder](/blocks/access/login-builder.html) page for a step-by-step guide for building a login form for your application.

:::

## Form endpoint

Before rendering your login form, make a request to the form endpoint to get metadata about the login form.

```
GET https://api.crm-kit.com/v1/auth
```

This endpoint will return a JSON object with the following fields:

```json
{
  "loginAvailable": Boolean,
  "types": [AuthType], // List of supported authentication types. Right now, only "password" is supported.
  "siteKey": <site-key>, // Your Cloudflare Turnstile site key.
  "requiresCaptcha": Boolean // Whether or not the login requires a captcha.
}
```

## Login endpoint

The login endpoint is a simple endpoint that you can hit from your application's frontend. It expects a `POST` request with either a JSON body or form data containing the following fields:

```
POST https://api.crm-kit.com/v1/auth/login
```

```json
{
  "email": <email>, // The user's email address
  "password": <password>, // User's password
  "type": "password", // Auth type, currently only "password" is supported,
  "cf-turnstile-response": <token>, // Cloudflare turnstile response
}
```

Every response from the login endpoint will be a JSON object. It will at least contain the field `status`, which will be `success` if the login was successful, `failure` if the login failed, or `challenge` if the login was successful but requires additional steps to complete.

:::tabs
== Login Successful
This is the response that is returned when the login is successful and will be accompanied by an HTTP `200` status code.

```json
{
  "status": "success",
  "token": <token>,
  "user": {
    "id": <user-id>,
    "email": <user-email>,
    "name": <user-name>
  },
  "userPermissions": [Entitlement] // See the User Permissions page
}
```
== Login Failed
This is the response that is returned when the login failed and will be accompanied by an HTTP `401` status code.

```json
{
  "status": "failure",
  "reason": <reason>,
  "message": <error-message>
}
```

Reason will be one of the following:
- `invalid_credentials`: The email or password was invalid
- `invalid_type`: The type of authentication was invalid
- `invalid_captcha`: The captcha was invalid

== Challenge Required
This is the response that is returned when the login was successful but requires additional steps to complete. (e.g. 2FA or MFA). This will be accompanied by an HTTP `200` status code.

```json
{
  "status": "challenge",
  "challenge": {
    "type": <challenge-type>,
    "nonce": <challenge-nonce>
  }
}
```

Challenge type will be one of the following:
- `mfa`: Multi-factor authentication. See [MFA](./mfa.md) for handling this challenge type.

The challenge nonce is a random string that must be included with the challenge response request.

See [Challenge Response](#challenge-response) for instructions on how to respond to the challenge.
== Invalid Submission Format
If you have malformed your request, you will recieve this response, accompanied by an HTTP `400` status code.

```json
{
  "status": "failure",
  "reason": "invalid_submission_format",
  "message": "Invalid submission format.",
  "comment": "Refer to https://docs.crm-kit.com/blocks/access/login.html for more information."
}
```
:::

## Challenge Response

If the login was successful but requires additional steps to complete, you will need to make a request to the challenge endpoint to check the user's response.

When you make a request to the challenge endpoint, you must include the following fields:

```
POST https://api.crm-kit.com/v1/auth/challenge
```

```json
{
  "nonce": <challenge-nonce>,
  "response": <challenge-response>, // The user's response to the challenge
  "cf-turnstile-response": <token>, // Cloudflare turnstile response
}
```

## Object Reference

This is a reference of fields that are mentioned above.

### `AuthType`

AuthType is an object that describes a type of authentication for your application. The form endpoint will return a list of supported auth types. Each type will at least have a `type` field, which will either be `password` or `oauth`.

:::tabs
== Password
This is the auth type that is used for password-based authentication.

```json
{
  "type": "password",
}
```
== OAuth
This is the auth type that is used for OAuth-based authentication.

```json
{
  "type": "oauth",
  "loginUrl": <login-url>,
  "provider": <provider-name>, // Google, Facebook, SSO, etc.
  "imageUrl": <image-url>, // URL to an image that represents the provider,
}
```
:::

### `Entitlement`

Entitlement is an object that describes a user's entitlements to read or write data in your CRM. More information about entitlements can be found in the [Entitlements](/blocks/entitlements) page.
