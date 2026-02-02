import { usersTable } from "../db/schema.js";

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const userColumnMap = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  status: usersTable.status,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
};
