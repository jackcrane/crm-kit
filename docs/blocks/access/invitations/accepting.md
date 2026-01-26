# Accepting invitations

Accepting invitations is the process of accepting an invitation to a CRM. This is typically done by a user who has been invited to the CRM.

:::tip

This documentation page is a reference of the /accept endpoint. Visit the [Accepting invitations](/blocks/access/invitations/accepting-builder.html) page for a step-by-step guide for building a page for users to accept an invitation.

:::

## Accepting an invitation

When you make the request, the invitation will be marked as accepted and the user will be created and logged in.

```
POST https://api.crm-kit.com/v1/users/invitations/<invitation-id>/accept
```

Your request body should contain the following fields:

```json
{
  "password": <password>,
  "cf-turnstile-response": <token>,
}
```

If successful, the API will respond with a `200` status code and a JSON object with the following fields:

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

The `token` field is a JWT that can be used to authenticate the user in future requests and should be saved to a secure cookie.