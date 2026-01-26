---
title: Login Builder
sidebar: true
---

# Authentication: Login Builder

CRM Kit provides a login builder that allows you to quickly create a form for your users to log in to your application.

## 1. Gather the necessary information

To create your login form, you will need your application's ID. You can find this in the CRM Kit dashboard. It will look something like this:

```
app_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

You will provide this ID to all requests to CRM Kit's API endpoints as an `X-Application-ID` header.

## 2. Request the basic login form information

Make a request to the /auth endpoint to get the basic information about the login form:

```
GET https://api.crm-kit.com/v1/auth
```

This endpoint will return a JSON object with the following fields:

```json
{
  "loginAvailable": Boolean,
  "types": [AuthType],
  "siteKey": <site-key>,
  "requiresCaptcha": Boolean
}
```

If you are curious, more information about this endpoint can be found in the [Login](/blocks/access/login.html) page, but for now, everything you need to know about this endpoint will be covered here.

## 3. Render the login form

The login form contents will be defined by the `types` field in the response from the /auth endpoint. This guide will only cover the password-based login form.

Render a username and password input field for your users to enter their credentials. If you are going to be using a captcha, you will need to render a `div` with the `cf-turnstile-response` attribute and include the Cloudflare Turnstile script in your HTML head. Your `siteKey` is provided in the response from the /auth endpoint.

## 4. Make a request to the login endpoint with the user's credentials

Once the user has entered their credentials, you will need to make a request to the /auth/login endpoint to get a session token for the user.

```
POST https://api.crm-kit.com/v1/auth/login
```

```json
{
  "email": <email>,
  "password": <password>,
  "type": "password", // Don't change this!
  "cf-turnstile-response": <token>
}
```

## 5. Handle the response

Check the response from the login endpoint.

### 5.1 Check the status code

Check that the status code is either `200` or `401`.

### 5.2 Check the response body

Regardless of the status code, the response body will be a JSON object with a `status` field.

## 6. The status is `success`

If the status is `success`, you will receive a JSON object with the following fields:

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

## 7. The status is `challenge`

If the status is `challenge`, that means the user needs to complete a multi-factor authentication challenge. You will need to render an input field for the user to enter the code from their authenticator app. Just as with the login form, if you intend to use a captcha, you will need to render a `div` with the `cf-turnstile-response` attribute and include the Cloudflare Turnstile script in your HTML head. Use the `siteKey` provided in the response from the /auth endpoint again.

There will be a `nonce` field in the response body. You will use this nonce to make the next request to the challenge endpoint. That nonce will be valid for 5 minutes, meaning after 5 minutes the user will need to start the login flow again.

One the user has entered their code, you will make a request to the challenge endpoint:

```
POST https://api.crm-kit.com/v1/auth/challenge
```

```json
{
  "nonce": <challenge-nonce>,
  "response": <challenge-response>,
  "cf-turnstile-response": <token>
}
```

The `response` field is the code the user entered.

### 7.1 Check the response

Check the response from the challenge endpoint. If the challenge response was correct, the response code will be `200` and the `data.status` field will be `success`. If the response code was incorrect, `data.status` will be `failure` and the response code will be `401`.

If the challenge response was incorrect, prompt the user to try again. Use the same `nonce` and `cf-turnstile-response` as the original MFA challenge request.

If the response was correct, save the `token` value to a secure cookie. All future requests to CRM Kit will require this token in the `Authorization` header along with the `X-Application-ID` header.