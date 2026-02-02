---
title: People
---

# People

CRM Kit uses the terms *people*/*person* to describe a contact in your CRM. A person has the following innate traits:

:::tabs
== Table + Details

| Field | Type | Description | Conditions |
| --- | --- | --- | --- |
| id | `String` | The person's id, starting in `psn_` | Will always be available |
| name | `String` | The person's name | Will always be available |
| ltv | `Float?` | The person's lifetime value | Will only be visible if requesting user has `people.financial:read` |
| fields | `Object[]` | Custom field values on the person. | Some fields may not be available depending on user entitlements |
| fields.id | `String` | The id of the [`Field`](/blocks/people/fields), starting in `fld_` |
| fields.value | `Any` | The value of the field for this person | Value will be null when the user does not have the necessary entitlements to view this field |
| fields.userCanRead | `Bool` | A boolean to track if the requesting user has the necessary entitlements to view this field |
| emailAddresses | [`EmailAddress[]?`](#email-address-model) | A list of the person's email addresses | Will only be visible if requesting user has `people.contact:read` |
| phoneNumbers | [`PhoneNumber[]?`](#phone-number-model) | A list of the person's phone numbers | Will only be visible if requesting user has `people.contact:read` |

== JSON sample
```json
{
  "id": "psn_**",
  "name": "John Doe",
  "ltv": 42.71, // $42.71
  "fields": [
    {
      "id": "fld_**",
      "value": "At the career fair",
      "userCanRead": true
    },
    {
      "id": "fld_**",
      "value": null,
      "userCanRead": false
    }
  ],
  "emailAddresses": [
    {
      "address": "john.doe@example.com",
      "order": 0,
      "notes": {
        "type": "plaintext",
        "content": "John Doe's favorite email address"
      }
    }
  ],
  "phoneNumbers": [
    {
      "number": "5555555555",
      "order": 0,
      "notes": {
        "type": "plaintext",
        "content": "John Doe's favorite phone number"
      }
    }
  ]
}
```
:::

## Email Address Model

The `EmailAddress` object holds information regarding a user's email address. It includes the following fields:

| Field | Type | Description |
| --- | --- | --- |
| address | `String` | The email address string (something@domain.com) |
| order | `Int` | An order key. Lower numbers should appear at the top of lists. Lists of email addresses for a specific person will already be sorted by this. |
| notes | `Object` | An object containing information regarding notes |
| notes.type | `Enum` | The type of data that the notes are arriving as. One of `plaintext\|md` |
| notes.content | `String` | The content of the notes |

## Phone Number Model

The `PhoneNumber` object holds information regarding a user's phone number. It includes the following fields:

| Field | Type | Description |
| --- | --- | --- |
| number | `String` | The phone number string (as provided) |
| order | `Int` | An order key. Lower numbers should appear at the top of lists. Lists of phone numbers for a specific person will already be sorted by this. |
| notes | `Object` | An object containing information regarding notes |
| notes.type | `Enum` | The type of data that the notes are arriving as. One of `plaintext\|md` |
| notes.content | `String` | The content of the notes |