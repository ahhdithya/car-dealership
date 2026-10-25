import type { TokenUser } from "./tokens.js";
import type { AuthenticationUser, PublicUser } from "./users.repository.js";

export interface LoginDependencies {
  findUserByEmail: (email: string) => Promise<AuthenticationUser | null>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  signAccessToken: (user: TokenUser) => string;
  dummyPasswordHash: string;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export async function loginUser(
  input: unknown,
  dependencies: LoginDependencies,
): Promise<LoginResult> {
  void input;
  void dependencies;
  throw new Error("Login service is not implemented.");
}
