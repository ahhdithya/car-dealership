import { parseRegistration } from "./auth.schemas.js";
import type { CreateUserInput, PublicUser } from "./users.repository.js";

export interface RegistrationDependencies {
  hashPassword: (password: string) => Promise<string>;
  createUser: (input: CreateUserInput) => Promise<PublicUser>;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor(options?: ErrorOptions) {
    super("An account with this email already exists.", options);
    this.name = "EmailAlreadyRegisteredError";
  }
}

export async function registerUser(
  input: unknown,
  dependencies: RegistrationDependencies,
): Promise<PublicUser> {
  const registration = parseRegistration(input);
  const passwordHash = await dependencies.hashPassword(registration.password);

  try {
    return await dependencies.createUser({
      email: registration.email,
      passwordHash,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "users_email_unique"
    ) {
      throw new EmailAlreadyRegisteredError({ cause: error });
    }

    throw error;
  }
}
