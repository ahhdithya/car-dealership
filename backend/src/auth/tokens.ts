import jwt from "jsonwebtoken";
import { z } from "zod";

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

const issuer = "car-dealership-api";
const audience = "car-dealership-web";

const tokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(["USER", "ADMIN"]),
  exp: z.number().int().positive(),
});

export function signAccessToken(user: TokenUser, secret: string): string {
  return jwt.sign({ role: user.role }, secret, {
    algorithm: "HS256",
    subject: user.id,
    issuer,
    audience,
    expiresIn: 3600,
  });
}

export function verifyAccessToken(token: string, secret: string): TokenUser {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer,
      audience,
    });

    const claims = tokenClaimsSchema.parse(payload);

    return {
      id: claims.sub,
      role: claims.role,
    };
  } catch (error) {
    throw new InvalidTokenError({ cause: error });
  }
}
