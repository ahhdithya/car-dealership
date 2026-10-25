export interface TokenUser {
  id: string;
  role: "USER" | "ADMIN";
}

export class InvalidTokenError extends Error {
  constructor(options?: ErrorOptions) {
    super("Invalid or expired access token.", options);
    this.name = "InvalidTokenError";
  }
}

export function signAccessToken(user: TokenUser, secret: string): string {
  void user;
  void secret;
  throw new Error("Token signing is not implemented.");
}

export function verifyAccessToken(token: string, secret: string): TokenUser {
  void token;
  void secret;
  throw new Error("Token verification is not implemented.");
}
