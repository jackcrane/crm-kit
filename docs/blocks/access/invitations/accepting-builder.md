---
title: Accepting invitations
sidebar: true
---

# Accepting invitations

Accepting invitations is the process of accepting an invitation to a CRM. This is a step-by-step guide for building a page for users to accept an invitation.

## 1. Gather the necessary information

To accept an invitation, you will need your application's ID. You can find this in the CRM Kit dashboard.

## 2. Get the user's invitation code

You need to get the invitation code from the user. This can be done in a few ways:

- Get the code directly from the user with an input field
- Get the code from the URL: If the user has clicked the "Accept Invitation" button in the invitation email, the URL will contain the invitation code in the `?code=<invitation-code>` query parameter. *Note:* this will only work if you included the `ctaUrl` field in the invitation request.

## 3. Retrieve the invitation

Use the invitation code to retrieve the invitation from the API.

```
GET https://api.crm-kit.com/v1/users/invitations/<invitation-code>
```

If the endpoint exists, this endpoint will return a JSON object with the following fields:

```json
{
  "invitation": {
    "id": <invitation-id>,
    "email": <user-email>,
    "name": <user-name>,
    "status": <invitation-status>,
    "createdAt": <invitation-created-at>,
    "updatedAt": <invitation-updated-at>
  },
  "application": {
    "requiresCaptcha": <requires-captcha>,
    "siteKey": <site-key>,
  }
}
```

If the invitation code does not exist, the API will return a `404` status code.

## 4. Check the invitation status

Check the invitation status to ensure that the invitation is still pending (ensure `invitation.status` is `pending`).

## 5. Render the acceptance form

Render a form for the user to enter their password. If you are going to be using captcha, you will need to render a `div` with the `cf-turnstile-response` attribute and include the Cloudflare Turnstile script in your HTML head. Your `siteKey` is provided in the metadata of the invitation above.

## 6. Make a request to the accept endpoint

Once the user has entered their password, you will make a request to the accept endpoint:

```
POST https://api.crm-kit.com/v1/users/invitations/<invitation-id>/accept
```

```json
{
  "password": <password>,
  "cf-turnstile-response": <token>,
}
```

The `password` field is the user's password.

## 7. Check the response

Check the response from the accept endpoint. if the accept was successful, the response code will be `200` and the `data.status` field will be `success`. Otherwise, the response code will be `401` and the `data.status` field will be `failure`.

### 7.1 Successful response

If the accept was successful, you will receive a JSON object with the following fields:

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

Save the `token` value to a secure cookie. All future requests to CRM Kit will require this token in the `Authorization` header along with the `X-Application-ID` header.

### 7.2 Failed response

If the accept was not successful, you will receive a JSON object with the following fields:

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

Message will be a human-readable error message that you can display to the user.