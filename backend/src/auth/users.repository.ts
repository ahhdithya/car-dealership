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
  const result = await database.query<PublicUser>(
    `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, role, created_at AS "createdAt"
    `,
    [input.email, input.passwordHash],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("User creation returned no account.");
  }

  return user;
}
