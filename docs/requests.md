---
title: API Requests
sidebar: true
---

# API Requests

Your application will need to make requests to CRM Kit's API endpoints to get data for your CRM, make changes, or any other action that you need to perform.

CRM Kit provides a consistent set of utilities on API endpoints and has consistent expectations for content provided.

## Application ID

Every request to CRM Kit requires an application ID. This serves as a unique identifier for your application and allows us to connect a request to your data.

You are required to provide this Application ID in the `X-Application-ID` header of every request.

```curl
curl -X GET \
  https://api.crm-kit.com/v1/users \
  -H "X-Application-ID: my-app-id"
```

If you do not provide an application ID, CRM Kit will return an error with status code `400` and message:

```json
{
  "message": "Missing application ID.",
  "comment": "Refer to https://docs.crm-kit.com/requests.html#application-id for more information."
}
```

## Authorization

All requests to CRM Kit that need to be authorized must include an authorization header. The authorization token is to be included as a bearer token in the `Authorization` header.

```curl
curl -X GET \
  https://api.crm-kit.com/v1/users \
  -H "Authorization: Bearer my-token"
```

If you do not provide an authorization token, CRM Kit will return an error with status code `401` and message:

```json
{
  "message": "Missing authorization token.",
  "comment": "Refer to https://docs.crm-kit.com/requests.html#authorization for more information."
}
```

Auth tokens are valid for a period of time as defined in the dashboard. After that period of time, the token will no longer be valid and the user will need to re-authenticate.