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
  void input;
  void dependencies;
  throw new Error("Registration service is not implemented.");
}
