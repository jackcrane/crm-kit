---
title: Entitlements
sidebar: true
---

# Entitlements

Entitlements are a way to describe the permissions that a user has to perform actions in your CRM. They are used to determine what actions a user can perform and what data they can access.

The following entitlements are available:

| Name | Description |
| --- | --- |
| `superuser` | This user is a superuser and has all permissions. |
| `users:read` | The user can read all users. |
| `users:write` | The user can update and delete users. Users need `invitations:write` to create new users |
| `invitations:read` | The user can read all invitations. |
| `invitations:write` | The user can create, update, and rescind invitations |