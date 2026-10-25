import type { RequestHandler } from "express";

export function authenticate(secret: string): RequestHandler {
  void secret;

  return (_request, _response, next) => {
    next(new Error("Authentication middleware is not implemented."));
  };
}

export const requireAdmin: RequestHandler = (_request, _response, next) => {
  next(new Error("Administrator authorization is not implemented."));
};
