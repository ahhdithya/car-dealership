import type { RequestHandler, Response } from "express";

import { InvalidTokenError, verifyAccessToken } from "./tokens.js";
import type { TokenUser } from "./tokens.js";

function rejectAuthentication(response: Response): void {
  response.setHeader("WWW-Authenticate", "Bearer");

  response.status(401).json({
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "A valid Bearer token is required.",
    },
  });
}

export function authenticate(secret: string): RequestHandler {
  return (request, response, next) => {
    const authorization = request.get("Authorization");
    const match = authorization?.match(/^Bearer +(\S+)$/i);
    const token = match?.[1];

    if (!token) {
      rejectAuthentication(response);
      return;
    }

    try {
      response.locals.user = verifyAccessToken(token, secret);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        rejectAuthentication(response);
        return;
      }

      next(error);
      return;
    }

    next();
  };
}

export const requireAdmin: RequestHandler = (_request, response, next) => {
  const user: TokenUser | undefined = response.locals.user;

  if (!user) {
    rejectAuthentication(response);
    return;
  }

  if (user.role !== "ADMIN") {
    response.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      },
    });
    return;
  }

  next();
};
