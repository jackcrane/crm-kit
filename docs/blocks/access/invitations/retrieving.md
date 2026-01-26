# Retrieving invitations

Retrieving invitations is important for listing all inviations that have been sent to users, ro retrieving a single invitation, or accepting an invitation.

## Retrieving a single invitation

There are two ways to retrieve a single invitation. These endpoints still require the application ID to be included, but do not require an authorization token.

:::tabs
== By ID
```
GET https://api.crm-kit.com/v1/users/invitations/<invitation-id>
```
== By access code

```
GET https://api.crm-kit.com/v1/users/invitations/<invitation-code>
```
:::

The response of either endpoint will look like this:

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
    "siteKey": <site-key>
  }
}
```

## Retrieving many invitations

```
GET https://api.crm-kit.com/v1/users/invitations
```

This endpoint will return a list of all invitations that have been sent to users. The response will look like this:

```json
{
  "invitations": [
    {
      "id": <invitation-id>,
      "email": <user-email>,
      "name": <user-name>,
      "status": <invitation-status>,
      "createdAt": <invitation-created-at>,
      "updatedAt": <invitation-updated-at>
    }
  ],
  "total": <total-invitations>,
  "page": <current-page>,
  "limit": <limit>,
}
```

### Pagination

The response will contain a `total` field including the total number of invitations, the `page` field indicating the current page, and the `limit` field indicating the number of invitations per page.

You can use the `page` and `limit` fields to paginate through the invitations.

```
GET https://api.crm-kit.com/v1/users/invitations?page=2&limit=10
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | The ID of the invitation.
| `email` | string | The email address of the user that was invited. |
| `name` | string | The name of the user that was invited. |
| `status` | string | The status of the invitation. Possible values are `pending`, `accepted`, and `rescinded`. |
| `createdAt` | string | The date and time the invitation was created. |
| `updatedAt` | string | The date and time the invitation was last updated. |

