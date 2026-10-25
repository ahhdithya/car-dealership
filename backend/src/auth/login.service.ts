import { parseLogin } from "./auth.schemas.js";
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
  const credentials = parseLogin(input);
  const account = await dependencies.findUserByEmail(credentials.email);

  const passwordMatches = await dependencies.verifyPassword(
    account?.passwordHash ?? dependencies.dummyPasswordHash,
    credentials.password,
  );

  if (!account || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const accessToken = dependencies.signAccessToken({
    id: account.id,
    role: account.role,
  });

  return {
    accessToken,
    user: {
      id: account.id,
      email: account.email,
      role: account.role,
      createdAt: account.createdAt,
    },
  };
}
