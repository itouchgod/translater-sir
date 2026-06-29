import { compare, hash } from "bcryptjs";

const PASSWORD_COST = 12;

export async function hashPassword(password: string) {
  return hash(password, PASSWORD_COST);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
