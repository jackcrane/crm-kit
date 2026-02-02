---
title: Fields
---

# Fields

Customizability is important in a CRM if you hope to have it grow with your organization and operation. Custom fields can be placed on the people model and have the following schema:

| Property | Type | Description |
| --- | --- | --- |
| `title` | `String` | The ID of the field, starting in `fld_` |
| `title` | `String` | The title of the field |
| `icon` | `Enum?` | An optional icon name from [Tabler Icons](https://tabler.io/icons) |
| `entitlements` | [`Entitlement[]`](/blocks/entitlements) | A list of entitlements that a user must have to see this field. The requesting user must have ALL entitlements in this list in order to see this field. |