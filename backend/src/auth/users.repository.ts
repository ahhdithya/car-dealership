import type { Client } from "pg";

export interface PublicUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export async function createUser(
  database: Pick<Client, "query">,
  input: CreateUserInput,
): Promise<PublicUser> {
  void database;
  void input;
  throw new Error("User creation is not implemented.");
}
